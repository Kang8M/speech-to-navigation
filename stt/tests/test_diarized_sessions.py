from types import SimpleNamespace

import numpy as np
import pytest

from stt.diarization import Region
from stt.diarized_sessions import SessionStore, SessionError
from stt.tests.test_audio import decode, wav_bytes


class Engine:
    def transcribe(self, audio):
        text = [' TÔI', ' BỊ', ' ĐAU'] if audio.duration_ms <= 5000 else [' TÔI', ' BỊ', ' ĐAU', ' HỌNG', ' BA', ' NGÀY']
        return SimpleNamespace(tokens=text, timestamps=[i * 0.8 for i in range(len(text))], inference_ms=2)


class Diarizer:
    def regions(self, samples, profiles):
        speaker = profiles.identify(np.array([1., 0]))
        return [Region(0, len(samples) / 16000, speaker)]


def store():
    return SessionStore(Engine(), Diarizer())


def test_5_plus_3_seconds_is_redecoded_as_one_8_second_turn():
    subject = store(); session_id = subject.create()['session_id']
    first = subject.process(session_id, 1, 0, decode(wav_bytes(seconds=5)))
    second = subject.process(session_id, 2, 80000, decode(wav_bytes(seconds=3)))
    assert first['replace_from_ms'] == second['replace_from_ms'] == 0
    assert ' '.join(word['text'] for word in second['words']) == 'tôi bị đau họng ba ngày'
    assert {word['speaker'] for word in second['words']} == {1}
    assert second['audio_ms'] == 8000
    assert subject.finalize(session_id)['final'] is True


def test_retry_is_idempotent_and_out_of_order_or_changed_payload_is_rejected():
    subject = store(); key = subject.create()['session_id']; audio = decode(wav_bytes(seconds=5))
    first = subject.process(key, 1, 0, audio)
    assert subject.process(key, 1, 0, audio) == first
    with pytest.raises(SessionError): subject.process(key, 3, 80000, audio)
    with pytest.raises(SessionError): subject.process(key, 1, 0, decode(wav_bytes(seconds=3)))


def test_session_audio_and_cached_words_are_bounded_and_sessions_are_isolated():
    subject = store(); a = subject.create()['session_id']; b = subject.create()['session_id']
    for index in range(12): subject.process(a, index + 1, index * 80000, decode(wav_bytes(seconds=5)))
    assert len(subject.sessions[a].samples) <= 25 * 16000
    assert subject.sessions[a].total_frames == 60 * 16000
    assert subject.sessions[b].total_frames == 0
    subject.close(a)
    with pytest.raises(SessionError): subject.finalize(a)


def test_model_failure_does_not_advance_sequence_or_audio():
    subject = store(); key = subject.create()['session_id']
    def fail(_audio): raise RuntimeError('inference failed')
    subject.engine.transcribe = fail
    with pytest.raises(RuntimeError): subject.process(key, 1, 0, decode(wav_bytes(seconds=5)))
    assert subject.sessions[key].total_frames == 0
    assert subject.sessions[key].sequence == 0


@pytest.mark.parametrize('old_time,new_time', [(5.05, 4.95), (4.95, 5.05)])
def test_timestamp_drift_across_freeze_boundary_never_drops_or_duplicates_word(old_time, new_time):
    subject = store(); key = subject.create()['session_id']
    calls = 0
    def transcribe(audio):
        nonlocal calls
        calls += 1
        if calls < 3:
            return SimpleNamespace(tokens=[], timestamps=[], inference_ms=0)
        return SimpleNamespace(tokens=[' TRƯỚC', ' MỐC', ' SAU'], timestamps=[3, old_time if calls == 3 else new_time, 7], inference_ms=1)
    subject.engine.transcribe = transcribe
    for sequence in range(1, 4):
        first = subject.process(key, sequence, (sequence - 1) * 80000, decode(wav_bytes(seconds=5)))
    second = subject.process(key, 4, 240000, decode(wav_bytes(seconds=5)))
    merged = [word for word in first['words'] if word['start_ms'] < second['replace_from_ms']] + second['words']
    assert [word['text'] for word in merged] == ['trước', 'mốc', 'sau']


def test_session_capacity_expiry_and_chunk_bounds():
    import time
    subject = SessionStore(Engine(), Diarizer(), max_sessions=1)
    key = subject.create()['session_id']
    with pytest.raises(SessionError, match='STT_SESSIONS_FULL'): subject.create()
    with pytest.raises(SessionError, match='STT_CHUNK_TOO_LONG'):
        subject.process(key, 1, 0, decode(wav_bytes(seconds=6)))
    subject.sessions[key].touched = time.monotonic() - 601
    replacement = subject.create()['session_id']
    assert replacement != key
    with pytest.raises(SessionError, match='STT_SESSION_EXPIRED'): subject.finalize(key)
