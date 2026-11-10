"use client";

import { useEform } from "@/components/eform/EformContext";
import { BTN_OUTLINE, SourceBadge } from "@/components/eform/fields";
import type { DongThuoc } from "@/lib/eform/dien-phieu";
import { normalizeVi } from "@/lib/normalize";
import type { CatalogItem } from "@/lib/types";
import { computeTotal } from "@/lib/validate";

const CELL = "w-full rounded-none border border-gray-300 bg-white px-1.5 py-0.5 text-[13px] outline-none focus:border-emr-blue";

/** Nhóm dị ứng → hoạt chất cùng nhóm. Chỉ là ví dụ minh họa, không phải danh sách lâm sàng. */
const NHOM_DI_UNG: Record<string, string[]> = {
  penicillin: ["penicillin", "amoxicillin", "ampicillin", "augmentin"],
};

function trungDiUng(row: DongThuoc, item: CatalogItem | undefined, diUng: string): boolean {
  const nhom = NHOM_DI_UNG[normalizeVi(diUng)] ?? [normalizeVi(diUng)];
  const ten = normalizeVi(`${row.ten} ${item?.hoat_chat ?? ""}`);
  return Boolean(diUng) && nhom.some((chat) => ten.includes(chat));
}

const COT: { key: keyof DongThuoc; nhan: string; rong: string }[] = [
  { key: "duong_dung", nhan: "Đường dùng", rong: "w-24" },
  { key: "lieu_moi_lan", nhan: "Liều/lần", rong: "w-20" },
  { key: "so_lan_ngay", nhan: "Lần/ngày", rong: "w-16" },
  { key: "thoi_diem", nhan: "Thời điểm", rong: "w-24" },
  { key: "so_ngay", nhan: "Số ngày", rong: "w-16" },
];

