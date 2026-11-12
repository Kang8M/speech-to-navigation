from threading import Lock

import pytest
from fastapi.testclient import TestClient

from stt.api import create_app, MAX_AUDIO_BYTES
from stt.contracts import SpeechRecognitionResult
from stt.errors import VoiceNoSpeechError
from stt.tests.test_audio import wav_bytes


class Engine:
    def __init__(self):
        self.calls = 0
        self.error = None
        self.lock = Lock()

    def status(self):
        return {"ready": True, "model_id": "test-model"}

    def transcribe(self, audio):
        self.calls += 1
        if self.error:
            raise self.error
        return SpeechRecognitionResult(audio.utterance_ref, 'xin chào', None, 'vi', 'test-model', 'rev', 'rev', 7)


@pytest.fixture
def service():
    engine = Engine()
    with TestClient(create_app(engine)) as client:
        yield client, engine


def post(client, data, mime='audio/wav'):
    return client.post('/transcribe', content=data, headers={'Content-Type': mime})


def test_success_returns_transcript_and_timing(service):
    client, engine = service
    response = post(client, wav_bytes(seconds=0.8))
    assert response.status_code == 200
    assert response.json()['transcript'] == 'xin chào'
    assert response.json()['audio_ms'] == 800
    assert response.json()['inference_ms'] == 7
    assert engine.calls == 1


@pytest.mark.parametrize('payload,mime,status,code', [
    (b'bad', 'audio/wav', 400, 'AUDIO_DECODE_FAILED'),
    (wav_bytes(), 'audio/webm', 400, 'AUDIO_MIME_UNSUPPORTED'),
    (wav_bytes(silent=True), 'audio/wav', 400, 'AUDIO_SILENT'),
    (wav_bytes(channels=2), 'audio/wav', 400, 'AUDIO_CHANNELS_UNSUPPORTED'),
    (wav_bytes(sample_rate=44100), 'audio/wav', 400, 'AUDIO_SAMPLE_RATE_UNSUPPORTED'),
    (b'x' * (MAX_AUDIO_BYTES + 1), 'audio/wav', 413, 'AUDIO_TOO_LARGE'),
])
def test_invalid_audio_never_reaches_model(service, payload, mime, status, code):
    client, engine = service
    response = post(client, payload, mime)
    assert response.status_code == status
    assert response.json()['detail'] == code
    assert engine.calls == 0


def test_model_no_speech_returns_empty_result(service):
    client, engine = service
    engine.error = VoiceNoSpeechError()
    response = post(client, wav_bytes(seconds=0.8))
    assert response.status_code == 200
    assert response.json()['transcript'] == ''
    assert response.json()['no_speech'] is True


def test_concurrent_request_is_bounded(service):
    client, engine = service
    with engine.lock:
        response = post(client, wav_bytes(seconds=0.8))
    assert response.status_code == 429
    assert engine.calls == 0


def test_missing_model_is_actionable(tmp_path, monkeypatch):
    monkeypatch.setenv('STT_MODEL_DIR', str(tmp_path))
    with TestClient(create_app()) as client:
        assert client.get('/health').json()['ready'] is False
        response = post(client, wav_bytes(seconds=0.8))
        assert response.status_code == 503
        assert response.json()['detail'] == 'STT_MODEL_MISSING'
