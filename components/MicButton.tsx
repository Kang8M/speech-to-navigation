"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Web Speech API chưa có trong kiểu DOM mặc định của TypeScript
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: RecognitionResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionConstructor = new () => Recognition;

function getRecognition(): RecognitionConstructor | null {
  const speechWindow = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

const subscribe = () => () => {};

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Trình duyệt chưa được cấp quyền dùng micro.",
  "service-not-allowed": "Trình duyệt chưa được cấp quyền dùng micro.",
  "audio-capture": "Không tìm thấy micro.",
  network: "Không kết nối được dịch vụ nhận giọng nói. Hãy kiểm tra internet hoặc gõ tay.",
};

interface Props {
  onStart: () => void;
  onText: (text: string) => void;
}

export function MicButton({ onStart, onText }: Props) {
  const supported = useSyncExternalStore(subscribe, () => getRecognition() !== null, () => false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<Recognition | null>(null);
  const wantListeningRef = useRef(false);

  useEffect(
    () => () => {
      wantListeningRef.current = false;
      recognitionRef.current?.abort();
    },
    [],
  );

  if (!supported) return null;

  function start() {
    const Constructor = getRecognition();
    if (!Constructor) return;
    const recognition = new Constructor();
    recognition.lang = "vi-VN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let pending = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onText(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      const message = ERROR_MESSAGES[event.error];
      if (message) {
        wantListeningRef.current = false;
        setError(message);
      }
    };
    recognition.onend = () => {
      // Chrome tự ngắt khi im lặng; bác sĩ chưa bấm dừng thì nghe tiếp
      if (wantListeningRef.current) {
        recognition.start();
      } else {
        setListening(false);
        setInterim("");
      }
    };
    recognitionRef.current = recognition;
    wantListeningRef.current = true;
    setError(null);
    setListening(true);
    onStart();
    recognition.start();
  }

  function stop() {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
  }

  return (
    <div>
      <button
        type="button"
        onClick={listening ? stop : start}
        aria-pressed={listening}
        className={`w-full rounded border py-2 font-medium ${
          listening ? "border-warn bg-warn/10 text-warn-text" : "border-primary text-primary hover:bg-soft"
        }`}
      >
        {listening ? "⏹ Dừng nghe" : "🎤 Nói"}
      </button>
      {interim && <p className="mt-1 text-sm text-muted italic">{interim}</p>}
      {error && (
        <p role="alert" className="mt-1 text-sm text-warn-text">
          {error}
        </p>
      )}
    </div>
  );
}
