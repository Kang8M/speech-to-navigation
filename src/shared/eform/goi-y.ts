// Gợi ý chỉ định và đơn thuốc theo chẩn đoán ICD10, từ bộ mẫu data/eform/goi-y-theo-chan-doan.json.
// Bộ mẫu chỉ có tên; mã gán ở server bằng src/shared/match.ts, khớp chưa chắc thì dòng được đánh dấu "xem".
import { matchCatalog } from "../match";
import type { CatalogItem, VietTat } from "../types";
import type { DongChiDinh, DongThuoc } from "./dien-phieu";

type DongThuocMau = Partial<Omit<DongThuoc, "ma" | "nguon" | "ung_vien">> & { ten: string };

export interface MauGoiYGoc {
  id: string;
  ten: string;
  /** Mã ICD10, hoặc tiền tố ("H66" khớp H66.0, H66.1…) */
  icd: string[];
  /** tuy_chon: hiện trong danh sách nhưng không tích sẵn (thuốc thay thế, xét nghiệm khi cần) */
  chi_dinh: { ten: string; so_luong?: string; ghi_chu?: string; tuy_chon?: boolean }[];
  don_thuoc: (DongThuocMau & { tuy_chon?: boolean })[];
  loi_dan?: string;
}

export interface MauGoiY {
  id: string;
  ten: string;
  icd: string[];
  chiDinh: DongChiDinh[];
  donThuoc: DongThuoc[];
  loiDan: string;
  /** Chỉ có ở nhóm "Đơn anh/chị đã kê" (src/shared/eform/thoi-quen.ts): số lần đã kê, theo mã hoặc tên dòng */
  cuaToi?: { tongLan: number; soLan: Record<string, number> };
  /** Khóa (`khoaDong`) của các dòng tùy chọn: hiện nhưng không tích sẵn */
  tuyChon?: string[];
}

/** Khóa một dòng chỉ định hay thuốc: mã, chưa có mã thì tên chữ thường */
export const khoaDong = (row: { ma: string; ten: string }) => row.ma || row.ten.toLowerCase();

/**
 * Mã trên phiếu khớp mã hoặc tiền tố trong bộ mẫu: "H66" khớp "H66.0" (không khớp "H660"), "S02.2" khớp "S02.20",
 * "J35.0" chỉ khớp "J35.0" và mã con của nó
 */
export const khopMaIcd = (maPhieu: string, maMau: string) =>
  maPhieu === maMau || (maPhieu.startsWith(maMau) && (maMau.includes(".") || maPhieu[maMau.length] === "."));

/** Gán mã cho từng dòng của bộ mẫu bằng code khớp danh mục, chạy một lần khi nạp trang */
export function khopBoMau(
  mau: MauGoiYGoc[],
  danhMuc: { dichVu: CatalogItem[]; thuoc: CatalogItem[] },
  vietTat: VietTat,
): MauGoiY[] {
  return mau.map((m) => khopMotBo(m, danhMuc, vietTat));
}

function khopMotBo(m: MauGoiYGoc, danhMuc: { dichVu: CatalogItem[]; thuoc: CatalogItem[] }, vietTat: VietTat): MauGoiY {
  const bo: MauGoiY = {
    id: m.id,
    ten: m.ten,
    icd: m.icd,
    loiDan: m.loi_dan ?? "",
    chiDinh: m.chi_dinh.map((dong) => {
      const khop = matchCatalog(dong.ten, null, danhMuc.dichVu, vietTat);
      return {
        ma: khop.item?.ma ?? "",
        ten: khop.item?.ten ?? dong.ten,
        so_luong: dong.so_luong ?? "1",
        ghi_chu: dong.ghi_chu ?? "",
        nguon: khop.status === "khop" ? "ai" : "xem",
        ung_vien: khop.candidates,
      };
    }),
    donThuoc: m.don_thuoc.map((dong) => {
      const khop = matchCatalog(dong.ten, dong.ham_luong, danhMuc.thuoc, vietTat);
      return {
        ma: khop.item?.ma ?? "",
        ten: khop.item?.ten ?? dong.ten,
        ham_luong: khop.item?.ham_luong ?? dong.ham_luong ?? "",
        duong_dung: dong.duong_dung ?? "",
        lieu_moi_lan: dong.lieu_moi_lan ?? "",
        so_lan_ngay: dong.so_lan_ngay ?? "",
        thoi_diem: dong.thoi_diem ?? "",
        so_ngay: dong.so_ngay ?? "",
        ghi_chu: dong.ghi_chu ?? "",
        nguon: khop.status === "khop" ? "ai" : "xem",
        ung_vien: khop.candidates,
      };
    }),
  };
  const tuyChon = [
    ...bo.chiDinh.filter((_, i) => m.chi_dinh[i].tuy_chon),
    ...bo.donThuoc.filter((_, i) => m.don_thuoc[i].tuy_chon),
  ].map(khoaDong);
  return tuyChon.length ? { ...bo, tuyChon } : bo;
}

/** Bộ mẫu khớp các mã ICD10 đang chọn (đúng mã hoặc theo tiền tố), theo thứ tự mã (chẩn đoán chính trước), không lặp */
export function chonBoMau(maIcd: string[], boMau: MauGoiY[]): { ma: string; mau: MauGoiY }[] {
  const daChon = new Set<string>();
  const ketQua: { ma: string; mau: MauGoiY }[] = [];
  for (const ma of maIcd) {
    for (const mau of boMau) {
      if (mau.icd.some((maMau) => khopMaIcd(ma, maMau)) && !daChon.has(mau.id)) {
        daChon.add(mau.id);
        ketQua.push({ ma, mau });
      }
    }
  }
  return ketQua;
}
