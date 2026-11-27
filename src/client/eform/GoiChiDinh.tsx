"use client";

import { useEffect, useRef, useState } from "react";
import { MO_PHONG, useEform } from "@/client/eform/EformContext";
import { BTN_AI, BTN_CHINH, BTN_OUTLINE } from "@/client/eform/fields";
import { TRUONG_ICD } from "@/client/eform/GoiYTheoChanDoan";
import { splitCodes } from "@/client/eform/IcdField";
import type { DongChiDinh } from "@/shared/eform/dien-phieu";
import { xepGoi, type GoiChiDinh as Goi, type LoaiGoi } from "@/shared/eform/goi-chi-dinh";
import { khoaDong } from "@/shared/eform/goi-y";
import { normalizeVi } from "@/shared/normalize";

const LOAI: { id: LoaiGoi; ten: string }[] = [
  { id: "ca_nhan", ten: "Gói cá nhân" },
  { id: "chia_se", ten: "Gói được chia sẻ" },
];

const tenGoi = (goi: Goi) => `${goi.ma} – ${goi.ten}`;

/**
 * Khu Gói chỉ định như EMR: chọn loại gói, gõ tìm, lưới gói, bấm một gói để xem trước rồi Chọn gói.
 * Thêm so với EMR: gói hợp chẩn đoán trên phiếu khám đứng đầu lưới và có dòng mở nhanh; trong popup bỏ tích được từng dịch vụ,
 * dịch vụ đã có trong danh sách thì không thêm lại.
 */
