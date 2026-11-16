"use client";

import { useEform } from "@/client/eform/EformContext";
import { BTN_OUTLINE, SourceBadge } from "@/client/eform/fields";
import { GoiYTheoChanDoan } from "@/client/eform/GoiYTheoChanDoan";
import { TimDanhMuc } from "@/client/eform/TimDanhMuc";
import type { DongThuoc } from "@/shared/eform/dien-phieu";
import { trungDiUng } from "@/shared/eform/di-ung";
import type { CatalogItem } from "@/shared/types";
import { computeTotal } from "@/shared/validate";

const CELL = "w-full rounded-md border border-ef-vien bg-white px-2 py-1 text-[13px] outline-none focus:border-ef-xanh focus:ring-2 focus:ring-ef-xanh/20";

type Cot = { key: "duong_dung" | "lieu_moi_lan" | "so_lan_ngay" | "thoi_diem" | "so_ngay"; nhan: string; rong: string };

/** Cột trước và sau ô "Khi cần" */
const COT_TRUOC: Cot[] = [
  { key: "duong_dung", nhan: "Đường dùng", rong: "w-24" },
  { key: "lieu_moi_lan", nhan: "Liều/lần", rong: "w-20" },
];
const COT_SAU: Cot[] = [
  { key: "so_lan_ngay", nhan: "Lần/ngày", rong: "w-16" },
  { key: "thoi_diem", nhan: "Thời điểm", rong: "w-24" },
  { key: "so_ngay", nhan: "Số ngày", rong: "w-16" },
];

function moTaSoLan(row: DongThuoc): string {
  if (!row.lieu_moi_lan) return "";
  if (!row.khi_can) return `${row.lieu_moi_lan} × ${row.so_lan_ngay} lần/ngày`;
  return row.so_lan_ngay ? `${row.lieu_moi_lan} khi cần, tối đa ${row.so_lan_ngay} lần/ngày` : `${row.lieu_moi_lan} khi cần`;
}

export function moTaLieu(row: DongThuoc): string {
  return [row.ham_luong, row.duong_dung, moTaSoLan(row), row.thoi_diem, row.so_ngay && `${row.so_ngay} ngày`, row.so_luong_ke && `SL ${row.so_luong_ke}`, row.ghi_chu]
    .filter(Boolean)
    .join(" · ");
}

