"use client";

import { useEform } from "@/client/eform/EformContext";
import { chanDoanChinh } from "@/client/eform/BanIn";
import { BTN_CHINH, BTN_OUTLINE } from "@/client/eform/fields";
import { nhanIcd } from "@/client/eform/IcdField";
import type { DongChiDinh } from "@/shared/eform/dien-phieu";
import { chiaNhom, thanhTien, vnd } from "@/shared/eform/goi-chi-dinh";
import { khoaDong } from "@/shared/eform/goi-y";

export interface ThongTinXacNhan {
  /** Dịch vụ bác sĩ tích đủ điều kiện BHYT, theo khoaDong */
  bhyt: Record<string, boolean>;
  /** null: lấy theo chẩn đoán trên phiếu khám; bác sĩ sửa thì giữ chữ đã sửa */
  chanDoan: string | null;
  buong: string;
  giuong: string;
}

export const XAC_NHAN_TRONG: ThongTinXacNhan = { bhyt: {}, chanDoan: null, buong: "", giuong: "" };

const O = "w-full rounded-md border border-ef-vien bg-white px-2 py-1 text-[13px] outline-none focus:border-ef-xanh focus:ring-2 focus:ring-ef-xanh/20";
const TIEU_DE = "bg-ef-xanh px-3 py-2 font-semibold text-white";

/** Chẩn đoán chính trên phiếu khám, dạng "J38.2 – Hạt xơ dây thanh", kèm mô tả nếu bác sĩ có ghi */
export function chanDoanTuPhieu(get: (id: string) => { value: string }, icd10: Parameters<typeof nhanIcd>[1]): string {
  const { ma, moTa } = chanDoanChinh(get);
  return [ma ? nhanIcd(ma, icd10) : "", moTa].filter(Boolean).join(". ");
}

/**
 * Bước 2 của màn chỉ định EMR (sau Tiếp tục): tích BHYT từng dịch vụ kèm giá, Thông tin chung (chẩn đoán bắt buộc, buồng, giường),
 * Thông tin chỉ định theo nhóm, Tổng số và Thành tiền. Khác EMR: chẩn đoán lấy sẵn từ phiếu khám thay vì gõ lại.
 * Giá là giá giả, bước thanh toán sau Xác nhận chưa làm vì chưa thấy màn thật.
 */
