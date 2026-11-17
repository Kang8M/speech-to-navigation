import type { ReactNode } from "react";

/** Biểu tượng micro lớn, nét đầy, dùng cho nút Nói */
export function MicIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0" />
      <path d="M12 18v3.5M8.5 21.5h7" />
    </svg>
  );
}

export function StopIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

/** Nhãn nút: biểu tượng to bên trái, chữ bên phải */
export function NhanNut({ bieuTuong, children }: { bieuTuong: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center justify-center gap-3">
      {bieuTuong}
      <span>{children}</span>
    </span>
  );
}