export function GoiChiDinh({ rows, onAdd }: { rows: DongChiDinh[]; onAdd: (rows: DongChiDinh[]) => void }) {
  const { data, get, notify } = useEform();
  const [mo, setMo] = useState(true);
  const [loai, setLoai] = useState<Record<LoaiGoi, boolean>>({ ca_nhan: true, chia_se: true });
  const [tim, setTim] = useState("");
  const [xem, setXem] = useState<Goi | null>(null);

  const maIcd = [...new Set(TRUONG_ICD.flatMap((id) => splitCodes(get(id).value)))];
  const tuKhoa = normalizeVi(tim);
  const danhSach = xepGoi(data.goiChiDinh, maIcd).filter(
    ({ goi }) => loai[goi.loai] && (!tuKhoa || normalizeVi(tenGoi(goi)).includes(tuKhoa)),
  );
  const hop = xepGoi(data.goiChiDinh, maIcd).filter((item) => item.hop);

  return (
    <div className="rounded-md border border-ef-vien">
      <button
        type="button"
        aria-expanded={mo}
        onClick={() => setMo((v) => !v)}
        className="flex w-full items-center gap-2 rounded-t-md bg-ef-xanh px-3 py-2 text-left font-semibold text-white"
      >
        <span aria-hidden>{mo ? "︽" : "︾"}</span>
        Gói chỉ định
      </button>
      {mo && (
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-ef-phu">Gói chỉ định</span>
            {LOAI.map(({ id, ten }) => (
              <button
                key={id}
                type="button"
                aria-pressed={loai[id]}
                onClick={() => setLoai((prev) => ({ ...prev, [id]: !prev[id] }))}
                className={`rounded border px-2 py-0.5 ${loai[id] ? "border-ef-xanh bg-ef-xanh-nhat font-medium text-ef-dam" : "border-ef-vien text-ef-phu line-through"}`}
              >
                {ten}
              </button>
            ))}
            <input
              aria-label="Tìm gói chỉ định"
              placeholder="Gõ để tìm kiếm…"
              value={tim}
              onChange={(e) => setTim(e.target.value)}
              className="min-w-40 flex-1 rounded-md border border-ef-vien px-2 py-1 outline-none focus:border-ef-xanh"
            />
            <button type="button" className={BTN_OUTLINE} onClick={() => notify(MO_PHONG)}>
              Tạo gói cá nhân mới
            </button>
          </div>

          {hop.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-tim-vien bg-tim-nhat/60 px-3 py-2">
              <span className="font-semibold text-tim">✨ Gói hợp chẩn đoán {[...new Set(hop.map((item) => item.hop))].join(", ")}:</span>
              {hop.map(({ goi }) => (
                <button key={goi.ma} type="button" className={BTN_AI} onClick={() => setXem(goi)}>
                  {tenGoi(goi)} ({goi.dichVu.length})
                </button>
              ))}
            </div>
          )}

          {danhSach.length === 0 ? (
            <p className="px-1 text-ef-phu">Không có gói nào khớp.</p>
          ) : (
            <ul className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
              {danhSach.map(({ goi, hop: maHop }) => (
                <li key={goi.ma}>
                  <button
                    type="button"
                    onClick={() => setXem(goi)}
                    className={`h-full w-full rounded-md border px-2.5 py-1.5 text-left hover:border-ef-xanh ${maHop ? "border-tim-vien bg-tim-nhat/50" : "border-ef-vien"}`}
                  >
                    <span className="block font-medium">{tenGoi(goi)}</span>
                    <span className="text-xs text-ef-phu">
                      {goi.dichVu.length} dịch vụ · {goi.loai === "ca_nhan" ? "cá nhân" : "chia sẻ"}
                      {maHop && <span className="font-semibold text-tim"> · ✨ hợp {maHop}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {xem && (
        <XemGoi
          goi={xem}
          daCo={new Set(rows.map(khoaDong))}
          onClose={() => setXem(null)}
          onChon={(chon) => {
            onAdd(chon);
            notify(`Đã thêm ${chon.length} dịch vụ từ gói ${tenGoi(xem)}.`);
          }}
        />
      )}
    </div>
  );
}

/** Popup xem trước gói như EMR (Hủy · Chọn gói), thêm ô bỏ tích từng dịch vụ */
function XemGoi({ goi, daCo, onClose, onChon }: { goi: Goi; daCo: Set<string>; onClose: () => void; onChon: (rows: DongChiDinh[]) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [bo, setBo] = useState<Record<number, boolean>>({});

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const chon = goi.dichVu.filter((row, i) => !daCo.has(khoaDong(row)) && !bo[i]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-label={`Gói ${tenGoi(goi)}`}
      className="m-auto w-full max-w-xl rounded-xl p-0 text-[13px] text-ef-chu shadow-xl backdrop:bg-ef-dam/40"
    >
      <h2 className="bg-ef-xanh px-4 py-2.5 text-center text-sm font-bold uppercase text-white">{tenGoi(goi)}</h2>
      <ol className="max-h-[60vh] overflow-y-auto px-4 py-2">
        {goi.dichVu.map((row, i) => {
          const coRoi = daCo.has(khoaDong(row));
          return (
            <li key={`${row.ma}-${i}`} className="border-b border-ef-vien/70 py-1.5 last:border-0">
              <label className={`flex items-start gap-2 ${coRoi ? "opacity-60" : "cursor-pointer"}`}>
                <input
                  type="checkbox"
                  className="mt-0.5 accent-ef-xanh"
                  checked={!coRoi && !bo[i]}
                  disabled={coRoi}
                  onChange={(e) => setBo((prev) => ({ ...prev, [i]: !e.target.checked }))}
                />
                <span>
                  {i + 1}, {row.ma} – {row.ten}
                  {coRoi && <span className="block text-xs text-ef-phu">Đã có trong danh sách</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ol>
      <div className="flex gap-2 border-t border-ef-vien px-4 py-3">
        <button type="button" className={`${BTN_OUTLINE} flex-1`} onClick={() => ref.current?.close()}>
          Hủy
        </button>
        <button
          type="button"
          className={`${BTN_CHINH} flex-1`}
          disabled={chon.length === 0}
          onClick={() => {
            onChon(chon.map((row) => ({ ...row })));
            ref.current?.close();
          }}
        >
          Chọn gói ({chon.length})
        </button>
      </div>
    </dialog>
  );
}
