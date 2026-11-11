// Kiểu dữ liệu của trang mô phỏng eForm ngoại trú.
import type { CatalogItem, WarningRules } from "../types";
import type { MauGoiY } from "./goi-y";

/** cu: dữ liệu có sẵn; ai: AI thêm; xem: AI thêm nhưng chưa chắc, bác sĩ cần xem lại;
 * sua: dữ liệu cũ hoặc AI đã bị bác sĩ sửa; bs: bác sĩ tự nhập */
export type Nguon = "cu" | "ai" | "xem" | "sua" | "bs";

export interface Truong {
  value: string;
  nguon: Nguon | null;
}

export interface DongLichSu {
  ngay: string;
  bac_si: string;
  khoa: string;
  noi_dung: string;
}

export interface DongDiUng {
  ngay: string;
  loai_phieu: string;
  loai: string;
  thong_tin: string;
  nguoi: string;
}

export interface SinhHieu {
  mach: number;
  nhiet_do: number;
  ha_tam_thu: number;
  ha_tam_truong: number;
  spo2: number;
  nhip_tho: number;
  chieu_cao: number;
  can_nang: number;
}

export interface KetQuaTheoNgay {
  ngay: string;
  muc: { ten: string; ket_qua: string }[];
}

export interface CaGia {
  dang_nhap: string;
  co_so: string;
  pid: string;
  ma_luot_kham: string;
  ho_ten: string;
  gioi_tinh: string;
  canh_bao_di_ung: string;
  chinh_sua_cuoi: { nguoi: string; luc: string };
  danh_gia_ban_dau: { nhan: string; gia_tri: string }[];
  sinh_hieu: SinhHieu;
  bac_si_kham: string;
  phong_kham: string;
  bac_si_chinh: string;
  trang_thai: string;
  lich_su: {
    tien_su_ban_than: DongLichSu[];
    tien_su_gia_dinh: DongLichSu[];
    benh_su: DongLichSu[];
    di_ung: DongDiUng[];
  };
  xet_nghiem: KetQuaTheoNgay[];
  chan_doan_hinh_anh: KetQuaTheoNgay[];
  can_lam_sang: KetQuaTheoNgay[];
  dong_bo_cls: string;
  /** Giá trị có sẵn của các trường trong form, theo id trường */
  gia_tri: Record<string, string>;
}

export interface Icd10 {
  ma: string;
  ten: string;
  /** Từ khóa đặc trưng, điểm cao */
  manh: string[];
  /** Từ khóa gợi ý, điểm thấp */
  vua: string[];
}

export interface TuyChon {
  trang_thai: string[];
  tinh_trang_ra_vien: string[];
  loai_di_ung: string[];
}

export type VungKham = "tai" | "mui" | "vom" | "hong";

export interface MauCauData {
  mac_dinh: Partial<Record<VungKham, string[]>>;
  nhom: {
    id: string;
    ten: string;
    tu_khoa: string[];
    mau: Partial<Record<VungKham, string[]>>;
  }[];
}

export interface QuyTacAi {
  tom_tat: {
    /** Độ giống tối thiểu để gộp hai ý, từ 0 đến 1 */
    nguong_giong: number;
    so_y_toi_da: number;
    /** Ý chứa các cụm này không đưa vào tóm tắt */
    bo_qua: string[];
  };
  icd: {
    diem_manh: number;
    diem_vua: number;
    /** Tin cậy = điểm / (điểm + hệ số), chỉ là số mô phỏng */
    he_so: number;
    tran_tin_cay: number;
    nguong_tin_cay: number;
    so_goi_y: number;
  };
  phu_dinh: {
    tu: string[];
    /** Cụm có từ phủ định nhưng không phủ định triệu chứng, ví dụ "không đỡ" */
    ngoai_le: string[];
    /** Số từ đứng trước triệu chứng được xét phủ định */
    cua_so: number;
  };
}

export interface EformData {
  ca: CaGia;
  icd10: Icd10[];
  thuVien: Record<string, string[]>;
  tuyChon: TuyChon;
  quyTac: QuyTacAi;
  mauCau: MauCauData;
  /** Danh mục dịch vụ và thuốc dùng chung với trang chính, để bác sĩ chọn lại khi AI khớp chưa chắc */
  danhMuc: { dichVu: CatalogItem[]; thuoc: CatalogItem[] };
  canhBao: WarningRules;
  /** Bộ mẫu chỉ định và đơn thuốc theo chẩn đoán, mã đã gán bằng lib/match.ts */
  goiY: MauGoiY[];
  /** Nhà cung cấp AI đang dùng (mock, anthropic, openai, gemini) */
  provider: string;
  /** Câu mẫu của ca giả này (lấy từ data/cases/ca-11-*.json) để demo nhanh */
  cauMau: { noi: string; goTat: string };
}
