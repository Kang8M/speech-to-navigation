// Định dạng giờ/ngày theo múi giờ cơ sở (Asia/Ho_Chi_Minh = UTC+7, không DST). Hàm thuần, không phụ thuộc Intl.
import type { ClinicDate } from "./types";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function vnMs(iso: string): number {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) throw new RangeError(`Timestamp không hợp lệ: ${iso}`);
  return ms + VN_OFFSET_MS;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Số phút kể từ 00:00 giờ Việt Nam của ngày chứa timestamp. */
export function minutesOfClinicDay(iso: string): number {
  return Math.floor((((vnMs(iso) % DAY_MS) + DAY_MS) % DAY_MS) / 60000);
}

export function formatClinicTime(iso: string): string {
  const m = minutesOfClinicDay(iso);
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/** YYYY-MM-DD -> DD/MM/YYYY. */
export function formatClinicDate(date: ClinicDate): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function formatClinicDateTime(iso: string): string {
  const d = new Date(vnMs(iso)).toISOString().slice(0, 10);
  return `${formatClinicDate(d)} ${formatClinicTime(iso)}`;
}

/** Cộng/trừ số ngày trên ngày lịch (không đụng múi giờ). */
export function shiftClinicDate(date: ClinicDate, days: number): ClinicDate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

const WEEKDAYS = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

/** Thứ trong tuần của một ngày lịch, tiếng Việt. */
export function weekdayLabel(date: ClinicDate): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
