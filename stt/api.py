"""STT-only HTTP service. Start on loopback using scripts/start-stt.ps1."""
from contextlib import asynccontextmanager
from dataclasses import asdict
import logging

from fastapi import FastAPI, HTTPException, Request
from starlette.concurrency import run_in_threadpool

from stt.audio import contains_speech, decode_canonical_wav
from stt.engine import LocalEngine
from stt.errors import VoiceAudioValidationError, VoiceNoSpeechError, VoicePayloadTooLargeError
from stt.diarization import LocalDiarizer
from stt.diarized_sessions import SessionStore, SessionError

MAX_AUDIO_SECONDS = 30
MAX_AUDIO_BYTES = MAX_AUDIO_SECONDS * 16_000 * 2 + 4096
logger = logging.getLogger(__name__)


def create_app(engine=None, diarizer=None):
    engine = engine if engine is not None else LocalEngine()
    diarizer = diarizer if diarizer is not None else LocalDiarizer()
    sessions = SessionStore(engine, diarizer)

    @asynccontextmanager
    async def lifespan(app):
        yield
        if hasattr(engine, 'close'):
            engine.close()
        sessions.sessions.clear()

    app = FastAPI(title='Vietnamese Zipformer STT', lifespan=lifespan)

    @app.get('/health')
    def health():
        return {**engine.status(), 'diarization_ready': diarizer.ready(), 'max_audio_seconds': MAX_AUDIO_SECONDS,
                'max_audio_bytes': MAX_AUDIO_BYTES}

    @app.post('/sessions')
    def create_session():
        if not diarizer.ready():
            raise HTTPException(503, 'DIARIZATION_MODEL_MISSING')
        try:
            return sessions.create()
        except SessionError as error:
            raise HTTPException(error.status, error.code) from None

    @app.delete('/sessions/{key}')
    def close_session(key: str):
        sessions.close(key)
        return {'closed': True}

    @app.post('/sessions/{key}/finalize')
    def finalize_session(key: str):
        if not engine.lock.acquire(blocking=False):
            raise HTTPException(429, 'STT_BUSY')
        try:
            return sessions.finalize(key)
        except SessionError as error:
            raise HTTPException(error.status, error.code) from None
        finally:
            engine.lock.release()

    def recognize(audio, session_id=None, sequence=0, start_frame=0, diarize_file=False):
        if not engine.lock.acquire(blocking=False):
            raise HTTPException(429, 'STT_BUSY')
        try:
            if session_id:
                return sessions.process(session_id, sequence, start_frame, audio)
            if diarize_file:
                return sessions.file(audio)
            if not contains_speech(audio, min_frame_rms=0.005, min_speech_ms=100,
                                   max_frame_rms_threshold=0.02):
                raise VoiceNoSpeechError()
            result = engine.transcribe(audio)
            return {**asdict(result), 'audio_ms': audio.duration_ms, 'no_speech': False}
        except VoiceNoSpeechError:
            return {'transcript': '', 'no_speech': True, 'audio_ms': audio.duration_ms,
                    'language': 'vi', 'inference_ms': 0}
        except SessionError as error:
            raise HTTPException(error.status, error.code) from None
        except FileNotFoundError:
            raise HTTPException(503, 'STT_MODEL_MISSING') from None
        except ValueError as error:
            if str(error) == 'STT_HOTWORDS_INVALID':
                raise HTTPException(503, 'STT_HOTWORDS_INVALID') from None
            logger.exception('Local STT inference failed')
            raise HTTPException(503, 'STT_INFERENCE_FAILED') from None
        except HTTPException:
            raise
        except RuntimeError as error:
            if str(error) in {'DIARIZATION_MODEL_MISSING', 'DIARIZATION_MODEL_INVALID'}:
                raise HTTPException(503, str(error)) from None
            logger.exception('Local STT inference failed')
            raise HTTPException(503, 'STT_INFERENCE_FAILED') from None
        except Exception:
            logger.exception('Local STT load/inference failed')
            raise HTTPException(503, 'STT_INFERENCE_FAILED') from None
        finally:
            engine.lock.release()

    @app.post('/transcribe')
    async def transcribe(request: Request):
        session_id = request.headers.get('x-stt-session')
        sequence = start_frame = 0
        if session_id:
            try:
                sequence = int(request.headers.get('x-stt-sequence', ''))
                start_frame = int(request.headers.get('x-stt-start-frame', ''))
                if sequence < 1 or start_frame < 0 or start_frame > 2**53:
                    raise ValueError()
            except ValueError:
                raise HTTPException(400, 'STT_CHUNK_METADATA_INVALID') from None
        payload = bytearray()
        async for chunk in request.stream():
            if len(payload) + len(chunk) > MAX_AUDIO_BYTES:
                raise HTTPException(413, 'AUDIO_TOO_LARGE')
            payload.extend(chunk)
        try:
            audio = decode_canonical_wav(bytes(payload),
                                         mime_type=request.headers.get('content-type', ''),
                                         max_audio_bytes=MAX_AUDIO_BYTES,
                                         max_audio_seconds=MAX_AUDIO_SECONDS, allow_silence=bool(session_id))
        except VoicePayloadTooLargeError as error:
            raise HTTPException(413, error.reason_code) from None
        except VoiceAudioValidationError as error:
            raise HTTPException(400, error.reason_code) from None
        return await run_in_threadpool(recognize, audio, session_id, sequence, start_frame,
                                       request.headers.get('x-stt-diarize') == '1')

    return app


app = create_app()
