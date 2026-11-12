import assert from "node:assert/strict";
import { test } from "node:test";
import { downmixChannels, floatToPcm16, encodePcm16Wav, canonicalizeAudioBlob, targetFrameCount } from "./audio";

test("P-018 WAV encoding is mono 16kHz PCM16 with correct samples", async () => {
  const samples = downmixChannels([new Float32Array([-1, 0, 1]), new Float32Array([-1, 1, 1])]);
  assert.deepEqual([...samples], [-1, 0.5, 1]);
  assert.deepEqual([...floatToPcm16(samples)], [-32768, 16384, 32767]);
  const blob = encodePcm16Wav(samples);
  const view = new DataView(await blob.arrayBuffer());
  assert.equal(blob.size, 50);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(targetFrameCount(44100, 44100), 16000);
});

test("empty, unsupported and overlong audio fail before upload", async () => {
  await assert.rejects(canonicalizeAudioBlob(new Blob([], { type: "audio/wav" })), /VOICE_AUDIO_EMPTY/);
  await assert.rejects(canonicalizeAudioBlob(new Blob(["x"], { type: "text/plain" })), /VOICE_AUDIO_TYPE_UNSUPPORTED/);
  let closed = false;
  await assert.rejects(canonicalizeAudioBlob(new Blob(["x"], { type: "audio/wav" }), {
    createDecodeContext: () => ({
      decodeAudioData: async () => ({ numberOfChannels: 1, length: 16000 * 31, sampleRate: 16000,
        getChannelData: () => new Float32Array(16000 * 31) }),
      close: async () => { closed = true; },
    }),
    createOfflineContext: () => { throw new Error("Must reject before resampling"); },
  }), /VOICE_AUDIO_TOO_LONG/);
  assert.equal(closed, true);
});
