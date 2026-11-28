// Đổ kết quả AI (/api/extract) vào phiếu eForm, chỉ định và đơn thuốc.
// Mã ICD10 không lấy từ LLM: code chấm điểm từ khóa gán mã và luôn đánh dấu "cần xem lại".
import type { MatchResult, RowMatches } from "../match";
import type { CatalogItem, Draft, FieldValue, Values } from "../types";
import { goiYIcd, maIcdTheoTen } from "./icd";
import { demChoTrong } from "./mau-cau";
import type { EformData, Nguon, Truong } from "./types";

export interface DongChiDinh {
  /** Stable clinical ID after the first save. */
  id?: string;
  vi_tri?: string;
  ben?: "phai" | "trai" | "hai_ben" | "khong_ap_dung" | null;
  ma: string;
  ten: string;
  so_luong: string;
  ghi_chu: string;
  nguon: Nguon;
  /** Danh mục gần đúng khi AI khớp chưa chắc */
  ung_vien: CatalogItem[];
  /** Dòng do AI điền (giữ cả khi bác sĩ sửa), để đếm số đo lượt thử */
  tu_ai?: boolean;
}

export interface DongThuoc {
  ma: string;
  ten: string;
  ham_luong: string;
  duong_dung: string;
  lieu_moi_lan: string;
  /** Thuốc dùng khi cần (khi đau, khi sốt): số lần/ngày là số lần tối đa, có thể để trống */
  khi_can?: boolean;
  so_lan_ngay: string;
  thoi_diem: string;
  so_ngay: string;
  /** Tổng số lượng bác sĩ nói rõ hoặc tự gõ; trống thì tự tính */
  so_luong_ke?: string;
  ghi_chu: string;
  nguon: Nguon;
  ung_vien: CatalogItem[];
  tu_ai?: boolean;
}

const LA_KHI_CAN = /^(?:khi|lúc|nếu)\s/iu;

/** Bộ mẫu cũ chỉ ghi "Khi đau", "Khi sốt" ở thời điểm dùng: coi như thuốc dùng khi cần */
export function laKhiCan(row: { khi_can?: boolean | string | null; thoi_diem?: string | null }): boolean {
  return row.khi_can === true || row.khi_can === "Có" || LA_KHI_CAN.test((row.thoi_diem ?? "").trim());
}

export interface MucDaDien {
  id: string;
  nhan: string;
  nguon: Nguon;
}

export interface KetQuaDien {
  truong: Record<string, Truong>;
  daDien: MucDaDien[];
  /** Nhãn các trường bỏ qua vì bác sĩ đã tự nhập */
  boQua: string[];
  chiDinh: DongChiDinh[];
  donThuoc: DongThuoc[];
}

/** Trường văn bản của config/forms/phieu-kham.json → trường eForm */
const ANH_XA: { tu: string; den: string; nhan: string }[] = [
  { tu: "ly_do_kham", den: "ly_do", nhan: "Lý do đến khám" },
  { tu: "benh_su", den: "benh_su", nhan: "Bệnh sử" },
  { tu: "tien_su", den: "tien_su_ban_than", nhan: "Tiền sử bản thân" },
  { tu: "kham_toan_than", den: "kham_toan_than", nhan: "Khám toàn thân" },
  { tu: "kham_chuyen_khoa", den: "kham_chuyen_khoa", nhan: "Khám chuyên khoa TMH" },
  { tu: "huong_dieu_tri", den: "huong_dieu_tri", nhan: "Hướng điều trị" },
  { tu: "loi_dan", den: "loi_dan", nhan: "Lời dặn & theo dõi" },
];

const DON_VI_NGAY: Record<string, number> = { ngày: 1, tuần: 7, tháng: 30 };

