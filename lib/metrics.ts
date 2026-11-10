// Đo lường mỗi lượt thử. Chỉ lưu số đếm, không lưu nội dung nhập hay thông tin hành chính.
import type { FormConfig } from "./types";
import type { RowsState } from "./workspace";

export type InputMode = "go" | "noi";

export interface SessionInput {
  kieu_nhap: InputMode;
  tu_ca_mau: boolean;
  ca_mau_id: string | null;
  provider: string;
  thoi_gian_giay: number;
  so_truong_ai_dien: number;
  so_truong_sua: number;
  so_truong_bo_sung: number;
  so_muc_danh_muc: number;
  so_muc_khop: number;
  so_muc_khong_khop: number;
  so_canh_bao: number;
}

export interface SessionRecord extends SessionInput {
  id: string;
  thoi_diem: string;
}

export interface FieldCounts {
  so_truong_ai_dien: number;
  so_truong_sua: number;
  so_truong_bo_sung: number;
}

/**
 * Chỉ tính các trường ai_fill. Mã và tổng số lượng do server tính nên không tính vào đây;
 * mã đã có chỉ số khớp danh mục riêng.
 * removedAiFields: số trường AI điền nằm trong các dòng bác sĩ đã xóa, tính là đã sửa.
 */
export function countFields(forms: FormConfig[], rows: RowsState, removedAiFields: number): FieldCounts {
  const counts = { so_truong_ai_dien: removedAiFields, so_truong_sua: removedAiFields, so_truong_bo_sung: 0 };
  for (const form of forms) {
    const aiFields = form.fields.filter((field) => field.ai_fill);
    for (const row of rows[form.id] ?? []) {
      for (const field of aiFields) {
        const cell = row.cells[field.id];
        if (cell.ai !== "") {
          counts.so_truong_ai_dien++;
          if (cell.value !== cell.ai) counts.so_truong_sua++;
        } else if (cell.value !== "") {
          counts.so_truong_bo_sung++;
        }
      }
    }
  }
  return counts;
}

export interface Aggregate {
  so_luot: number;
  thoi_gian_tb: number | null;
  ty_le_giu_nguyen: number | null;
  ty_le_khop: number | null;
}

export function aggregate(sessions: SessionRecord[]): Aggregate {
  const sum = (pick: (s: SessionRecord) => number) => sessions.reduce((total, s) => total + pick(s), 0);
  const filled = sum((s) => s.so_truong_ai_dien);
  const catalogItems = sum((s) => s.so_muc_danh_muc);
  return {
    so_luot: sessions.length,
    thoi_gian_tb: sessions.length > 0 ? sum((s) => s.thoi_gian_giay) / sessions.length : null,
    ty_le_giu_nguyen: filled > 0 ? (filled - sum((s) => s.so_truong_sua)) / filled : null,
    ty_le_khop: catalogItems > 0 ? sum((s) => s.so_muc_khop) / catalogItems : null,
  };
}

const CSV_COLUMNS: (keyof SessionRecord)[] = [
  "id",
  "thoi_diem",
  "kieu_nhap",
  "tu_ca_mau",
  "ca_mau_id",
  "provider",
  "thoi_gian_giay",
  "so_truong_ai_dien",
  "so_truong_sua",
  "so_truong_bo_sung",
  "so_muc_danh_muc",
  "so_muc_khop",
  "so_muc_khong_khop",
  "so_canh_bao",
];

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(sessions: SessionRecord[]): string {
  const lines = sessions.map((session) => CSV_COLUMNS.map((column) => csvCell(session[column])).join(","));
  return [CSV_COLUMNS.join(","), ...lines].join("\n");
}
