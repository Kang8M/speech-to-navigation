"use client";

import { useState, type ReactNode } from "react";
import { useEform } from "@/client/eform/EformContext";
import { BTN_AI, BTN_OUTLINE, SourceBadge } from "@/client/eform/fields";
import { splitCodes } from "@/client/eform/IcdField";
import { khoaDong as khoa, type MauGoiY } from "@/shared/eform/goi-y";
import { ghepGoiY, hayKe, soLanDaKe } from "@/shared/eform/thoi-quen";
import type { Nguon } from "@/shared/eform/types";

/** Thứ tự lấy mã: chẩn đoán ra viện (xác định) trước, rồi ban đầu, rồi kèm theo */
export const TRUONG_ICD = ["icd_ra_vien", "icd_ban_dau", "icd_kem_theo"];

interface Dong {
  ma: string;
  ten: string;
  nguon: Nguon;
}

interface Props<T extends Dong> {
  /** Dòng đang có trong tab, để đánh dấu "đã có" và không thêm trùng */
  rows: T[];
  lay: (mau: MauGoiY) => T[];
  /** Một dòng mô tả ngắn dưới tên (liều, ghi chú…) */
  moTa?: (row: T) => string;
  /** Trả về câu cảnh báo thì dòng không được tích sẵn */
  canhBao?: (row: T) => string | null;
  onAdd: (rows: T[]) => void;
  /** Phần thêm cho từng bộ mẫu, ví dụ lời dặn */
  phuTro?: (mau: MauGoiY) => ReactNode;
}

/**
 * Gợi ý theo mã ICD10 đang chọn trên phiếu khám. Không tự thêm gì: bác sĩ tích chọn rồi bấm Thêm.
 * Bác sĩ đã từng Lưu đơn cho cùng chẩn đoán chính thì nhóm "Đơn anh/chị đã kê" đứng đầu, chỉ tích sẵn dòng
 * hay kê; khi đó bộ mẫu chung không tích sẵn dòng nào. Dòng tùy chọn của bộ mẫu (thuốc thay thế, xét nghiệm khi cần)
 * không bao giờ tích sẵn.
 * Giao diện gọn: chưa có mã hay chưa có gợi ý thì không hiện gì; có thì một dòng tên các mục tích sẵn và nút Thêm,
 * muốn bỏ bớt thì bấm "Chọn từng mục" để mở danh sách đủ.
 */
