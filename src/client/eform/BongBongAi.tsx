"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MicButton, type GiaoDienMic } from "@/client/chung/MicButton";
import { useEform } from "@/client/eform/EformContext";
import { useDienAi, type OnDien } from "@/client/eform/useDienAi";
import type { KetQuaDien } from "@/shared/eform/dien-phieu";
import { goiYTenMau, timPhieuMau } from "@/shared/eform/phieu-mau";
import { suaChu } from "@/shared/giong-noi/sua-chu";
import type { InputMode } from "@/shared/metrics";

interface Props {
  ketQua: KetQuaDien | null;
  onDien: OnDien;
  onBatDau: (kieuNhap: InputMode, tuCaMau: boolean) => void;
  onHoanTac: (() => void) | null;
  onGoTo: (id: string) => void;
  /** Phiếu đã Hoàn thành khám: không mở được */
  khoa: boolean;
  /** Khoảng trống trên thanh đáy (giữa In ngay và Lưu) để đặt dòng báo đã điền, không che ô phiếu */
  khe: HTMLElement | null;
}

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tim";
const NUT_CHU = `rounded text-xs font-medium underline-offset-2 hover:underline ${FOCUS}`;
const KBD = "rounded border px-1 font-sans text-[11px] leading-4";

/**
 * Giao diện gọn: bong bóng ở góc thay cho cột Trợ lý AI. Bấm hoặc F2 để mở, nói hay gõ một lệnh
 * (tên mẫu, gõ tắt, cả ca), Enter là điền thẳng vào phiếu rồi thu lại. Không trò chuyện, không giữ lịch sử:
 * chỉ còn một dòng báo đã điền gì trên thanh đáy, kèm Xem ô vàng và Hoàn tác.
 */
