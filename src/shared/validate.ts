// Tính tổng số lượng thuốc (config/canh-bao.json): bác sĩ nói rõ số lượng thì lấy số đó,
// không thì nhân liều, số lần/ngày và số ngày.
import { normalizeVi } from "./normalize";
import type { Draft, Values, WarningRules } from "./types";

const LIEU = /^(\d+(?:[.,]\d+)?(?:\/\d+)?)\s*([\p{L}]+)(?![\p{L}])/u;

/** Bung đơn vị gõ tắt ngay sau số liều: "1 v" → "1 viên", "1/2v" → "1/2 viên". Không khớp thì giữ nguyên. */
export function bungDonViLieu(text: string, rules: WarningRules): string {
  const trimmed = text.trim();
  const found = trimmed.match(LIEU);
  const full = found && rules.tinh_tong.don_vi_viet_tat?.[found[2]];
  return full ? `${found[1]} ${full}${trimmed.slice(found[0].length)}` : text;
}

function parseDose(text: string): { amount: number; unit: string } | null {
  const found = text.trim().replace(",", ".").match(/^(\d+(?:\.\d+)?)(?:\/(\d+))?\s*([\p{L}]+)/u);
  if (!found) return null;
  const amount = found[2] ? Number(found[1]) / Number(found[2]) : Number(found[1]);
  return amount > 0 ? { amount, unit: found[3] } : null;
}

/**
 * Tổng = số lượng bác sĩ nói rõ; không có thì liều × số lần/ngày × số ngày, chỉ với thuốc đếm được, làm tròn lên.
 * Thuốc dùng khi cần thường không có số lần cố định, nên phải có số lượng kê mới ra tổng.
 */
export function computeTotal(row: Values, rules: WarningRules): number | null {
  const config = rules.tinh_tong;
  const stated = Number(row[config.truong_so_luong_ke]);
  if (stated > 0) return Math.ceil(stated);
  const dose = parseDose(bungDonViLieu(String(row[config.truong_lieu] ?? ""), rules));
  const times = Number(row[config.truong_so_lan]);
  const days = Number(row[config.truong_so_ngay]);
  if (!dose || !(times > 0) || !(days > 0)) return null;
  const countable = config.don_vi_dem.map(normalizeVi);
  if (!countable.includes(normalizeVi(dose.unit))) return null;
  return Math.ceil(dose.amount * times * days);
}

/** Bung đơn vị gõ tắt trong liều rồi tính tổng cho từng dòng thuốc. */
export function applyTotals(draft: Draft, rules: WarningRules): void {
  const rows = draft[rules.tinh_tong.form] as Values[] | undefined;
  const { truong_lieu, truong_tong } = rules.tinh_tong;
  for (const row of rows ?? []) {
    if (typeof row[truong_lieu] === "string") row[truong_lieu] = bungDonViLieu(row[truong_lieu], rules);
    row[truong_tong] = computeTotal(row, rules);
  }
}
