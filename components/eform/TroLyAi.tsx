"use client";

import { useState } from "react";
import { MicButton } from "@/components/MicButton";
import { useEform } from "@/components/eform/EformContext";
import { BTN_OUTLINE } from "@/components/eform/fields";
import type { KetQuaDien } from "@/lib/eform/dien-phieu";
import type { PipelineResult } from "@/lib/pipeline";

export type TabId = "phieu" | "chi_dinh" | "don_thuoc";

interface Props {
  ketQua: KetQuaDien | null;
  /** Mỗi lần AI điền: trả kết quả để màn hình áp vào phiếu */
  onDien: (result: PipelineResult) => void;
  onHoanTac: (() => void) | null;
  onGoTo: (id: string) => void;
  onOpenTab: (tab: TabId) => void;
  soChiDinh: number;
  soThuoc: number;
}

/** Cột phải: bác sĩ nói hoặc gõ tắt một lần, AI điền cả phiếu khám, chỉ định và đơn thuốc */
export function TroLyAi({ ketQua, onDien, onHoanTac, onGoTo, onOpenTab, soChiDinh, soThuoc }: Props) {
  const { data, get, put } = useEform();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function dien() {
    if (!text.trim() || loading) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "AI không điền được phiếu.");
      onDien(body as PipelineResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI không điền được phiếu.");
    } finally {
      setLoading(false);
    }
  }

  // Trường AI chưa chắc mà bác sĩ đã sửa thì không còn ở trạng thái "xem"
  const conXem = ketQua?.daDien.filter((item) => get(item.id).nguon === "xem") ?? [];
  const daXong = ketQua?.daDien.filter((item) => get(item.id).nguon !== "xem") ?? [];

  return (
    <aside className="flex flex-col gap-3 border-l border-tim-vien bg-[#faf8ff] p-3 text-[13px] lg:sticky lg:top-[7.5rem] lg:max-h-[calc(100vh-7.5rem-6.5rem)] lg:overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-tim">✨ Trợ lý AI điền phiếu</h2>
        <span className="rounded-sm bg-white px-1.5 text-[11px] text-muted" title="Đổi trong .env.local (LLM_PROVIDER)">
          Chế độ AI: <strong>{data.provider}</strong>
        </span>
      </div>
      <p className="text-xs text-muted">
        Nói trong lúc khám hoặc gõ tắt một đoạn. AI điền nháp phiếu khám, chỉ định và đơn thuốc. Bác sĩ duyệt, sửa rồi bấm Lưu.
      </p>

      <MicButton onStart={() => setError(null)} onText={(chunk) => setText((current) => (current ? `${current} ${chunk}` : chunk))} />

      <textarea
        aria-label="Nội dung bác sĩ nói hoặc gõ tắt"
        rows={7}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="VD: LD: đau tai P 4n. TMH: ống tai P có mủ… CĐ: … CLS: NS tai… Đơn: … Hẹn: sau 7n."
        className="w-full border border-tim-vien bg-white px-2 py-1 text-[13px] outline-none focus:border-tim focus:ring-1 focus:ring-tim"
      />

      <div className="flex flex-wrap gap-1.5">
        <button type="button" className={BTN_OUTLINE} onClick={() => setText(data.cauMau.noi)} disabled={!data.cauMau.noi}>
          Câu mẫu (nói)
        </button>
        <button type="button" className={BTN_OUTLINE} onClick={() => setText(data.cauMau.goTat)} disabled={!data.cauMau.goTat}>
          Câu mẫu (gõ tắt)
        </button>
        <button type="button" className={BTN_OUTLINE} onClick={() => setText("")} disabled={!text}>
          Xóa
        </button>
      </div>

      <button
        type="button"
        onClick={dien}
        disabled={!text.trim() || loading}
        className="rounded-sm bg-tim py-2 text-sm font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? "AI đang điền…" : "✨ Điền vào phiếu"}
      </button>

      {error && (
        <p role="alert" className="text-xs text-warn-text">
          {error}
        </p>
      )}

      {ketQua && (
        <div className="space-y-2 border-t border-tim-vien pt-2">
          <p className="font-bold text-ink">
            Đã điền {ketQua.daDien.length} trường
            {conXem.length > 0 && <span className="text-xem"> · {conXem.length} cần xem lại</span>}
          </p>

          {conXem.length > 0 && (
            <ul className="space-y-1">
              {conXem.map((item) => (
                <li key={item.id} className="flex items-center gap-1.5 border border-xem bg-xem-nhat px-2 py-1">
                  <span className="flex-1">⚠ {item.nhan}</span>
                  <button type="button" className="text-xs text-tim underline" onClick={() => onGoTo(item.id)}>
                    xem →
                  </button>
                  <button
                    type="button"
                    className="text-xs text-ink underline"
                    title="Giá trị đã đúng, bỏ đánh dấu cần xem lại"
                    onClick={() => put(item.id, get(item.id).value, "ai")}
                  >
                    ✓ Đúng
                  </button>
                </li>
              ))}
            </ul>
          )}

          <ul className="space-y-0.5">
            {daXong.map((item) => (
              <li key={item.id} className="flex items-center gap-1.5 border-b border-gray-100 py-0.5">
                <span className="flex-1">✓ {item.nhan}</span>
                <button type="button" className="text-xs text-tim underline" onClick={() => onGoTo(item.id)}>
                  xem →
                </button>
              </li>
            ))}
          </ul>

          {ketQua.boQua.length > 0 && (
            <p className="text-xs text-muted">Giữ nguyên nội dung bác sĩ đã nhập: {ketQua.boQua.join(", ")}.</p>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className={BTN_OUTLINE} onClick={() => onOpenTab("chi_dinh")}>
              Chỉ định: {soChiDinh} dịch vụ →
            </button>
            <button type="button" className={BTN_OUTLINE} onClick={() => onOpenTab("don_thuoc")}>
              Đơn thuốc: {soThuoc} thuốc →
            </button>
          </div>

          {onHoanTac && (
            <button type="button" className={`${BTN_OUTLINE} w-full`} onClick={onHoanTac}>
              ↶ Hoàn tác lần AI điền
            </button>
          )}
        </div>
      )}

      <p className="mt-auto text-[11px] text-muted">
        Mã ICD10, mã dịch vụ và mã thuốc do code khớp danh mục gán, không do AI tự nghĩ ra. Gợi ý ICD10 chỉ là điểm khớp từ khóa.
      </p>
    </aside>
  );
}
