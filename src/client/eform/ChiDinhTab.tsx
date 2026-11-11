"use client";

import { MO_PHONG, useEform } from "@/client/eform/EformContext";
import { BTN_OUTLINE, SourceBadge } from "@/client/eform/fields";
import { GoiYTheoChanDoan } from "@/client/eform/GoiYTheoChanDoan";
import type { DongChiDinh } from "@/shared/eform/dien-phieu";

const CELL = "w-full rounded-md border border-ef-vien bg-white px-2 py-1 text-[13px] outline-none focus:border-ef-xanh focus:ring-2 focus:ring-ef-xanh/20";

/** Màn chỉ định dịch vụ theo EMR: tìm dịch vụ, danh sách đã chọn, tổng số. Dòng AI khớp chưa chắc có ô chọn lại. */
export function ChiDinhTab({ rows, onChange }: { rows: DongChiDinh[]; onChange: (rows: DongChiDinh[]) => void }) {
  const { data, notify } = useEform();
  const dichVu = data.danhMuc.dichVu;

  const update = (index: number, patch: Partial<DongChiDinh>) =>
    onChange(
      rows.map((row, i) =>
        i === index ? { ...row, ...patch, nguon: row.nguon === "bs" ? "bs" : "sua", ung_vien: patch.ma ? [] : row.ung_vien } : row,
      ),
    );

  const add = (ma: string) => {
    const item = dichVu.find((d) => d.ma === ma);
    if (!item || rows.some((row) => row.ma === ma)) return;
    onChange([...rows, { ma: item.ma, ten: item.ten, so_luong: "1", ghi_chu: "", nguon: "bs", ung_vien: [] }]);
  };

  return (
    <section className="rounded-lg border border-ef-vien bg-white text-[13px]">
      <div className="flex gap-1 border-b border-ef-vien px-3">
        <span className="-mb-px border-b-2 border-ef-xanh px-3 py-2.5 font-semibold text-ef-dam">Chỉ định</span>
        {["Lịch sử chỉ định", "ViHC"].map((tab) => (
          <button key={tab} type="button" onClick={() => notify(MO_PHONG)} className="px-3 py-2.5 text-ef-phu hover:text-ef-dam">
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-5">
        <GoiYTheoChanDoan rows={rows} lay={(mau) => mau.chiDinh} onAdd={(moi) => onChange([...rows, ...moi])} />

        <label className="block">
          <span className="mb-1 block font-semibold text-ef-chu">Tìm kiếm dịch vụ</span>
          <select value="" onChange={(e) => add(e.target.value)} className={CELL}>
            <option value="">Gõ để tìm dịch vụ…</option>
            {dichVu
              .filter((d) => !rows.some((row) => row.ma === d.ma))
              .map((d) => (
                <option key={d.ma} value={d.ma}>
                  {d.ma} – {d.ten}
                </option>
              ))}
          </select>
        </label>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-ef-dam">Dịch vụ đã chọn – {rows.length}</h3>
          {rows.length === 0 && <p className="px-2 py-3 text-ef-phu">Chưa có dịch vụ. Bác sĩ nói chỉ định trong cột Trợ lý AI hoặc tìm ở trên.</p>}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-md border border-ef-vien">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead>
                  <tr className="bg-ef-nen text-left text-xs font-semibold text-ef-phu">
                    <th className="border-b border-ef-vien px-2.5 py-2">Mã – Tên dịch vụ</th>
                    <th className="w-20 border-b border-ef-vien px-2.5 py-2">Số lượng</th>
                    <th className="border-b border-ef-vien px-2.5 py-2">Ghi chú</th>
                    <th className="w-10 border-b border-ef-vien px-2.5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`${row.ma}-${index}`} className={`align-top ${row.nguon === "xem" ? "bg-xem-nhat [&>td:first-child]:shadow-[inset_3px_0_0_var(--xem)]" : row.nguon === "ai" ? "bg-tim-nhat [&>td:first-child]:shadow-[inset_3px_0_0_var(--ai_tim)]" : ""}`}>
                      <td className="border-b border-ef-vien px-2.5 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{row.ma || "Chưa có mã"}</span>
                          <span>– {row.ten}</span>
                          <SourceBadge nguon={row.nguon} />
                        </div>
                        {row.nguon === "xem" && (
                          <select
                            aria-label={`Chọn lại dịch vụ cho "${row.ten}"`}
                            value=""
                            onChange={(e) => {
                              const item = dichVu.find((d) => d.ma === e.target.value);
                              if (item) update(index, { ma: item.ma, ten: item.ten });
                            }}
                            className={`${CELL} mt-1.5 border-xem/60`}
                          >
                            <option value="">AI chưa chắc – chọn đúng dịch vụ…</option>
                            {(row.ung_vien.length > 0 ? row.ung_vien : dichVu).map((d) => (
                              <option key={d.ma} value={d.ma}>
                                {d.ma} – {d.ten}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="border-b border-ef-vien px-2.5 py-2">
                        <input
                          aria-label={`Số lượng ${row.ten}`}
                          value={row.so_luong}
                          onChange={(e) => update(index, { so_luong: e.target.value })}
                          className={CELL}
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ef-vien pt-3">
          <span className="font-semibold text-ef-chu">Tổng số: {rows.length} dịch vụ</span>
          <button type="button" className={`${BTN_OUTLINE} ml-auto`} onClick={() => onChange([])} disabled={rows.length === 0}>
            Hủy toàn bộ dịch vụ
          </button>
          <button type="button" className={BTN_OUTLINE} onClick={() => notify("Mô phỏng: đã lưu nháp chỉ định trong trình duyệt.")}>
            Lưu nháp
          </button>
        </div>
      </div>
    </section>
  );
}