export function GoiYTheoChanDoan<T extends Dong>({ rows, lay, moTa, canhBao, onAdd, phuTro }: Props<T>) {
  const { data, get, notify, gon } = useEform();
  const [tich, setTich] = useState<Record<string, boolean>>({});
  const [an, setAn] = useState(false);
  const [moRong, setMoRong] = useState(false);

  const maIcd = [...new Set(TRUONG_ICD.flatMap((id) => splitCodes(get(id).value)))];
  const nhom = ghepGoiY(maIcd, data);
  const coThoiQuen = nhom.some(({ mau }) => mau.cuaToi);
  const daCo = new Set(rows.map(khoa));

  // Mỗi dòng gợi ý: trùng dòng đang có hoặc trùng gợi ý phía trên thì không tích được; có cảnh báo thì bỏ tích sẵn
  const daGap = new Set<string>();
  const danhSach = nhom.map(({ ma, mau }) => ({
    ma,
    mau,
    dong: lay(mau).map((row, i) => {
      const k = khoa(row);
      const trung = daCo.has(k) ? "Đã có trong danh sách" : daGap.has(k) ? "Trùng gợi ý phía trên" : null;
      daGap.add(k);
      const loi = canhBao?.(row) ?? null;
      const id = `${mau.id}:${i}`;
      const tuyChon = Boolean(mau.tuyChon?.includes(k));
      const macDinh = !loi && !tuyChon && (mau.cuaToi ? hayKe(mau, row) : !coThoiQuen);
      return { id, row, trung, loi, tuyChon, chon: !trung && (tich[id] ?? macDinh) };
    }),
  }));
  const daChon = danhSach.flatMap((g) => g.dong.filter((d) => d.chon).map((d) => d.row));

  const them = () => {
    onAdd(daChon.map((row) => ({ ...row })));
    setTich({});
    notify(`Đã thêm ${daChon.length} mục từ gợi ý theo chẩn đoán.`);
  };

  const tenIcd = (ma: string) => data.icd10.find((item) => item.ma === ma)?.ten ?? "";

  if (gon && !moRong) {
    // Dòng bị bỏ tích vì cảnh báo (trùng dị ứng) vẫn phải hiện tên và lý do, không được lặng lẽ biến mất
    const biBo = danhSach.flatMap((g) => g.dong.filter((d) => d.loi && !d.trung && !d.tuyChon));
    // Mục chưa tích (tùy chọn, bộ mẫu chung khi đã có đơn quen) chỉ thấy khi mở danh sách: đếm để bác sĩ biết còn gì
    const soConLai = danhSach.flatMap((g) => g.dong.filter((d) => !d.trung && !d.chon && !d.loi)).length;
    if (daChon.length === 0 && biBo.length === 0 && soConLai === 0) return null;
    const maGoiY = [...new Set(nhom.map((g) => g.ma))].join(", ");
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-tim-vien bg-tim-nhat/60 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-tim">{coThoiQuen ? `Anh/chị hay kê cho ${maGoiY}:` : `Bộ mẫu cho ${maGoiY}:`}</span>{" "}
          {daChon.length > 0 ? daChon.map((row) => row.ten).join(", ") : "không còn mục nào để thêm."}
          {biBo.map(({ id, row, loi }) => (
            <span key={id} role="alert" className="block text-xs font-semibold text-ef-do">
              ⚠ Không lấy {row.ten}: {loi}
            </span>
          ))}
        </span>
        {daChon.length > 0 && (
          <button type="button" className={BTN_AI} onClick={them}>
            Thêm {daChon.length}
          </button>
        )}
        <button type="button" className="text-xs font-medium text-tim underline-offset-2 hover:underline" onClick={() => setMoRong(true)}>
          {soConLai > 0 ? `Chọn từng mục (còn ${soConLai} mục)` : "Chọn từng mục"}
        </button>
      </div>
    );
  }
  if (gon && (maIcd.length === 0 || nhom.length === 0)) return null;

  return (
    <div className="rounded-lg border border-tim-vien bg-tim-nhat p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-bold text-tim">✨ Gợi ý theo chẩn đoán</span>
        {nhom.length > 0 && !gon && (
          <button type="button" className={`${BTN_OUTLINE} ml-auto`} onClick={() => setAn((v) => !v)}>
            {an ? "Hiện" : "Ẩn"}
          </button>
        )}
        {gon && (
          <button type="button" className={`${BTN_OUTLINE} ml-auto`} onClick={() => setMoRong(false)}>
            Thu gọn
          </button>
        )}
      </div>

      {maIcd.length === 0 && (
        <p className="mt-1 text-xs text-ef-phu">
          Chưa có mã ICD10 chẩn đoán. Chọn ở tab Phiếu khám hoặc để Trợ lý AI điền, gợi ý sẽ hiện ở đây.
        </p>
      )}
      {maIcd.length > 0 && nhom.length === 0 && (
        <p className="mt-1 text-xs text-ef-phu">Chưa có bộ mẫu hay đơn anh/chị đã kê cho {maIcd.join(", ")}.</p>
      )}

      {!an && nhom.length > 0 && (
        <div className="mt-2 space-y-2">
          {danhSach.map(({ ma, mau, dong }) => (
            <div key={mau.id} className="rounded-md border border-ef-vien bg-white p-2.5">
              <div className="mb-1 text-xs">
                <span className="font-semibold">
                  {ma} – {tenIcd(ma)}
                </span>
                {mau.cuaToi ? (
                  <span className="font-semibold text-tim"> · {mau.ten} {mau.cuaToi.tongLan} lần trước</span>
                ) : (
                  <span className="text-ef-phu"> · bộ mẫu “{mau.ten}”</span>
                )}
              </div>
              {dong.length === 0 && <p className="text-xs text-ef-phu">Bộ mẫu không có mục nào ở phần này.</p>}
              <ul className="space-y-1">
                {dong.map(({ id, row, trung, loi, tuyChon, chon }) => (
                  <li key={id}>
                    <label className={`flex items-start gap-2 ${trung ? "opacity-60" : "cursor-pointer"}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 accent-tim"
                        checked={chon}
                        disabled={Boolean(trung)}
                        onChange={(e) => setTich((prev) => ({ ...prev, [id]: e.target.checked }))}
                      />
                      <span className="min-w-0">
                        <span className="font-semibold">{row.ma || "Chưa có mã"}</span> – {row.ten}
                        {row.nguon === "xem" && (
                          <span className="ml-1">
                            <SourceBadge nguon="xem" />
                          </span>
                        )}
                        {mau.cuaToi && <span className="ml-1 text-xs font-semibold text-tim">· kê {soLanDaKe(mau, row)}</span>}
                        {tuyChon && <span className="ml-1 text-xs text-ef-phu">· tùy chọn</span>}
                        {moTa && moTa(row) && <span className="block text-xs text-ef-phu">{moTa(row)}</span>}
                        {trung && <span className="block text-xs text-ef-phu">{trung}</span>}
                        {loi && (
                          <span role="alert" className="block text-xs font-semibold text-ef-do">
                            ⚠ {loi}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {phuTro?.(mau)}
            </div>
          ))}
          <button type="button" className={BTN_AI} onClick={them} disabled={daChon.length === 0}>
            Thêm {daChon.length} mục đã chọn
          </button>
        </div>
      )}
    </div>
  );
}
