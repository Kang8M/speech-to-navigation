// Định dạng hiển thị cho màn hồ sơ bệnh nhân. Thuần, giờ cơ sở UTC+7 cố định (giống src/shared/clinic/schedule.ts).
export const NO_INFO = "Chưa có thông tin";

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD -> DD/MM/YYYY; chuỗi lạ giữ nguyên để không bịa dữ liệu. */
export function formatDate(date: string | null): string {
  if (date === null) return NO_INFO;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : date;
}

/** ISO có offset -> "DD/MM/YYYY HH:mm" theo giờ cơ sở. */
export function formatDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const s = new Date(ms + VN_OFFSET_MS).toISOString(); // YYYY-MM-DDTHH:mm:ss.sssZ
  return `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)} ${s.slice(11, 16)}`;
}

export function formatGender(gender: string | null): string {
  if (!gender) return NO_INFO;
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}