function chu(value: FieldValue | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function ngayTaiKham(hen: string, thoiGianKham: string): string | null {
  const found = hen.toLowerCase().match(/(\d+)\s*(ngày|tuần|tháng)/u);
  if (!found) return null;
  const base = thoiGianKham ? new Date(thoiGianKham) : new Date();
  if (Number.isNaN(base.getTime())) return null;
  base.setDate(base.getDate() + Number(found[1]) * DON_VI_NGAY[found[2]]);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
}

function nguonDong(match: MatchResult | undefined): Nguon {
  return !match || match.status === "khop" ? "ai" : "xem";
}

/** Ô chọn có sẵn giá trị mặc định ("Không") chưa phải chữ ai gõ: phiếu mẫu vẫn được điền, trừ khi bác sĩ đã chọn */
const O_CHON_MAC_DINH = new Set(["hen_tai_kham", "co_pttt", "da_xu_ly", "tinh_trang_ra_vien"]);

/** Nhãn các ô phiếu mẫu điền thẳng (o_khac), schema LLM không có */
const NHAN_O_KHAC: Record<string, string> = {
  ghi_chu_kq: "Ghi chú kết quả",
  co_pttt: "Có phẫu thuật/thủ thuật",
  da_xu_ly: "Đã xử lý (thuốc, chăm sóc)",
  tinh_trang_ra_vien: "Tình trạng ra viện",
};

/** Ngày "dd/mm/yyyy" thành số so sánh được */
const soNgay = (ngay: string) => Number(ngay.split("/").reverse().join("")) || 0;

/** Dòng lịch sử mới nhất */
function moiNhat<T extends { ngay: string }>(rows: T[]): T | undefined {
  return [...rows].sort((a, b) => soNgay(b.ngay) - soNgay(a.ngay))[0];
}

export interface TuyChonDien {
  /** Current scope: clinical note/services only; do not duplicate an initial diagnosis at discharge. */
  clinicalOnly?: boolean;
  /** Chỉ có hiệu lực cùng clinicalOnly: vẫn điền dòng thuốc (phiếu mẫu do bác sĩ gọi, không phải AI) */
  kemThuoc?: boolean;
  /** Phiếu mẫu: chỉ điền ô còn trống, ô đã có chữ (kể cả dữ liệu cũ, AI điền trước) giữ nguyên */
  chiOTrong?: boolean;
  /** Mã ICD10 đã tra sẵn (phiếu mẫu), dùng thay cho gợi ý theo từ khóa */
  icd?: string;
  /** Phiếu mẫu: các ô schema LLM không có (o_khac), khóa là id ô eForm */
  oKhac?: Record<string, string>;
  /** Phiếu mẫu: tiền sử, dị ứng còn trống thì chép từ lần khám gần nhất (dữ liệu cũ, không phải AI đoán) */
  chepLichSu?: boolean;
}

export function dienPhieu(
  draft: Draft,
  matches: RowMatches,
  data: EformData,
  get: (id: string) => Truong,
  tuyChon: TuyChonDien = {},
): KetQuaDien {
  const truong: Record<string, Truong> = {};
  const daDien: MucDaDien[] = [];
  const boQua: string[] = [];

  const dat = (id: string, nhan: string, value: string, nguon: Nguon) => {
    if (!value) return;
    const hienTai = get(id);
    // Gọi lại mẫu: ô đã đúng giá trị này thì không tính là vừa điền
    if (tuyChon.chiOTrong && hienTai.value === value) return;
    const nguoiNhap = hienTai.nguon === "bs" || hienTai.nguon === "sua";
    const giu = tuyChon.chiOTrong && !O_CHON_MAC_DINH.has(id) ? true : nguoiNhap;
    if (hienTai.value.trim() && giu) {
      boQua.push(nhan);
      return;
    }
    truong[id] = { value, nguon: nguon === "ai" && demChoTrong(value) > 0 ? "xem" : nguon };
    daDien.push({ id, nhan, nguon: truong[id].nguon as Nguon });
  };

  const pk = (draft.phieu_kham ?? {}) as Values;
  for (const { tu, den, nhan } of ANH_XA) dat(den, nhan, chu(pk[tu]), "ai");

  const chanDoan = chu(pk.chan_doan_chinh);
  if (chanDoan) {
    const ma = tuyChon.icd || (goiYIcd(chanDoan, data.icd10, data.quyTac)[0]?.item.ma ?? "");
    // Ô ghi chẩn đoán bằng chữ chỉ dùng khi không tìm được mã, có mã thì để trống như phiếu thật.
    // clinicalOnly (lượt khám chỉ lâm sàng) thì không điền phần ra viện.
    if (ma) {
      dat("icd_ban_dau", "Chẩn đoán ban đầu (ICD10)", ma, "xem");
      if (!tuyChon.clinicalOnly) dat("icd_ra_vien", "Chẩn đoán ra viện (ICD10)", ma, "xem");
    } else {
      dat("mo_ta_ban_dau", "Chẩn đoán ban đầu (không có mã)", chanDoan, "ai");
      if (!tuyChon.clinicalOnly) dat("mo_ta_ra_vien", "Chẩn đoán ra viện (không có mã)", chanDoan, "ai");
    }
  }

  const kemTheo = chu(pk.chan_doan_kem);
  if (kemTheo) {
    const daChon = [truong.icd_ra_vien?.value ?? get("icd_ra_vien").value];
    // Mỗi chẩn đoán ngăn bằng ";": đúng tên một mã (phiếu mẫu ghi tên ICD, tên có thể chứa dấu phẩy) thì lấy mã đó,
    // không thì tách tiếp theo dấu phẩy và gợi ý mã theo từ khóa
    const ma = kemTheo
      .split(";")
      .flatMap((y) => maIcdTheoTen(y, data.icd10) || y.split(",").map((z) => goiYIcd(z, data.icd10, data.quyTac, daChon)[0]?.item.ma))
      .filter((m): m is string => Boolean(m) && !daChon.includes(m));
    dat("icd_kem_theo", "Chẩn đoán kèm theo (ICD10)", [...new Set(ma)].join(","), "xem");
  }

  for (const [id, value] of Object.entries(tuyChon.oKhac ?? {})) dat(id, NHAN_O_KHAC[id] ?? id, value, "ai");

  if (tuyChon.chepLichSu) {
    const ls = data.ca.lich_su;
    dat("tien_su_ban_than", "Tiền sử bản thân", moiNhat(ls.tien_su_ban_than)?.noi_dung ?? "", "cu");
    dat("tien_su_gia_dinh", "Tiền sử gia đình", moiNhat(ls.tien_su_gia_dinh)?.noi_dung ?? "", "cu");
    // Chỉ chép khi lần trước có ghi dị ứng; không có lịch sử thì để trống, không tự chọn "Không"
    const diUng = moiNhat(ls.di_ung);
    if (diUng && !get("di_ung").value) {
      dat("di_ung", "Tiền sử dị ứng", "Có", "cu");
      dat("di_ung_loai", "Loại dị ứng", diUng.loai, "cu");
      dat("di_ung_mo_ta", "Mô tả dị ứng", diUng.thong_tin, "cu");
    }
  }

  const hen = chu(pk.hen_tai_kham);
  if (hen) {
    const ngay = ngayTaiKham(hen, get("thoi_gian_kham").value);
    dat("hen_tai_kham", "Hẹn tái khám", "Có", ngay ? "ai" : "xem");
    if (ngay) dat("ngay_tai_kham", "Ngày tái khám", ngay, "ai");
  }

  const chiDinh = ((draft.chi_dinh ?? []) as Values[]).map((row, i) => ({
    ma: chu(row.ma_dich_vu),
    ten: chu(row.ten_dich_vu),
    so_luong: chu(row.so_luong),
    ghi_chu: chu(row.ghi_chu),
    nguon: nguonDong(matches.chi_dinh?.[i]),
    ung_vien: matches.chi_dinh?.[i]?.candidates ?? [],
    tu_ai: true,
  }));

  const donThuoc = ((tuyChon.clinicalOnly && !tuyChon.kemThuoc ? [] : draft.ke_don ?? []) as Values[]).map((row, i) => ({
    ma: chu(row.ma_thuoc),
    ten: chu(row.ten_thuoc),
    ham_luong: chu(row.ham_luong),
    duong_dung: chu(row.duong_dung),
    lieu_moi_lan: chu(row.lieu_moi_lan),
    khi_can: laKhiCan({ khi_can: chu(row.khi_can), thoi_diem: chu(row.thoi_diem) }),
    so_lan_ngay: chu(row.so_lan_ngay),
    thoi_diem: chu(row.thoi_diem),
    so_ngay: chu(row.so_ngay),
    so_luong_ke: chu(row.so_luong_ke),
    ghi_chu: chu(row.ghi_chu),
    nguon: nguonDong(matches.ke_don?.[i]),
    ung_vien: matches.ke_don?.[i]?.candidates ?? [],
    tu_ai: true,
  }));

  return { truong, daDien, boQua, chiDinh, donThuoc };
}

/**
 * Gộp các ô AI vừa điền vào phiếu hiện tại, bỏ ô đã bị sửa trong lúc chờ AI trả lời
 * (so với phiếu lúc gửi), để chữ bác sĩ gõ trong mấy giây đó không bị ghi đè.
 */
export function gopTruongMoi(
  hienTai: Record<string, Truong>,
  lucGui: Record<string, Truong>,
  moi: Record<string, Truong>,
): Record<string, Truong> {
  const giu = Object.entries(moi).filter(([id]) => hienTai[id] === lucGui[id]);
  return { ...hienTai, ...Object.fromEntries(giu) };
}
