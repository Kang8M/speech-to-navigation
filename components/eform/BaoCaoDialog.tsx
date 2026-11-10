"use client";

import { useEffect, useRef } from "react";
import { useEform } from "@/components/eform/EformContext";
import { BTN_OUTLINE, SourceBadge } from "@/components/eform/fields";
import { splitCodes } from "@/components/eform/IcdField";
import { demChoTrong } from "@/lib/eform/mau-cau";

/** Các trường "hiển thị trên BCYT", theo thứ tự xuất hiện trên form */
const TRUONG_BCYT = [
  { id: "ly_do", label: "Lý do đến khám" },
  { id: "benh_su", label: "Bệnh sử" },
  { id: "kham_toan_than", label: "Khám toàn thân" },
  { id: "kham_chuyen_khoa", label: "Khám chuyên khoa" },
  { id: "kham_khac", label: "Khám các bộ phận khác" },
  { id: "ghi_chu_kq", label: "Xét nghiệm, thăm dò chính" },
  { id: "huong_dieu_tri", label: "Hướng điều trị" },
  { id: "loi_dan", label: "Lời dặn & theo dõi" },
];

/** Xem trước báo cáo y tế: ghép thẳng các trường có nhãn BCYT, giữ nhãn nguồn để thấy phần AI thêm */
export function BaoCaoDialog({ onClose }: { onClose: () => void }) {
  const { data, get } = useEform();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const kemTheo = get("icd_kem_theo");

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label="Xem trước báo cáo y tế"
      className="m-auto w-full max-w-2xl rounded-lg p-4 text-ink backdrop:bg-black/40"
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-emr-navy">Báo cáo y tế – xem trước (DỮ LIỆU GIẢ)</h2>
        <button type="button" className={BTN_OUTLINE} onClick={() => ref.current?.close()}>
          Đóng
        </button>
      </div>
      <div className="space-y-3 text-[13px]">
        {TRUONG_BCYT.map(({ id, label }) => {
          const field = get(id);
          return (
            <div key={id}>
              <div className="flex items-center gap-1.5 font-medium text-ink">
                {label} <SourceBadge nguon={field.nguon} />
              </div>
              <p className="whitespace-pre-wrap">{field.value || <span className="text-muted">(trống)</span>}</p>
              {demChoTrong(field.value) > 0 && (
                <p className="text-xs text-warn-text">⚠ Còn {demChoTrong(field.value)} chỗ [ ] chưa chọn, sẽ đi thẳng vào báo cáo nếu không sửa.</p>
              )}
            </div>
          );
        })}
        <div>
          <div className="flex items-center gap-1.5 font-medium text-ink">
            Chẩn đoán kèm theo <SourceBadge nguon={kemTheo.nguon} />
          </div>
          {kemTheo.value ? (
            <p>
              {splitCodes(kemTheo.value)
                .map((code) => `${code} – ${data.icd10.find((item) => item.ma === code)?.ten}`)
                .join("; ")}
            </p>
          ) : (
            <p className="text-muted">(trống)</p>
          )}
        </div>
      </div>
    </dialog>
  );
}
