from threading import Lock
from types import SimpleNamespace

from fastapi.testclient import TestClient

from stt.api import create_app
from stt.tests.test_diarized_sessions import Diarizer, Engine
from stt.tests.test_audio import wav_bytes


class ApiEngine(Engine):
    lock = Lock()
    def status(self): return {'ready': True}


class ApiDiarizer(Diarizer):
    def ready(self): return True


def test_session_lifecycle_retry_silence_and_finalization():
    with TestClient(create_app(ApiEngine(), ApiDiarizer())) as client:
        key = client.post('/sessions').json()['session_id']
        headers = {'Content-Type': 'audio/wav', 'X-STT-Session': key, 'X-STT-Sequence': '1', 'X-STT-Start-Frame': '0'}
        first = client.post('/transcribe', headers=headers, content=wav_bytes(seconds=5))
        assert first.status_code == 200
        assert first.json()['words'][0]['speaker'] == 1
        assert client.post('/transcribe', headers=headers, content=wav_bytes(seconds=5)).json() == first.json()
        headers.update({'X-STT-Sequence': '2', 'X-STT-Start-Frame': '80000'})
        assert client.post('/transcribe', headers=headers, content=wav_bytes(silent=True)).status_code == 200
        final = client.post(f'/sessions/{key}/finalize')
        assert final.json()['final'] is True
        assert client.post(f'/sessions/{key}/finalize').json() == final.json()
        assert client.delete(f'/sessions/{key}').status_code == 200
        assert client.post(f'/sessions/{key}/finalize').status_code == 404


def test_missing_models_and_bad_sequence_are_actionable():
    diarizer = ApiDiarizer()
    with TestClient(create_app(ApiEngine(), diarizer)) as client:
        key = client.post('/sessions').json()['session_id']
        response = client.post('/transcribe', content=wav_bytes(), headers={'Content-Type': 'audio/wav', 'X-STT-Session': key})
        assert response.status_code == 400
        diarizer.ready = lambda: False
        assert client.post('/sessions').json()['detail'] == 'DIARIZATION_MODEL_MISSING'
