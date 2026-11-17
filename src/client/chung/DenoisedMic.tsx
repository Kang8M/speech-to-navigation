"use client";

import { useEffect, useRef, useState } from "react";
import { openContinuousSession, type ContinuousCapture, type SttResult } from "@/lib/stt/continuous";
import { SpeakerSessionClient } from "@/lib/stt/speaker-client";
import { reviseWords, type SpeakerWord } from "@/lib/stt/speakers";
import type { RecordingBinding } from "@/shared/clinical/recording";
import type { MicButtonProps } from "./MicButton";
import { MicIcon, NhanNut, StopIcon } from "./mic-ui";

const ERRORS: Record<string, string> = {
  DENOISE_NOT_READY: "DeepFilterNet3 chưa sẵn sàng. Cài runtime và tải model local rồi thử lại.",
  DENOISE_RUNTIME_MISSING: "Chưa có runtime DeepFilterNet3. Chạy npm run stt:denoise:setup rồi thử lại.",
  DENOISE_MODEL_MISSING: "Chưa có model DeepFilterNet3. Chạy npm run stt:denoise:setup rồi thử lại.",
  DENOISE_INVALID_AUDIO: "Audio đầu vào khử nhiễu không hợp lệ. Thử thu lại hoặc chọn file WAV khác.",
  DENOISE_INVALID_OUTPUT: "WAV sau khử nhiễu không hợp lệ. Xem logs/stt-backend.err.log hoặc tắt khử nhiễu để thử lại.",
  DENOISE_OUTPUT_INVALID: "WAV sau khử nhiễu không hợp lệ. Xem logs/stt-backend.err.log hoặc tắt khử nhiễu để thử lại.",
  DENOISE_MODE_INVALID: "Chế độ khử nhiễu không hợp lệ. Chọn lại Tắt hoặc DeepFilterNet3.",
  DENOISE_MODE_CONFLICT: "Chế độ khử nhiễu của phiên đã thay đổi. Kết thúc và mở phiên mới.",
  DENOISE_FAILED: "Khử nhiễu thất bại. Xem logs/stt-backend.err.log hoặc tắt khử nhiễu để thử lại.",
  DENOISE_TIMEOUT: "Khử nhiễu quá thời gian chờ. Dừng phiên và thử lại.",
  STT_BACKEND_UNAVAILABLE: "Chưa kết nối được STT local. Chạy npm run stt:start rồi thử lại.",
  STT_MODEL_MISSING: "Chưa có model STT. Chạy npm run stt:setup rồi thử lại.",
  STT_VAD_MODEL_MISSING: "Chưa có model VAD. Chạy npm run stt:setup rồi thử lại.",
  DIARIZATION_MODEL_MISSING: "Chưa có model phân biệt người nói. Chạy npm run stt:setup rồi thử lại.",
  STT_BACKLOG: "Xử lý chậm hơn tốc độ thu; micro đã dừng để xử lý các đoạn còn lại.",
  NotAllowedError: "Trình duyệt chưa được cấp quyền dùng micro.",
  NotFoundError: "Không tìm thấy micro. Kết nối micro rồi thử lại.",
};

function describe(error: unknown) {
  const code = error instanceof DOMException ? error.name : error instanceof Error ? error.message : "";
  return ERRORS[code] || `Không nhận dạng được${code ? ` (${code})` : ""}. Thử lại hoặc tắt khử nhiễu.`;
}

