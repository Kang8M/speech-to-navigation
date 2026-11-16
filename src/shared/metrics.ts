// Đo lường mỗi lượt thử. Chỉ lưu số đếm, không lưu nội dung nhập hay thông tin hành chính.

export type InputMode = "go" | "noi";

export interface SessionInput {
  kieu_nhap: InputMode;
  tu_ca_mau: boolean;
  ca_mau_id: string | null;
  /** Phiếu mẫu theo bệnh đã dùng trong lượt (data/eform/phieu-mau.json); lượt ghi trước 2026-11-12 không có */
  mau_id?: string | null;
  provider: string;
  thoi_gian_giay: number;
  so_truong_ai_dien: number;
  so_truong_sua: number;
  so_truong_bo_sung: number;
  so_muc_danh_muc: number;
  so_muc_khop: number;
  so_muc_khong_khop: number;
  so_canh_bao: number;
  /** Gợi ý chữ mờ (bấm Tab) có bật trong lượt không; lượt ghi trước 2026-11-16 không có các trường dưới đây */
  goi_y_tab?: boolean;
  /** Số gợi ý khác nhau đã hiện ra */
  so_goi_y_hien?: number;
  so_goi_y_nhan?: number;
  /** Gợi ý đã nhận nhưng lúc Lưu câu đó không còn nguyên trong ô */
  so_goi_y_nhan_roi_sua?: number;
  /** Số ký tự vào ô nhờ bấm Tab, và số ký tự bác sĩ tự gõ vào ô phiếu khám */
  so_ky_tu_goi_y?: number;
  so_ky_tu_go?: number;
}

export interface SessionRecord extends SessionInput {
  id: string;
  thoi_diem: string;
}

export interface Aggregate {
  so_luot: number;
  thoi_gian_tb: number | null;
  ty_le_giu_nguyen: number | null;
  ty_le_khop: number | null;
  /** Số gợi ý Tab được nhận trên số gợi ý đã hiện */
  ty_le_nhan_goi_y: number | null;
  /** Phần chữ trong ô đến từ gợi ý Tab, trên tổng chữ gợi ý cộng chữ tự gõ */
  ty_le_chu_goi_y: number | null;
}

export function aggregate(sessions: SessionRecord[]): Aggregate {
  const sum = (pick: (s: SessionRecord) => number) => sessions.reduce((total, s) => total + pick(s), 0);
  const filled = sum((s) => s.so_truong_ai_dien);
  const catalogItems = sum((s) => s.so_muc_danh_muc);
  const goiYHien = sum((s) => s.so_goi_y_hien ?? 0);
  const chuGoiY = sum((s) => s.so_ky_tu_goi_y ?? 0);
  const chuTong = chuGoiY + sum((s) => s.so_ky_tu_go ?? 0);
  return {
    so_luot: sessions.length,
    thoi_gian_tb: sessions.length > 0 ? sum((s) => s.thoi_gian_giay) / sessions.length : null,
    ty_le_giu_nguyen: filled > 0 ? (filled - sum((s) => s.so_truong_sua)) / filled : null,
    ty_le_khop: catalogItems > 0 ? sum((s) => s.so_muc_khop) / catalogItems : null,
    ty_le_nhan_goi_y: goiYHien > 0 ? sum((s) => s.so_goi_y_nhan ?? 0) / goiYHien : null,
    ty_le_chu_goi_y: chuTong > 0 ? chuGoiY / chuTong : null,
  };
}

const CSV_COLUMNS: (keyof SessionRecord)[] = [
  "id",
  "thoi_diem",
  "kieu_nhap",
  "tu_ca_mau",
  "ca_mau_id",
  "mau_id",
  "provider",
  "thoi_gian_giay",
  "so_truong_ai_dien",
  "so_truong_sua",
  "so_truong_bo_sung",
  "so_muc_danh_muc",
  "so_muc_khop",
  "so_muc_khong_khop",
  "so_canh_bao",
  "goi_y_tab",
  "so_goi_y_hien",
  "so_goi_y_nhan",
  "so_goi_y_nhan_roi_sua",
  "so_ky_tu_goi_y",
  "so_ky_tu_go",
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(sessions: SessionRecord[]): string {
  const lines = sessions.map((session) => CSV_COLUMNS.map((column) => csvCell(session[column])).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\n");
}
