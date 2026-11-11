// Đổ kết quả AI (/api/extract) vào phiếu eForm, chỉ định và đơn thuốc.
// Mã ICD10 không lấy từ LLM: code chấm điểm từ khóa gán mã và luôn đánh dấu "cần xem lại".
import type { MatchResult, RowMatches } from "../match";
import type { CatalogItem, Draft, FieldValue, Values } from "../types";
import { goiYIcd } from "./icd";
import type { EformData, Nguon, Truong } from "./types";

export interface DongChiDinh {
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
  so_lan_ngay: string;
  thoi_diem: string;
  so_ngay: string;
  ghi_chu: string;
  nguon: Nguon;
  ung_vien: CatalogItem[];
  tu_ai?: boolean;
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

export function dienPhieu(
  draft: Draft,
  matches: RowMatches,
  data: EformData,
  get: (id: string) => Truong,
): KetQuaDien {
  const truong: Record<string, Truong> = {};
  const daDien: MucDaDien[] = [];
  const boQua: string[] = [];

  const dat = (id: string, nhan: string, value: string, nguon: Nguon) => {
    if (!value) return;
    const hienTai = get(id);
    if (hienTai.value.trim() && (hienTai.nguon === "bs" || hienTai.nguon === "sua")) {
      boQua.push(nhan);
      return;
    }
    truong[id] = { value, nguon };
    daDien.push({ id, nhan, nguon });
  };

  const pk = (draft.phieu_kham ?? {}) as Values;
  for (const { tu, den, nhan } of ANH_XA) dat(den, nhan, chu(pk[tu]), "ai");

  const chanDoan = chu(pk.chan_doan_chinh);
  if (chanDoan) {
    const ma = goiYIcd(chanDoan, data.icd10, data.quyTac)[0]?.item.ma ?? "";
    dat("mo_ta_ban_dau", "Mô tả chẩn đoán ban đầu", chanDoan, "ai");
    dat("icd_ban_dau", "Chẩn đoán ban đầu (ICD10)", ma, "xem");
    dat("mo_ta_ra_vien", "Mô tả chẩn đoán ra viện", chanDoan, "ai");
    dat("icd_ra_vien", "Chẩn đoán ra viện (ICD10)", ma, "xem");
  }

  const kemTheo = chu(pk.chan_doan_kem);
  if (kemTheo) {
    const daChon = [truong.icd_ra_vien?.value ?? get("icd_ra_vien").value];
    const ma = kemTheo
      .split(/[,;]/)
      .map((y) => goiYIcd(y, data.icd10, data.quyTac, daChon)[0]?.item.ma)
      .filter((m): m is string => Boolean(m));
    dat("icd_kem_theo", "Chẩn đoán kèm theo (ICD10)", [...new Set(ma)].join(","), "xem");
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
    so_luong: chu(row.so_luong) || "1",
    ghi_chu: chu(row.ghi_chu),
    nguon: nguonDong(matches.chi_dinh?.[i]),
    ung_vien: matches.chi_dinh?.[i]?.candidates ?? [],
    tu_ai: true,
  }));

  const donThuoc = ((draft.ke_don ?? []) as Values[]).map((row, i) => ({
    ma: chu(row.ma_thuoc),
    ten: chu(row.ten_thuoc),
    ham_luong: chu(row.ham_luong),
    duong_dung: chu(row.duong_dung),
    lieu_moi_lan: chu(row.lieu_moi_lan),
    so_lan_ngay: chu(row.so_lan_ngay),
    thoi_diem: chu(row.thoi_diem),
    so_ngay: chu(row.so_ngay),
    ghi_chu: chu(row.ghi_chu),
    nguon: nguonDong(matches.ke_don?.[i]),
    ung_vien: matches.ke_don?.[i]?.candidates ?? [],
    tu_ai: true,
  }));

  return { truong, daDien, boQua, chiDinh, donThuoc };
}
