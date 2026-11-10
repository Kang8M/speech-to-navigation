// Các cảnh báo cho bác sĩ. Chỉ cảnh báo, không chặn xác nhận.
import { normalizeVi } from "./normalize";
import type { Draft, FieldValue, FormConfig, Values, WarningRules } from "./types";

function isEmpty(value: FieldValue | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function parseDose(text: string): { amount: number; unit: string } | null {
  const found = text.trim().replace(",", ".").match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?\s*([\p{L}]+)/u);
  if (!found) return null;
  const amount = found[2] ? Number(found[1]) / Number(found[2]) : Number(found[1]);
  return amount > 0 ? { amount, unit: found[3] } : null;
}

/** Tổng = liều × số lần/ngày × số ngày, chỉ với thuốc đếm được; làm tròn lên */
export function computeTotal(row: Values, rules: WarningRules): number | null {
  const config = rules.tinh_tong;
  const dose = parseDose(String(row[config.truong_lieu] ?? ""));
  const times = Number(row[config.truong_so_lan]);
  const days = Number(row[config.truong_so_ngay]);
  if (!dose || !(times > 0) || !(days > 0)) return null;
  const countable = config.don_vi_dem.map(normalizeVi);
  if (!countable.includes(normalizeVi(dose.unit))) return null;
  return Math.ceil(dose.amount * times * days);
}

export function applyTotals(draft: Draft, rules: WarningRules): void {
  const rows = draft[rules.tinh_tong.form] as Values[] | undefined;
  for (const row of rows ?? []) {
    row[rules.tinh_tong.truong_tong] = computeTotal(row, rules);
  }
}

/** formId -> chỉ số dòng -> fieldId -> danh sách cảnh báo */
export type FieldWarnings = Record<string, Record<number, Record<string, string[]>>>;

export interface WarningReport {
  fields: FieldWarnings;
  global: string[];
  count: number;
}

export interface RowsByForm {
  [formId: string]: Values[];
}

function rowIsBlank(row: Values, form: FormConfig): boolean {
  return form.fields.every((field) => isEmpty(row[field.id]));
}

export function computeWarnings(
  forms: FormConfig[],
  rowsByForm: RowsByForm,
  hanhChinh: Values,
  rules: WarningRules,
  /** Lý do chưa khớp danh mục theo từng dòng, nếu có */
  matchReasons: Record<string, (string | undefined)[]> = {},
): WarningReport {
  const fields: FieldWarnings = {};
  let count = 0;

  for (const form of forms) {
    fields[form.id] = {};
    (rowsByForm[form.id] ?? []).forEach((row, index) => {
      if (form.mode === "rows" && rowIsBlank(row, form)) return;
      const rowWarnings: Record<string, string[]> = {};
      for (const field of form.fields) {
        const messages: string[] = [];
        if (field.required && isEmpty(row[field.id])) messages.push(`Thiếu ${field.label.toLowerCase()}`);
        if (field.catalog && field.name_field && isEmpty(row[field.id]) && !isEmpty(row[field.name_field])) {
          messages.push(matchReasons[form.id]?.[index] ?? "Chưa có mã, hãy chọn từ danh mục");
        }
        if (messages.length > 0) {
          rowWarnings[field.id] = messages;
          count += messages.length;
        }
      }
      fields[form.id][index] = rowWarnings;
    });
  }

  const global: string[] = [];
  const age = hanhChinh[rules.truong_tuoi];
  const hasPrescription = (rowsByForm[rules.form_kiem_tra_can_nang] ?? []).length > 0;
  if (
    !isEmpty(age) &&
    Number(age) < rules.tuoi_tre_em_duoi &&
    isEmpty(hanhChinh[rules.truong_can_nang]) &&
    hasPrescription
  ) {
    global.push(rules.thong_bao_thieu_can_nang);
  }

  return { fields, global, count: count + global.length };
}
