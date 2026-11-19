// Gói chỉ định (data/eform/goi-chi-dinh.json) và giá, nhóm dịch vụ giả (data/eform/gia-dich-vu.json) cho màn chỉ định.
// Gói chỉ có tên dịch vụ; mã gán ở server bằng src/shared/match.ts, như bộ mẫu theo chẩn đoán.
import { matchCatalog } from "../match";
import { normalizeVi } from "../normalize";
import type { CatalogItem, VietTat } from "../types";
import type { DongChiDinh } from "./dien-phieu";
import { khopMaIcd } from "./goi-y";

export type LoaiGoi = "ca_nhan" | "chia_se";

export interface GoiChiDinhGoc {
  ma: string;
  ten: string;
  loai: LoaiGoi;
  /** Mã ICD10 hoặc tiền tố; để trống thì không bao giờ gợi ý */
  icd: string[];
  dich_vu: string[];
}

export interface GoiChiDinh {
  ma: string;
  ten: string;
  loai: LoaiGoi;
  icd: string[];
  dichVu: DongChiDinh[];
}

export interface BangGiaDichVu {
  mac_dinh: number;
  gia: { tu_khoa: string[]; gia: number }[];
  nhom: { ten: string; tu_khoa: string[] }[];
}

/** Nhóm cuối cùng, dịch vụ không khớp nhóm nào thì vào đây */
export const DICH_VU_CHUNG = "Dịch vụ chung";

/** Gán mã cho từng dịch vụ trong gói, chạy một lần khi nạp trang */
export function khopGoi(goc: GoiChiDinhGoc[], dichVu: CatalogItem[], vietTat: VietTat): GoiChiDinh[] {
  return goc.map((g) => ({
    ma: g.ma,
    ten: g.ten,
    loai: g.loai,
    icd: g.icd,
    dichVu: g.dich_vu.map((ten) => {
      const khop = matchCatalog(ten, null, dichVu, vietTat);
      return {
        ma: khop.item?.ma ?? "",
        ten: khop.item?.ten ?? ten,
        so_luong: "1",
        ghi_chu: "",
        nguon: khop.status === "khop" ? "bs" : "xem",
        ung_vien: khop.candidates,
      };
    }),
  }));
}

/** Mã ICD đầu tiên (theo thứ tự trên phiếu) khớp gói, không có thì null */
export function maHopGoi(goi: GoiChiDinh, maIcd: string[]): string | null {
  return maIcd.find((ma) => goi.icd.some((maGoi) => khopMaIcd(ma, maGoi))) ?? null;
}

/** Gói hợp chẩn đoán lên đầu (theo thứ tự mã trên phiếu), còn lại giữ thứ tự trong file */
export function xepGoi(goi: GoiChiDinh[], maIcd: string[]): { goi: GoiChiDinh; hop: string | null }[] {
  const viTri = (hop: string | null) => (hop ? maIcd.indexOf(hop) : maIcd.length);
  return goi
    .map((g) => ({ goi: g, hop: maHopGoi(g, maIcd) }))
    .sort((a, b) => viTri(a.hop) - viTri(b.hop));
}

/** Cụm từ khớp nguyên từ trong tên (không dấu): "CT" khớp "Chụp CT xoang", không khớp "Electrocochleography" */
const coCum = (ten: string, cum: string) => ` ${normalizeVi(ten)} `.includes(` ${normalizeVi(cum)} `);

export function giaDichVu(ten: string, bang: BangGiaDichVu): number {
  return bang.gia.find((quyTac) => quyTac.tu_khoa.some((cum) => coCum(ten, cum)))?.gia ?? bang.mac_dinh;
}

export function nhomDichVu(ten: string, bang: BangGiaDichVu): string {
  return bang.nhom.find((nhom) => nhom.tu_khoa.some((cum) => coCum(ten, cum)))?.ten ?? DICH_VU_CHUNG;
}

/** Thành tiền một dòng: giá nhân số lượng, số lượng trống hay không phải số thì tính 1 */
export function thanhTien(row: { ten: string; so_luong: string }, bang: BangGiaDichVu): number {
  const soLuong = Number(row.so_luong.replace(",", "."));
  return giaDichVu(row.ten, bang) * (soLuong > 0 ? soLuong : 1);
}

/** Các dòng xếp theo nhóm, giữ thứ tự nhóm trong bảng rồi Dịch vụ chung; nhóm rỗng thì bỏ */
export function chiaNhom<T extends { ten: string }>(rows: T[], bang: BangGiaDichVu): { nhom: string; dong: { row: T; index: number }[] }[] {
  const thuTu = [...bang.nhom.map((nhom) => nhom.ten), DICH_VU_CHUNG];
  return thuTu
    .map((nhom) => ({ nhom, dong: rows.map((row, index) => ({ row, index })).filter(({ row }) => nhomDichVu(row.ten, bang) === nhom) }))
    .filter((g) => g.dong.length > 0);
}

/** 690000 → "690,000 VNĐ", cách viết của EMR */
export const vnd = (soTien: number) => `${soTien.toLocaleString("en-US")} VNĐ`;