/** Stable text only is committed to clinical inputs; the revisable tail stays in the preview. */
export function DenoisedMic({ onStart, onText, onStop, onInterim, beforeStart, onCaptureReady, onCaptureFailed, onStopRequest, giaoDien }: MicButtonProps) {
  const [phase, setPhase] = useState<"idle" | "opening" | "recording" | "processing">("idle");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [interim, setInterim] = useState("");
  const [seconds, setSeconds] = useState(0);
  const capture = useRef<ContinuousCapture | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const busy = useRef(false);
  const callbacks = useRef({ onStart, onText, onStop, onInterim });
  useEffect(() => { callbacks.current = { onStart, onText, onStop, onInterim }; }, [onStart, onText, onStop, onInterim]);
  /** Chữ tạm vừa hiện dưới nút (nếu cần) vừa báo ra ngoài để đưa lên ô nhập */
  const showInterim = (text: string) => { setInterim(text); callbacks.current.onInterim?.(text); };
  /** Lần dừng đang chạy: gọi lại thì trả đúng promise đó, để bên ngoài chỉ tiếp tục sau khi chữ cuối đã được giao. */
  const stopping = useRef<Promise<void> | null>(null);
  useEffect(() => () => {
    generation.current++;
    capture.current?.cancel();
    request.current?.abort();
  }, []);

  async function start() {
    if (busy.current || !consent) return;
    busy.current = true;
    const current = ++generation.current;
    const controller = new AbortController();
    request.current = controller;
    setPhase("opening"); setError(""); showInterim(""); setSeconds(0);
    let session: SpeakerSessionClient | null = null;
    let binding: RecordingBinding | undefined;
    let started = false;
    let settled = false;
    let words: SpeakerWord[] = [];
    let emittedUntil = 0;
    const active = () => current === generation.current;
    const settle = () => {
      if (!active() || settled) return;
      settled = true;
      capture.current = null; request.current = null; busy.current = false;
      setPhase("idle"); setConsent(false); showInterim("");
      if (started) callbacks.current.onStop?.();
    };
    const accept = (part: SttResult) => {
      if (!active()) return;
      words = reviseWords(words, { replace_from_ms: part.replace_from_ms ?? 0, words: part.words ?? [] });
      const boundary = part.final ? Infinity : (part.stable_until_ms ?? 0);
      const committed = words.filter((word) => word.start_ms >= emittedUntil && word.start_ms < boundary);
      if (committed.length) callbacks.current.onText(committed.map((word) => word.text).join(" "), binding);
      // The server replaces words by start_ms; using end_ms would lose words crossing the boundary.
      emittedUntil = Math.max(emittedUntil, boundary);
      words = words.filter((word) => word.start_ms >= boundary);
      showInterim(words.map((word) => word.text).join(" "));
    };
    try {
      // Giữ chỗ phiên trước khi mở micro; lỗi giữ chỗ (tab khác đang dùng micro) thì không thu.
      binding = await beforeStart?.();
      const healthResponse = await fetch("/api/stt", { cache: "no-store", signal: controller.signal });
      const health = await healthResponse.json();
      if (!healthResponse.ok) throw new Error(health.detail || "STT_BACKEND_UNAVAILABLE");
      if (!health.ready) throw new Error(health.detail || "STT_MODEL_MISSING");
      if (!health.denoise_ready) throw new Error("DENOISE_NOT_READY");
      if (!health.vad_ready) throw new Error("STT_VAD_MODEL_MISSING");
      if (!health.diarization_ready) throw new Error("DIARIZATION_MODEL_MISSING");
      session = await SpeakerSessionClient.create(controller.signal, fetch, "deepfilternet3");
      if (!active()) { await session.close(); return; }
      const backend = session;
      const recording = await openContinuousSession({
        transcribe: (wav) => backend.transcribe(wav),
        onResult: accept,
        onElapsed: (elapsed) => { if (active()) setSeconds(elapsed); },
        onPending: () => {},
        onStopping: () => { if (active()) setPhase("processing"); },
        onStopped: settle,
        onError: (cause, sequence) => {
          if (!active()) return;
          setError(describe(cause));
          if (sequence) {
            capture.current?.cancel(); controller.abort(); void backend.close();
            settle(); generation.current++;
          }
        },
        onFinish: async () => { accept(await backend.finish()); },
        onCancel: () => { void backend.close(); },
      });
      if (!active()) { recording.cancel(); return; }
      capture.current = recording;
      started = true;
      setPhase("recording"); callbacks.current.onStart();
      if (binding) onCaptureReady?.({ stop: () => stopCapture(), cancel: () => { capture.current?.cancel(); } }, binding);
    } catch (cause) {
      capture.current?.cancel(); controller.abort();
      await session?.close();
      if (binding) onCaptureFailed?.(binding);
      if (active()) { setError(describe(cause)); settle(); }
    }
  }

  function stopCapture(): Promise<void> {
    if (stopping.current) return stopping.current;
    const recording = capture.current;
    if (!recording) return Promise.resolve();
    stopping.current = (async () => {
      try { await recording.stop(); }
      catch (cause) { setError(describe(cause)); recording.cancel(); throw cause; }
      finally { stopping.current = null; }
    })();
    return stopping.current;
  }

  const idle = phase === "idle";
  const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  return <div>
    <label className="mb-2 flex items-start gap-2 text-xs text-muted">
      <input type="checkbox" checked={consent} disabled={!idle} onChange={(event) => setConsent(event.target.checked)} />
      Tôi đồng ý xử lý âm thanh và nội dung y tế trong hệ thống nội bộ cho lần thu này.
    </label>
    <button type="button" disabled={phase === "opening" || phase === "processing" || (idle && !consent)}
      aria-pressed={phase === "recording"} onClick={() => phase === "recording" ? (onStopRequest ? onStopRequest() : void stopCapture().catch(() => undefined)) : void start()}
      className={`${giaoDien?.nut ?? "w-full rounded-xl border-2 py-3.5 text-base font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"} ${phase === "recording" ? giaoDien?.dangNghe ?? "border-warn text-warn-text" : giaoDien?.cho ?? "border-primary text-primary"}`}>
      {phase === "recording" ? <NhanNut bieuTuong={<StopIcon />}>Dừng nghe · {clock}</NhanNut> : phase === "opening" ? "Đang mở micro…" : phase === "processing" ? "Đang chốt câu cuối…" : giaoDien?.nhan ?? <NhanNut bieuTuong={<MicIcon />}>Nói</NhanNut>}
    </button>
    {interim && !onInterim && <p className="mt-1 text-sm text-muted italic">{interim}</p>}
    {error && <p role="alert" className="mt-1 text-sm text-warn-text">{error}</p>}
  </div>;
}
