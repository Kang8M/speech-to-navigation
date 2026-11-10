// Trạng thái của màn hình duyệt: mỗi ô giữ giá trị hiện tại và giá trị AI đã điền.
import type { FieldStatus } from "@/components/DynamicField";
import type { MatchResult } from "./match";
import type { CatalogItem, FieldValue, FormConfig, Values } from "./types";

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
