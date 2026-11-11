"use client";

import { useState } from "react";
import { useEform } from "@/client/eform/EformContext";
import { BTN_AI, BTN_OUTLINE, SourceBadge, inputClass } from "@/client/eform/fields";
import { tomTatLichSu, type KetQuaTomTat } from "@/shared/eform/tom-tat";
import type { DongLichSu } from "@/shared/eform/types";

interface Props {
  targetId: string;
  targetLabel: string;
  rows: DongLichSu[];
  columnLabel?: string;
}

export function LichSuBlock({ targetId, targetLabel, rows, columnLabel = "Nội dung" }: Props) {
  const { data, append, notify } = useEform();
  const [ketQua, setKetQua] = useState<KetQuaTomTat | null>(null);
  const [draft, setDraft] = useState("");

  if (rows.length === 0) return null;

  const summarize = () => {
    const result = tomTatLichSu(rows, data.quyTac.tom_tat);
    if (!result) {
      notify("Lịch sử không có nội dung để tóm tắt.");
      return;
    }
    setKetQua(result);
    setDraft(result.text);
  };

  const insert = () => {
    if (!ketQua || !draft.trim()) return;
    // Bác sĩ đã sửa đoạn tóm tắt trước khi chèn thì ghi nhận là "Đã sửa"
    append(targetId, draft.trim(), draft === ketQua.text ? "ai" : "sua");
    setKetQua(null);
  };

  return (
    <div className="mt-2">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-ink">Thông tin khai thác {targetLabel.toLowerCase()}</span>
        <SourceBadge nguon="cu" />
        <button type="button" className={BTN_AI} onClick={summarize}>
          ✨ AI tóm tắt
        </button>
      </div>

      {ketQua && (
        <div className="mb-2 rounded border border-tim-vien bg-tim-nhat p-2">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <SourceBadge nguon="ai" />
            <span className="text-xs text-muted">
              Mô phỏng bằng rule · Gộp {ketQua.soLanKham} lần khám thành {ketQua.soY} ý
              {ketQua.boBot > 0 && ` · Lược ${ketQua.boBot} ý cũ hơn, xem bảng bên dưới`}
            </span>
          </div>
          <textarea
            aria-label={`Bản nháp tóm tắt ${targetLabel.toLowerCase()}`}
            rows={4}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={inputClass(null)}
          />
          <p className="mt-1 text-xs text-muted">Bác sĩ đọc và sửa trước khi chèn. Nội dung chỉ lấy từ các dòng lịch sử bên dưới.</p>
          <div className="mt-1.5 flex gap-1.5">
            <button type="button" className={BTN_AI} onClick={insert}>
              Chèn vào ô {targetLabel}
            </button>
            <button type="button" className={BTN_OUTLINE} onClick={() => setKetQua(null)}>
              Bỏ
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-[13px]">
          <thead>
            <tr className="bg-gray-100 text-left text-ink">
              <th className="whitespace-nowrap px-2 py-1 font-medium">Ngày khám</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Bác sĩ</th>
              <th className="whitespace-nowrap px-2 py-1 font-medium">Khoa phòng</th>
              <th className="px-2 py-1 font-medium">{columnLabel}</th>
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.ngay}-${row.noi_dung}`} className="border-t border-gray-200 align-top">
                <td className="whitespace-nowrap px-2 py-1">{row.ngay}</td>
                <td className="whitespace-nowrap px-2 py-1">{row.bac_si}</td>
                <td className="whitespace-nowrap px-2 py-1">{row.khoa}</td>
                <td className="px-2 py-1">{row.noi_dung}</td>
                <td className="px-2 py-1">
                  <button type="button" className={BTN_OUTLINE} onClick={() => append(targetId, row.noi_dung, "cu")}>
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
