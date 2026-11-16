"use client";

import { useEform } from "@/client/eform/EformContext";
import { goiYIcd } from "@/shared/eform/icd";

const NGUON_GOI_Y = ["benh_su", "kham_toan_than", "kham_chuyen_khoa", "kham_khac"];

interface Props {
  loaiTru?: string[];
  onPick: (ma: string) => void;
}

/** Giao diện gọn: một dòng dưới ô ICD còn trống, tối đa 2 mã, bấm là chọn. Chưa đủ dữ kiện thì không hiện gì */
export function GoiYIcdDong({ loaiTru = [], onPick }: Props) {
  const { data, get } = useEform();
  const text = NGUON_GOI_Y.map((id) => get(id).value).join("\n");
  const goiY = goiYIcd(text, data.icd10, data.quyTac, loaiTru).slice(0, 2);
  if (goiY.length === 0) return null;
  return (
    <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ef-phu">
      <span>Gợi ý theo bệnh sử, khám:</span>
      {goiY.map(({ item, khop }) => (
        <button
          key={item.ma}
          type="button"
          title={`Khớp: ${khop.join(", ")}`}
          onClick={() => onPick(item.ma)}
          className="rounded-full border border-tim-vien bg-white px-2.5 py-0.5 text-[13px] text-ef-chu hover:border-tim hover:bg-tim-nhat focus-visible:outline-2 focus-visible:outline-tim"
        >
          <strong className="font-semibold">{item.ma}</strong> {item.ten}
        </button>
      ))}
    </p>
  );
}

/** Tính lại ở mỗi lần vẽ nên gợi ý đổi ngay khi bác sĩ sửa bệnh sử hoặc khám lâm sàng */
export function GoiYIcdPanel({ loaiTru = [], onPick }: Props) {
  const { data, get } = useEform();
  const text = NGUON_GOI_Y.map((id) => get(id).value).join("\n");
  const goiY = goiYIcd(text, data.icd10, data.quyTac, loaiTru);

  return (
    <div className="mt-2 rounded-lg border border-tim-vien bg-tim-nhat p-3">
      {goiY.length === 0 && <p className="text-[13px] text-ef-chu">Chưa đủ dữ kiện để gợi ý.</p>}
      <div className="space-y-1">
        {goiY.map(({ item, tinCay, khop }) => {
          const percent = Math.round(tinCay * 100);
          return (
            <button
              key={item.ma}
              type="button"
              onClick={() => onPick(item.ma)}
              className="block w-full rounded-md border border-ef-vien bg-white px-3 py-1.5 text-left hover:border-tim focus-visible:outline-2 focus-visible:outline-tim"
            >
              <span className="flex flex-wrap items-center gap-x-2">
                <strong className="text-[13px] text-ef-chu">{item.ma}</strong>
                <span className="text-[13px]">{item.ten}</span>
                <span className="ml-auto flex items-center gap-1.5 text-xs text-ef-phu">
                  <span className="block h-1.5 w-16 overflow-hidden rounded bg-ef-vien">
                    <span className="block h-full rounded bg-tim" style={{ width: `${percent}%` }} />
                  </span>
                  {percent}%
                </span>
              </span>
              <span className="block text-xs text-ef-phu">Khớp: {khop.join(", ")}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
