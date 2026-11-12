"""Local acoustic diarization + approximate token-time attribution, with session-only IDs."""
from dataclasses import dataclass
import unicodedata

import numpy as np

from stt.download_diarization import ROOT


@dataclass(frozen=True)
class Region:
    start: float
    end: float
    speaker: int | None
    cluster: int | None = None


class SpeakerProfiles:
    def __init__(self):
        self.vectors: list[np.ndarray] = []

    def identify(self, embedding) -> int | None:
        vector = np.asarray(embedding, dtype=np.float32)
        norm = float(np.linalg.norm(vector))
        if not np.isfinite(vector).all() or norm < 1e-8:
            return None
        vector = vector / norm
        scores = [float(vector @ profile) for profile in self.vectors]
        if scores:
            best = int(np.argmax(scores))
            if scores[best] >= 0.55:
                if len(scores) == 2 and abs(scores[0] - scores[1]) < 0.08:
                    return None
                return best + 1
        if len(self.vectors) < 2:
            self.vectors.append(vector.copy())
            return len(self.vectors)
        return None


def tokens_to_words(tokens, timestamps, duration: float) -> list[dict]:
    if len(tokens) != len(timestamps):
        raise ValueError('STT_TOKEN_TIMESTAMPS_MISSING')
    words = []
    for index, (token, timestamp) in enumerate(zip(tokens, timestamps)):
        token = token.replace('▁', ' ')
        if not token.strip():
            continue
        start = max(0, round(float(timestamp) * 1000))
        end = min(round(duration * 1000), start + 800,
                  round(float(timestamps[index + 1]) * 1000) if index + 1 < len(tokens) else round(duration * 1000))
        text = unicodedata.normalize('NFC', token).lower()
        if token[0].isspace() or not words:
            words.append({'text': text.strip(), 'start_ms': start, 'end_ms': max(start, end)})
        else:
            words[-1]['text'] = unicodedata.normalize('NFC', words[-1]['text'] + text)
            words[-1]['end_ms'] = max(start, end)
    return words


def attribute_words(words: list[dict], regions: list[Region]) -> list[dict]:
    output = []
    for word in words:
        # Transducer timestamps are emission estimates, not forced alignment.
        point = word['start_ms'] / 1000 + min(0.08, (word['end_ms'] - word['start_ms']) / 2000)
        active = [region for region in regions if region.start <= point < region.end]
        if not active and regions:
            nearest = min(regions, key=lambda region: min(abs(point - region.start), abs(point - region.end)))
            if min(abs(point - nearest.start), abs(point - nearest.end)) <= 0.45:
                active = [nearest]
        speakers = {region.speaker for region in active}
        acoustic_clusters = {region.cluster if region.cluster is not None else region.speaker if region.speaker is not None else id(region) for region in active}
        overlap = len(acoustic_clusters) > 1
        output.append({**word, 'speaker': next(iter(speakers)) if len(speakers) == 1 and not overlap else None,
                       'overlap': overlap})
    return output


class LocalDiarizer:
    def __init__(self):
        self._model = None
        self._extractor = None

    def ready(self):
        return all((ROOT / name).is_file() for name in ('segmentation-model.onnx', 'nemo_en_titanet_small.onnx'))

    def _load(self):
        if self._model is not None:
            return
        if not self.ready():
            raise RuntimeError('DIARIZATION_MODEL_MISSING')
        import sherpa_onnx as sherpa
        embedding = sherpa.SpeakerEmbeddingExtractorConfig(model=str(ROOT / 'nemo_en_titanet_small.onnx'), num_threads=2, provider='cpu')
        config = sherpa.OfflineSpeakerDiarizationConfig(
            segmentation=sherpa.OfflineSpeakerSegmentationModelConfig(
                pyannote=sherpa.OfflineSpeakerSegmentationPyannoteModelConfig(model=str(ROOT / 'segmentation-model.onnx'), window_shift_ratio=0.5),
                num_threads=2, provider='cpu'), embedding=embedding,
            clustering=sherpa.FastClusteringConfig(num_clusters=-1, threshold=0.5),
            min_duration_on=0.2, min_duration_off=0.3)
        if not config.validate():
            raise RuntimeError('DIARIZATION_MODEL_INVALID')
        self._model = sherpa.OfflineSpeakerDiarization(config)
        self._extractor = sherpa.SpeakerEmbeddingExtractor(embedding)

    def regions(self, samples, profiles: SpeakerProfiles) -> list[Region]:
        self._load()
        if len(samples) < 8000:
            return []
        segments = self._model.process(np.asarray(samples, dtype=np.float32)).sort_by_start_time()
        mapping = {}
        for segment in segments:
            if segment.speaker in mapping:
                continue
            # Extract only clean/non-overlapped speech from this local cluster.
            pieces = []
            for region in segments:
                if region.speaker != segment.speaker:
                    continue
                if any(other.speaker != region.speaker and other.start < region.end and other.end > region.start for other in segments):
                    continue
                pieces.append(samples[max(0, int(region.start * 16000)):min(len(samples), int(region.end * 16000))])
            clean = np.concatenate(pieces)[:6 * 16000] if pieces else np.empty(0, dtype=np.float32)
            mapping[segment.speaker] = None
            if len(clean) >= 12800:
                stream = self._extractor.create_stream()
                stream.accept_waveform(16000, clean)
                stream.input_finished()
                if self._extractor.is_ready(stream):
                    mapping[segment.speaker] = profiles.identify(self._extractor.compute(stream))
        duration = len(samples) / 16000
        return [Region(max(0, region.start), min(duration, region.end), mapping[region.speaker], region.speaker) for region in segments]
