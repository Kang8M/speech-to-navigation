// Trạng thái của màn hình duyệt: mỗi ô giữ giá trị hiện tại và giá trị AI đã điền.
import type { FieldStatus } from "@/client/chung/DynamicField";
import type { MatchResult } from "@/shared/match";
import type { CatalogItem, FieldValue, FormConfig, Values } from "@/shared/types";

export interface Cell {
  value: string;
  /** Giá trị AI điền; chuỗi rỗng nghĩa là AI không điền */
  ai: string;
}

export interface Row {
  key: number;
  cells: Record<string, Cell>;
  matchReason?: string;
  candidates: CatalogItem[];
}

export type RowsState = Record<string, Row[]>;

let nextKey = 1;

export function toText(value: FieldValue | undefined): string {
  return value === null || value === undefined ? "" : String(value);
}

export function blankRow(form: FormConfig): Row {
  const cells: Record<string, Cell> = {};
  for (const field of form.fields) cells[field.id] = { value: "", ai: "" };
  return { key: nextKey++, cells, candidates: [] };
}

export function rowFromValues(form: FormConfig, values: Values, match?: MatchResult): Row {
  const row = blankRow(form);
  for (const field of form.fields) {
    const text = toText(values[field.id]);
    row.cells[field.id] = { value: text, ai: text };
  }
  if (match) {
    row.matchReason = match.reason;
    row.candidates = match.candidates;
  }
  return row;
}

export function initialRows(forms: FormConfig[]): RowsState {
  return Object.fromEntries(
    forms.map((form) => [form.id, form.mode === "single" ? [blankRow(form)] : []]),
  );
}

export function cellStatus(cell: Cell, drafted: boolean): FieldStatus {
  if (cell.ai !== "") return cell.value === cell.ai ? "ai" : "edited";
  return drafted && cell.value !== "" ? "edited" : "none";
}

export function rowValues(row: Row): Values {
  return Object.fromEntries(Object.entries(row.cells).map(([id, cell]) => [id, cell.value]));
}
// Số đo của lượt thử (gửi lên /api/sessions), đếm trên trạng thái màn hình
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