export function BongBongAi({ ketQua, onDien, onBatDau, onHoanTac, onGoTo, khoa, khe }: Props) {
  const { data, get } = useEform();
  const { text, setText, loading, error, setError, thongBao, setThongBao, daGui, luaChon, setLuaChon, dien, dungMau } = useDienAi(onDien);
  const [mo, setMo] = useState(false);
  /** Lần bấm "Xem chỗ vàng" thứ mấy, để mỗi lần bấm nhảy sang chỗ tiếp theo */
  const [lanXem, setLanXem] = useState(0);
  const oNhap = useRef<HTMLTextAreaElement>(null);
  /** Ô bác sĩ đang gõ trước khi mở bong bóng, đóng lại thì trả con trỏ về đó */
  const truocDo = useRef<HTMLElement | null>(null);

  const moRa = () => {
    if (khoa) return;
    truocDo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setMo(true);
  };
  const dong = () => {
    setMo(false);
    truocDo.current?.focus({ preventScroll: true });
  };

  // F2: phím chức năng còn trống trên trình duyệt (F1 trợ giúp, F3 tìm, F5 tải lại), quen tay với phần mềm bệnh viện
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F2" || e.repeat) return;
      e.preventDefault();
      if (mo) dong();
      else moRa();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (mo) oNhap.current?.focus();
  }, [mo]);

  const gui = async () => {
    setThongBao("");
    if (await dien()) {
      setText("");
      setLanXem(0);
      dong();
    }
  };

  const conXem = ketQua?.daDien.filter((item) => get(item.id).nguon === "xem") ?? [];
  const chuMoi = text.trim().length > 0 && text !== daGui;
  const tenGoiY = chuMoi && !loading && !luaChon && !timPhieuMau(text, data.phieuMau) ? goiYTenMau(text, data.phieuMau) : [];

  const giaoDienMic: GiaoDienMic = {
    nut: `inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-semibold disabled:cursor-wait disabled:opacity-70 ${FOCUS}`,
    dangNghe: "border-ef-do bg-ef-do-nhat text-ef-do",
    cho: "border-tim-vien bg-white text-tim hover:bg-tim-nhat",
    nhan: "🎤 Nói",
  };

  const bao = error ?? thongBao;
  const dongBao =
    khe &&
    bao &&
    createPortal(
      <div role="status" className="flex min-w-0 flex-1 items-center gap-3 text-[13px]">
        <span aria-hidden className="text-tim">
          ✨
        </span>
        <p className={`min-w-0 truncate ${error ? "text-ef-do" : "text-ef-chu"}`} title={[thongBao, error].filter(Boolean).join(" ")}>
          {bao}
        </p>
        {conXem.length > 0 && (
          <button
            type="button"
            className={`${NUT_CHU} shrink-0 whitespace-nowrap text-xem`}
            onClick={() => {
              onGoTo(conXem[lanXem % conXem.length].id);
              setLanXem((n) => n + 1);
            }}
          >
            Xem {conXem.length} ô vàng
          </button>
        )}
        {onHoanTac && (
          <button type="button" className={`${NUT_CHU} shrink-0 whitespace-nowrap text-ef-phu`} onClick={onHoanTac}>
            ↶ Hoàn tác
          </button>
        )}
        <button
          type="button"
          aria-label="Ẩn thông báo"
          className={`shrink-0 rounded px-1 text-ef-phu hover:text-ef-chu ${FOCUS}`}
          onClick={() => {
            setThongBao("");
            setError(null);
          }}
        >
          ×
        </button>
      </div>,
      khe,
    );

  return (
    <div className="fixed right-4 bottom-[calc(var(--cao-day)+1rem)] z-40 flex flex-col items-end gap-2 sm:right-6 print:hidden">
      {mo && (
        <div
          role="dialog"
          aria-label="Trợ lý điền phiếu"
          className="w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-tim-vien bg-white text-[13px] shadow-[0_12px_32px_-12px_rgba(26,37,51,0.35)]"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              dong();
            }
          }}
        >
          <div className="flex items-center gap-2 border-b border-tim-vien/60 bg-tim-nhat px-3.5 py-2">
            <span className="font-semibold text-tim">✨ Trợ lý điền phiếu</span>
            <span className="ml-auto text-[11px] text-ef-phu">
              <kbd className={`${KBD} border-ef-vien bg-white`}>Enter</kbd> điền · <kbd className={`${KBD} border-ef-vien bg-white`}>Esc</kbd> đóng
            </span>
          </div>

          <div className="space-y-2.5 p-3.5">
            <textarea
              ref={oNhap}
              aria-label="Lệnh cho trợ lý: tên mẫu, gõ tắt hoặc cả ca"
              rows={2}
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setLuaChon(null);
                onBatDau("go", false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void gui();
                }
              }}
              placeholder="VD: mẫu viêm tai giữa cấp, tai P, 3 ngày"
              className="w-full resize-none rounded-lg border border-ef-vien px-3 py-2 text-sm leading-6 text-ef-chu outline-none placeholder:text-ef-phu/70 focus:border-tim focus:ring-2 focus:ring-tim/20"
            />

            {tenGoiY.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ef-phu">
                <span>Mẫu theo bệnh:</span>
                {tenGoiY.map((mau) => (
                  <button
                    key={mau.id}
                    type="button"
                    className={`${NUT_CHU} text-tim`}
                    onClick={async () => {
                      await dungMau(mau, mau.ten);
                      setText("");
                      dong();
                    }}
                  >
                    {mau.ten}
                  </button>
                ))}
              </div>
            )}

            {luaChon && (
              <div role="group" aria-label="Chọn mẫu" className="space-y-1">
                <p className="text-xs font-semibold text-ef-chu">Tên này khớp nhiều mẫu, chọn một:</p>
                <div className="flex flex-wrap gap-1.5">
                  {luaChon.cacMau.map((mau) => (
                    <button
                      key={mau.id}
                      type="button"
                      className={`rounded-full border border-tim-vien bg-white px-2.5 py-0.5 text-[13px] text-ef-chu hover:bg-tim-nhat ${FOCUS}`}
                      onClick={async () => {
                        await dungMau(mau, text, luaChon.chiTiet, luaChon.goTat);
                        setText("");
                        dong();
                      }}
                    >
                      {mau.ten}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="rounded-md bg-ef-do-nhat px-3 py-2 text-xs text-ef-do">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2">
              <MicButton
                giaoDien={giaoDienMic}
                onStart={() => {
                  setError(null);
                  onBatDau("noi", false);
                }}
                onText={(chunk) => {
                  const cau = suaChu(chunk, data.suaChu);
                  setText((current) => (current ? `${current} ${cau}` : cau));
                }}
              />
              <button
                type="button"
                onClick={() => void gui()}
                disabled={!chuMoi || loading}
                className={`ml-auto inline-flex items-center gap-2 rounded-full bg-tim px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-tim/90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
              >
                {loading && (
                  <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
                )}
                {loading ? "Đang điền…" : "Điền vào phiếu"}
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        aria-expanded={mo}
        aria-keyshortcuts="F2"
        disabled={khoa}
        onClick={() => (mo ? dong() : moRa())}
        className={`inline-flex items-center gap-2 rounded-full bg-tim py-2.5 pr-3 pl-4 text-sm font-semibold text-white shadow-[0_8px_20px_-8px_var(--ai_tim)] hover:bg-tim/90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`}
      >
        {loading && !mo ? (
          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white motion-reduce:animate-none" />
        ) : (
          <span aria-hidden>✨</span>
        )}
        {mo ? "Đóng" : "Trợ lý"}
        <kbd className={`${KBD} border-white/40 bg-white/15 text-white`}>F2</kbd>
      </button>
      {dongBao}
    </div>
  );
}
