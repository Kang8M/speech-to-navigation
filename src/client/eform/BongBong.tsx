"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tim";

/**
 * Vỏ bong bóng Trợ lý: nút tròn góc dưới phải, bấm hoặc F2 để mở, Esc để đóng và trả con trỏ về ô đang gõ.
 * Khung luôn được render (đóng thì `hidden`) để phần bên trong giữ state và vẫn nhận chữ từ micro.
 */
export function BongBong({ children, dangGhi }: { children: ReactNode; dangGhi: boolean }) {
  const [mo, setMo] = useState(false);
  /** Phần tử đang focus trước khi mở, đóng lại thì trả con trỏ về đó */
  const truocDo = useRef<HTMLElement | null>(null);
  const nut = useRef<HTMLButtonElement>(null);
  const khung = useRef<HTMLDivElement>(null);
  const moRef = useRef(false);

  const doiTrangThai = (moi: boolean) => {
    if (moi === moRef.current) return;
    moRef.current = moi;
    setMo(moi);
    if (moi) {
      const dang = document.activeElement;
      truocDo.current = dang instanceof HTMLElement && dang !== document.body && dang !== nut.current ? dang : null;
    } else {
      (truocDo.current ?? nut.current)?.focus({ preventScroll: true });
    }
  };

  // F2: phím chức năng còn trống trên trình duyệt, không đụng việc gõ chữ
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2" || e.repeat) return;
      e.preventDefault();
      doiTrangThai(!moRef.current);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (mo) khung.current?.focus({ preventScroll: true });
  }, [mo]);

  return (
    <div className="fixed right-4 bottom-[calc(var(--cao-day)+1rem)] z-40 flex flex-col items-end gap-2 sm:right-6 print:hidden">
      <div
        ref={khung}
        id="khung-tro-ly"
        role="dialog"
        aria-label="Trợ lý điền phiếu"
        tabIndex={-1}
        hidden={!mo}
        className="max-h-[calc(100vh-var(--cao-dau)-var(--cao-day)-6rem)] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-tim-vien bg-white text-[13px] shadow-[0_12px_32px_-12px_rgba(26,37,51,0.35)] outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            doiTrangThai(false);
          }
        }}
      >
        <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-tim-vien/60 bg-tim-nhat px-3.5 py-2">
          <span className="font-semibold text-tim">Trợ lý</span>
          <button
            type="button"
            aria-label="Đóng trợ lý"
            className={`ml-auto rounded px-1.5 text-base leading-none text-ef-phu hover:text-ef-chu ${FOCUS}`}
            onClick={() => doiTrangThai(false)}
          >
            ×
          </button>
        </div>
        <div className="flex flex-col gap-3 p-3">{children}</div>
      </div>
      <button
        ref={nut}
        type="button"
        aria-label="Trợ lý điền phiếu"
        aria-expanded={mo}
        aria-controls="khung-tro-ly"
        title="Trợ lý (F2)"
        className={`relative flex h-12 w-12 items-center justify-center rounded-full bg-tim text-lg text-white shadow-lg hover:opacity-90 ${FOCUS}`}
        onClick={() => doiTrangThai(!moRef.current)}
      >
        <span aria-hidden>✨</span>
        {dangGhi && (
          <span className="absolute right-0.5 top-0.5 h-3 w-3 rounded-full border-2 border-white bg-ef-do" role="img" aria-label="Đang ghi âm" />
        )}
      </button>
    </div>
  );
}