/** Màn kê đơn theo OH: danh sách thuốc dạng bảng, tổng số lượng tự tính, cảnh báo trùng dị ứng */
export function DonThuocTab({ rows, onChange }: { rows: DongThuoc[]; onChange: (rows: DongThuoc[]) => void }) {
  const { data } = useEform();
  const thuoc = data.danhMuc.thuoc;
  const diUng = data.ca.canh_bao_di_ung;

  const update = (index: number, patch: Partial<DongThuoc>) =>
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, ...patch, nguon: row.nguon === "bs" ? "bs" : "sua", ung_vien: patch.ma ? [] : row.ung_vien } : row,
      ),
    );

  const chon = (item: CatalogItem): Partial<DongThuoc> => ({ ma: item.ma, ten: item.ten, ham_luong: item.ham_luong ?? "" });

  const add = (ma: string) => {
    const item = thuoc.find((t) => t.ma === ma);
    if (!item) return;
    onChange([
      ...rows,
      { ...chon(item), duong_dung: "", lieu_moi_lan: "", so_lan_ngay: "", thoi_diem: "", so_ngay: "", ghi_chu: "", nguon: "bs", ung_vien: [] } as DongThuoc,
    ]);
  };

  return (
    <section className="border border-gray-300 bg-white text-[13px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-300 px-3 py-1.5">
        <span className="font-bold text-emr-blue">Kê đơn ngoại trú</span>
        <span className="text-xs text-muted">(mô phỏng màn Medication ordering)</span>
        {diUng && <span className="ml-auto rounded-sm bg-[#c9302c] px-1.5 text-[11px] font-semibold text-white">Dị ứng: {diUng}</span>}
      </div>

      <div className="space-y-3 p-3">
        <label className="block">
          <span className="mb-1 block font-bold">Tìm thuốc</span>
          <select value="" onChange={(e) => add(e.target.value)} className={CELL}>
            <option value="">Gõ tên thuốc…</option>
            {thuoc.map((t) => (
              <option key={t.ma} value={t.ma}>
                {t.ma} – {t.ten} {t.ham_luong}
              </option>
            ))}
          </select>
        </label>

        <div>
          <div className="mb-1 bg-emr-navy px-2 py-1 font-bold text-white">Đơn thuốc – {rows.length} thuốc</div>
          {rows.length === 0 && <p className="px-2 py-3 text-muted">Chưa có thuốc. Bác sĩ nói đơn thuốc trong cột Trợ lý AI hoặc tìm ở trên.</p>}
          {rows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-left">
                    <th className="border border-gray-200 px-2 py-1">Thuốc</th>
                    {COT.map((cot) => (
                      <th key={cot.key} className={`${cot.rong} border border-gray-200 px-2 py-1`}>
                        {cot.nhan}
                      </th>
                    ))}
                    <th className="w-16 border border-gray-200 px-2 py-1">Tổng SL</th>
                    <th className="border border-gray-200 px-2 py-1">Ghi chú</th>
                    <th className="w-10 border border-gray-200 px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const item = thuoc.find((t) => t.ma === row.ma);
                    const tong = computeTotal(
                      { lieu_moi_lan: row.lieu_moi_lan, so_lan_ngay: row.so_lan_ngay, so_ngay: row.so_ngay },
                      data.canhBao,
                    );
                    const diUngTrung = trungDiUng(row, item, diUng);
                    return (
                      <tr key={`${row.ma}-${index}`} className={`align-top ${row.nguon === "xem" ? "bg-xem-nhat" : row.nguon === "ai" ? "bg-tim-nhat" : ""}`}>
                        <td className="border border-gray-200 px-2 py-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">{row.ten}</span>
                            <span>{row.ham_luong}</span>
                            <SourceBadge nguon={row.nguon} />
                          </div>
                          <div className="text-xs text-muted">{row.ma || "Chưa có mã"}</div>
                          {diUngTrung && (
                            <p role="alert" className="mt-0.5 text-xs font-semibold text-[#c9302c]">
                              ⚠ Bệnh nhân dị ứng {diUng}: thuốc này cùng nhóm, cần cân nhắc.
                            </p>
                          )}
                          {row.nguon === "xem" && (
                            <select
                              aria-label={`Chọn lại thuốc cho "${row.ten}"`}
                              value=""
                              onChange={(e) => {
                                const picked = thuoc.find((t) => t.ma === e.target.value);
                                if (picked) update(index, chon(picked));
                              }}
                              className={`${CELL} mt-1 border-xem`}
                            >
                              <option value="">AI chưa chắc – chọn đúng thuốc…</option>
                              {(row.ung_vien.length > 0 ? row.ung_vien : thuoc).map((t) => (
                                <option key={t.ma} value={t.ma}>
                                  {t.ma} – {t.ten} {t.ham_luong}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        {COT.map((cot) => (
                          <td key={cot.key} className="border border-gray-200 px-2 py-1">
                            <input
                              aria-label={`${cot.nhan} ${row.ten}`}
                              value={String(row[cot.key] ?? "")}
                              onChange={(e) => update(index, { [cot.key]: e.target.value })}
                              className={CELL}
                            />
                          </td>
                        ))}
                        <td className="border border-gray-200 bg-gray-50 px-2 py-1 text-center" title="Tự tính: liều × lần/ngày × số ngày">
                          {tong ?? "–"}
                        </td>
                        <td className="border border-gray-200 px-2 py-1">
                          <input
                            aria-label={`Ghi chú ${row.ten}`}
                            value={row.ghi_chu}
                            onChange={(e) => update(index, { ghi_chu: e.target.value })}
                            className={CELL}
                          />
                        </td>
                        <td className="border border-gray-200 px-2 py-1 text-center">
                          <button
                            type="button"
                            aria-label={`Bỏ ${row.ten}`}
                            onClick={() => onChange(rows.filter((_, i) => i !== index))}
                            className="text-[#c9302c] hover:opacity-70"
                          >
                            ✖
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex items-center border-t border-gray-200 pt-2">
          <span className="font-bold">Tổng số: {rows.length} thuốc</span>
          <button type="button" className={`${BTN_OUTLINE} ml-auto`} onClick={() => onChange([])} disabled={rows.length === 0}>
            Xóa toàn bộ đơn
          </button>
        </div>
      </div>
    </section>
  );
}
