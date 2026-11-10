// Kiểu dữ liệu của trang mô phỏng eForm ngoại trú.

/** cu: dữ liệu có sẵn; ai: AI thêm; sua: dữ liệu cũ hoặc AI đã bị bác sĩ sửa; bs: bác sĩ tự nhập */
export type Nguon = "cu" | "ai" | "sua" | "bs";

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
}