/** Màn kê đơn theo OH: danh sách thuốc dạng bảng, tổng số lượng tự tính, cảnh báo trùng dị ứng */
export function DonThuocTab({ rows, onChange }: { rows: DongThuoc[]; onChange: (rows: DongThuoc[]) => void }) {
  const { data, get, append, notify } = useEform();
  const thuoc = data.danhMuc.thuoc;
  const diUng = data.ca.canh_bao_di_ung;

  const update = (index: number, patch: Partial<DongThuoc>) =>
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, ...patch, nguon: row.nguon === "bs" ? "bs" : "sua", ung_vien: patch.ma ? [] : row.ung_vien } : row,
      ),
    );

  const chon = (item: CatalogItem): Partial<DongThuoc> => ({ ma: item.ma, ten: item.ten, ham_luong: item.ham_luong ?? "" });

  const add = (item: CatalogItem) => {
    onChange([
      ...rows,
      { ...chon(item), duong_dung: "", lieu_moi_lan: "", khi_can: false, so_lan_ngay: "", thoi_diem: "", so_ngay: "", so_luong_ke: "", ghi_chu: "", nguon: "bs", ung_vien: [] } as DongThuoc,
    ]);
  };

  return (
    <section className="rounded-lg border border-ef-vien bg-white text-[13px]">
      <div className="flex flex-wrap items-center gap-2 border-b border-ef-vien px-5 py-3">
        <span className="font-semibold text-ef-dam">Kê đơn ngoại trú</span>
        {diUng && <span className="ml-auto rounded-full bg-ef-do px-2.5 py-0.5 text-xs font-semibold text-white">Dị ứng: {diUng}</span>}
      </div>

      <div className="space-y-4 p-5">
        <GoiYTheoChanDoan
          rows={rows}
          lay={(mau) => mau.donThuoc}
          moTa={moTaLieu}
          canhBao={(row) =>
            trungDiUng(row.ten, thuoc.find((t) => t.ma === row.ma), diUng)
              ? `Bệnh nhân dị ứng ${diUng}: thuốc cùng nhóm, không tích sẵn.`
              : null
          }
          onAdd={(moi) => onChange([...rows, ...moi])}
          phuTro={(mau) => {
            if (!mau.loiDan) return null;
            const daChen = get("loi_dan").value.includes(mau.loiDan);
            return (
              <div className="mt-1.5 flex flex-wrap items-start gap-2 border-t border-ef-vien/70 pt-1.5 text-xs">
                <span className="min-w-0 flex-1">
                  <span className="font-semibold">Lời dặn mẫu:</span> {mau.loiDan}
                </span>
                <button
                  type="button"
                  className={BTN_OUTLINE}
                  disabled={daChen}
                  onClick={() => {
                    append("loi_dan", mau.loiDan, "ai");
                    notify("Đã chèn lời dặn mẫu vào ô Lời dặn & theo dõi ở tab Phiếu khám.");
                  }}
                >
                  {daChen ? "Đã chèn" : "Chèn vào Lời dặn"}
                </button>
              </div>
            );
          }}
        />

        <div>
          <span className="mb-1 block font-semibold text-ef-chu">Tìm thuốc</span>
          <TimDanhMuc
            items={thuoc}
            vietTat={data.vietTat}
            onPick={add}
            ariaLabel="Tìm thuốc"
            placeholder={`Gõ tên thuốc, hoạt chất hoặc số đăng ký (${thuoc.length} thuốc)…`}
            className={CELL}
          />
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ef-dam">Đơn thuốc – {rows.length} thuốc</h3>
          {rows.length === 0 && <p className="px-2 py-3 text-ef-phu">Chưa có thuốc. Tìm ở trên, hoặc nói đơn thuốc để Trợ lý AI điền.</p>}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-ef-vien">
              <table className="w-full min-w-[56rem] border-collapse">
                <thead>
                  <tr className="bg-ef-nen text-left text-xs font-semibold text-ef-phu">
                    <th className="border-b border-ef-vien px-2.5 py-2">Thuốc</th>
                    {COT_TRUOC.map((cot) => (
                      <th key={cot.key} className={`${cot.rong} border-b border-ef-vien px-2.5 py-2`}>
                        {cot.nhan}
                      </th>
                    ))}
                    <th className="w-14 border-b border-ef-vien px-2.5 py-2 text-center" title="Thuốc dùng khi đau, khi sốt: lần/ngày là số lần tối đa, có thể để trống">
                      Khi cần
                    </th>
                    {COT_SAU.map((cot) => (
                      <th key={cot.key} className={`${cot.rong} border-b border-ef-vien px-2.5 py-2`}>
                        {cot.nhan}
                      </th>
                    ))}
                    <th className="w-20 border-b border-ef-vien px-2.5 py-2">Tổng SL</th>
                    <th className="border-b border-ef-vien px-2.5 py-2">Ghi chú</th>
                    <th className="w-10 border-b border-ef-vien px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const item = thuoc.find((t) => t.ma === row.ma);
                    const tuTinh = computeTotal(
                      { lieu_moi_lan: row.lieu_moi_lan, so_lan_ngay: row.so_lan_ngay, so_ngay: row.so_ngay },
                      data.canhBao,
                    );
                    const oNhap = (cot: Cot) => (
                      <td key={cot.key} className="border-b border-ef-vien px-2.5 py-2">
                        <input
                          aria-label={`${cot.nhan}${cot.key === "so_lan_ngay" && row.khi_can ? " tối đa" : ""} ${row.ten}`}
                          value={row[cot.key]}
                          placeholder={cot.key === "so_lan_ngay" && row.khi_can ? "tối đa" : undefined}
                          onChange={(e) => update(index, { [cot.key]: e.target.value })}
                          className={CELL}
                        />
                      </td>
                    );
                    const diUngTrung = trungDiUng(row.ten, item, diUng);
                    return (
                      <tr key={`${row.ma}-${index}`} className={`align-top ${row.nguon === "xem" ? "bg-xem-nhat [&>td:first-child]:shadow-[inset_3px_0_0_var(--xem)]" : row.nguon === "ai" ? "bg-tim-nhat [.gon_&]:bg-transparent [&>td:first-child]:shadow-[inset_3px_0_0_var(--ai_tim)]" : ""}`}>
                        <td className="border-b border-ef-vien px-2.5 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-semibold">{row.ten}</span>
                            <span>{row.ham_luong}</span>
                            <SourceBadge nguon={row.nguon} />
                          </div>
                          <div className="text-xs text-ef-phu">{row.ma || "Chưa có mã"}</div>
                          {diUngTrung && (
                            <p role="alert" className="mt-0.5 text-xs font-semibold text-ef-do">
                              ⚠ Bệnh nhân dị ứng {diUng}: thuốc này cùng nhóm, cần cân nhắc.
                            </p>
                          )}
                          {row.nguon === "xem" && (
                            <div className="mt-1.5">
                              <TimDanhMuc
                                items={thuoc}
                                vietTat={data.vietTat}
                                goiY={row.ung_vien}
                                onPick={(picked) => update(index, chon(picked))}
                                ariaLabel={`Chọn lại thuốc cho "${row.ten}"`}
                                placeholder="AI chưa chắc – chọn hoặc gõ để tìm đúng thuốc…"
                                className={`${CELL} border-xem/60`}
                              />
                            </div>
                          )}
                        </td>
                        {COT_TRUOC.map(oNhap)}
                        <td className="border-b border-ef-vien px-2.5 py-2 text-center">
                          <input
                            type="checkbox"
                            aria-label={`Dùng khi cần ${row.ten}`}
                            checked={Boolean(row.khi_can)}
                            onChange={(e) => update(index, { khi_can: e.target.checked })}
                            className="mt-1.5 size-4 accent-ef-xanh"
                          />
                        </td>
                        {COT_SAU.map(oNhap)}
                        <td className="border-b border-ef-vien bg-ef-nen px-2.5 py-2" title="Để trống thì tự tính: liều × lần/ngày × số ngày">
                          <input
                            aria-label={`Tổng số lượng ${row.ten}`}
                            inputMode="numeric"
                            value={row.so_luong_ke ?? ""}
                            placeholder={tuTinh === null ? (row.khi_can ? "nhập" : "–") : String(tuTinh)}
                            onChange={(e) => update(index, { so_luong_ke: e.target.value })}
                            className={`${CELL} text-center tabular-nums ${row.khi_can && !row.so_luong_ke && tuTinh === null ? "border-xem/60" : ""}`}
                          />
                        </td>
                        <td className="border-b border-ef-vien px-2.5 py-2">
                          <input
                            aria-label={`Ghi chú ${row.ten}`}
                            value={row.ghi_chu}
                            onChange={(e) => update(index, { ghi_chu: e.target.value })}
                            className={CELL}
                          />
                        </td>
                        <td className="border-b border-ef-vien px-2.5 py-2 text-center">
                          <button
                            type="button"
                            aria-label={`Bỏ ${row.ten}`}
                            onClick={() => onChange(rows.filter((_, i) => i !== index))}
                            className="rounded px-1 text-ef-do hover:bg-ef-do-nhat"
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

        <div className="flex items-center border-t border-ef-vien pt-3">
          <span className="font-semibold text-ef-chu">Tổng số: {rows.length} thuốc</span>
          <button type="button" className={`${BTN_OUTLINE} ml-auto`} onClick={() => onChange([])} disabled={rows.length === 0}>
            Xóa toàn bộ đơn
          </button>
        </div>
      </div>
    </section>
  );
}