export function XacNhanChiDinh({
  rows,
  onChange,
  thongTin,
  setThongTin,
  onQuayLai,
  onXacNhan,
}: {
  rows: DongChiDinh[];
  onChange: (rows: DongChiDinh[]) => void;
  thongTin: ThongTinXacNhan;
  setThongTin: (patch: Partial<ThongTinXacNhan>) => void;
  onQuayLai: () => void;
  onXacNhan: (tongTien: number) => void;
}) {
  const { data, get } = useEform();
  const bang = data.giaDichVu;
  const nhom = chiaNhom(rows, bang);
  const tongTien = rows.reduce((tong, row) => tong + thanhTien(row, bang), 0);
  const chanDoan = thongTin.chanDoan ?? chanDoanTuPhieu(get, data.icd10);
  const chuaMa = rows.filter((row) => row.nguon === "xem" || !row.ma);
  const loi = rows.length === 0 ? "Chưa có dịch vụ." : !chanDoan.trim() ? "Cần nhập Chẩn đoán/ Lịch sử lâm sàng." : chuaMa.length > 0 ? `Còn ${chuaMa.length} dịch vụ chưa chọn đúng mã, quay lại để chọn.` : "";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="space-y-3">
          <p role="note" className="rounded-md border-2 border-ef-do/60 bg-ef-do-nhat px-3 py-2 font-semibold text-ef-do">
            ⚠ Lưu ý: Tích chọn với các dịch vụ đủ điều kiện thanh toán BHYT
          </p>
          {nhom.map(({ nhom: tenNhom, dong }) => (
            <div key={tenNhom} className="rounded-md border border-ef-vien p-3">
              <h4 className="mb-1.5 text-sm font-semibold text-ef-dam">{tenNhom}</h4>
              <ul>
                {dong.map(({ row, index }, i) => {
                  const khoa = khoaDong(row);
                  return (
                    <li key={`${khoa}-${index}`} className="flex items-start gap-2 border-b border-ef-vien/70 py-1.5 last:border-0">
                      <input
                        type="checkbox"
                        aria-label={`Đủ điều kiện BHYT: ${row.ten}`}
                        className="mt-0.5 accent-ef-xanh"
                        checked={Boolean(thongTin.bhyt[khoa])}
                        onChange={(e) => setThongTin({ bhyt: { ...thongTin.bhyt, [khoa]: e.target.checked } })}
                      />
                      <span className="min-w-0 flex-1">
                        {i + 1}, {row.ma || "Chưa có mã"} – {row.ten}
                        <span className="block text-right text-ef-phu">{vnd(thanhTien(row, bang))}</span>
                      </span>
                      <button
                        type="button"
                        aria-label={`Bỏ ${row.ten}`}
                        onClick={() => onChange(rows.filter((_, j) => j !== index))}
                        className="rounded px-1 text-ef-do hover:bg-ef-do-nhat"
                      >
                        ✖
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-md border border-ef-vien">
          <h4 className={TIEU_DE}>1. Thông tin chung</h4>
          <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 p-3">
            <label htmlFor="cd-chan-doan" className="pt-1 text-right font-medium">
              Chẩn đoán/ Lịch sử lâm sàng <span className="text-ef-do">*</span>
            </label>
            <div>
              <textarea
                id="cd-chan-doan"
                rows={2}
                value={chanDoan}
                onChange={(e) => setThongTin({ chanDoan: e.target.value })}
                className={O}
              />
              {thongTin.chanDoan === null && chanDoan && <span className="text-xs text-ef-phu">Lấy từ chẩn đoán trên phiếu khám.</span>}
            </div>
            <label htmlFor="cd-buong" className="pt-1 text-right font-medium">
              Buồng
            </label>
            <input id="cd-buong" placeholder="Nhập" value={thongTin.buong} onChange={(e) => setThongTin({ buong: e.target.value })} className={O} />
            <label htmlFor="cd-giuong" className="pt-1 text-right font-medium">
              Giường
            </label>
            <input id="cd-giuong" placeholder="Nhập" value={thongTin.giuong} onChange={(e) => setThongTin({ giuong: e.target.value })} className={O} />
          </div>
          <h4 className={TIEU_DE}>2. Thông tin chỉ định dịch vụ</h4>
          <div className="space-y-2 p-3">
            {nhom.map(({ nhom: tenNhom, dong }) => (
              <div key={tenNhom}>
                <h5 className="font-semibold text-ef-dam">{tenNhom}</h5>
                <ul className="mt-1 space-y-1">
                  {dong.map(({ row, index }) => (
                    <li key={`${khoaDong(row)}-${index}`} className="rounded bg-ef-nen px-2 py-1">
                      <span className="font-medium">
                        {row.ma || "Chưa có mã"} – {row.ten}
                      </span>
                      {(row.so_luong !== "1" || row.ghi_chu) && (
                        <span className="text-ef-phu">
                          {row.so_luong !== "1" && ` · SL ${row.so_luong}`}
                          {row.ghi_chu && ` · ${row.ghi_chu}`}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ef-vien pt-3">
        <button type="button" className={BTN_OUTLINE} onClick={onQuayLai}>
          ← Quay lại
        </button>
        <span className="font-semibold text-ef-chu">
          Tổng số: {rows.length} Dịch vụ, Thành tiền: {vnd(tongTien)}
        </span>
        <span className="ml-auto flex flex-wrap gap-2">
          <button type="button" className={BTN_OUTLINE} onClick={() => onChange([])} disabled={rows.length === 0}>
            Hủy toàn bộ dịch vụ
          </button>
          <button type="button" className={BTN_OUTLINE} onClick={onQuayLai}>
            Thêm chỉ định
          </button>
          <button type="button" className={BTN_CHINH} disabled={Boolean(loi)} title={loi || undefined} onClick={() => onXacNhan(tongTien)}>
            Xác nhận chỉ định
          </button>
        </span>
        {loi && rows.length > 0 && <p className="w-full text-right text-xs font-medium text-ef-do">{loi}</p>}
      </div>
    </div>
  );
}
