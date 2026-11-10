"use client";

import { useEform } from "@/components/eform/EformContext";
import { goiYIcd } from "@/lib/eform/icd";

const NGUON_GOI_Y = ["benh_su", "kham_toan_than", "kham_chuyen_khoa", "kham_khac"];

interface Props {
  loaiTru?: string[];
  onPick: (ma: string) => void;
}

/** Tính lại ở mỗi lần vẽ nên gợi ý đổi ngay khi bác sĩ sửa bệnh sử hoặc khám lâm sàng */
export function GoiYIcdPanel({ loaiTru = [], onPick }: Props) {
  const { data, get } = useEform();
  const text = NGUON_GOI_Y.map((id) => get(id).value).join("\n");
  const goiY = goiYIcd(text, data.icd10, data.quyTac, loaiTru);

  return (
    <div className="mt-1.5 rounded border border-tim-vien bg-tim-nhat p-2">
      <p className="mb-1.5 text-xs text-muted">
        ✨ AI gợi ý từ Bệnh sử và Khám lâm sàng. Độ tin cậy mô phỏng từ điểm khớp từ khóa, không phải xác suất bệnh. Bác sĩ bấm để chọn.
      </p>
      {goiY.length === 0 && <p className="text-[13px] text-ink">Chưa đủ dữ kiện để gợi ý.</p>}
      <div className="space-y-1">
        {goiY.map(({ item, tinCay, khop }) => {
          const percent = Math.round(tinCay * 100);
          return (
            <button
              key={item.ma}
              type="button"
              onClick={() => onPick(item.ma)}
              className="block w-full rounded border border-gray-200 bg-white px-2 py-1 text-left hover:border-tim"
            >
              <span className="flex flex-wrap items-center gap-x-2">
                <strong className="text-[13px] text-ink">{item.ma}</strong>
                <span className="text-[13px]">{item.ten}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
                  <span className="block h-1.5 w-16 overflow-hidden rounded bg-gray-200">
                    <span className="block h-full rounded bg-tim" style={{ width: `${percent}%` }} />
                  </span>
                  {percent}%
                </span>
              </span>
              <span className="block text-xs text-muted">Khớp: {khop.join(", ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
