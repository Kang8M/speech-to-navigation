// Ô lệnh nhanh: bác sĩ gõ một dòng (tên mẫu + chi tiết + mã gõ tắt), xử lý hoàn toàn trên máy, không gọi AI.
import type { PipelineResult } from "../api";
import type { VietTat } from "../types";
import { tachGoTat, type GoTat, type KetQuaGoTat } from "./go-tat";
import { dienChoTrongNhap, ketQuaTheoQuyTac, timPhieuMau, type PhieuMau } from "./phieu-mau";

export interface DuLieuLenh {
  goTat: GoTat[];
  phieuMau: PhieuMau[];
  vietTat: VietTat;
}

export type LenhDien = {
  loai: "dien";
  mau: PhieuMau | null;
  ketQua: PipelineResult | null;
  goTat: KetQuaGoTat;
  /** Vế chi tiết không điền được chỗ trống nào của mẫu, để bác sĩ tự ghi */
  phanDu: string[];
};

export type KetQuaLenh =
  | { loai: "trong" }
  | { loai: "chon_mau"; cacMau: PhieuMau[]; chiTiet: string; goTat: KetQuaGoTat }
  | LenhDien;

const TACH_VE = /[,;.\n]+/;

/** Vế chi tiết dư: bỏ vế đó đi mà kết quả điền chỗ trống không đổi. Giữ nguyên chữ bác sĩ gõ, đúng thứ tự */
export function phanDuChiTiet(mau: PhieuMau, chiTiet: string, vietTat: VietTat): string[] {
  const cacVe = chiTiet.split(TACH_VE).map((ve) => ve.trim()).filter(Boolean);
  const dien = (ve: string[]) => JSON.stringify(dienChoTrongNhap(mau.ketQua.draft, ve.join(", "), vietTat));
  const day = dien(cacVe);
  return cacVe.filter((_, i) => dien(cacVe.filter((__, j) => j !== i)) === day);
}

export function dungMau(mau: PhieuMau, chiTiet: string, goTat: KetQuaGoTat, vietTat: VietTat): LenhDien {
  const co = chiTiet.trim() !== "";
  return {
    loai: "dien",
    mau,
    ketQua: co ? ketQuaTheoQuyTac(mau, chiTiet, vietTat) : mau.ketQua,
    goTat,
    phanDu: co ? phanDuChiTiet(mau, chiTiet, vietTat) : [],
  };
}

export function xuLyLenh(lenh: string, du: DuLieuLenh): KetQuaLenh {
  const goTat = tachGoTat(lenh, du.goTat);
  const conLai = goTat.conLai;
  let goi = timPhieuMau(conLai, du.phieuMau);
  let chiTiet = goi?.conLai ?? "";
  // Không khớp tên trong phần còn lại: thử chẩn đoán vừa bung từ gõ tắt, khi đó chi tiết là cả phần còn lại
  if (!goi && goTat.cacO.chan_doan_chinh) {
    goi = timPhieuMau(goTat.cacO.chan_doan_chinh, du.phieuMau);
    chiTiet = conLai;
  }
  if (goi?.loai === "nhieu") return { loai: "chon_mau", cacMau: goi.cacMau, chiTiet, goTat };
  if (goi) return dungMau(goi.mau, chiTiet, goTat, du.vietTat);
  if (goTat.daDung.length > 0) {
    return { loai: "dien", mau: null, ketQua: null, goTat, phanDu: conLai ? [conLai] : [] };
  }
  return { loai: "trong" };
}
