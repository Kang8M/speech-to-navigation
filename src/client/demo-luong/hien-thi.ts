// Kiểu và nhãn dùng chung cho các khối của màn /demo-luong (chỉ hiển thị, không gọi API).
import type { PiiRule } from "@/shared/clinical/pii";
import type { DemoEvent, DemoStep } from "@/shared/demo-luong/types";

export type CheDo = "bac_si" | "ky_thuat";
export type TrangThaiBuoc = "cho" | "dang" | "xong" | "bi_chan" | "loi" | "bo_qua";
export interface BuocView { trang_thai: TrangThaiBuoc; ms: number | null }

/** Sự kiện thành công (hoặc bị chặn) của một bước, đã thu hẹp theo `buoc`. */
export type SuKien<S extends DemoStep> = Extract<DemoEvent, { buoc: S }>;
/** Sự kiện cuối của từng bước trong lượt đang xem. */
export type SuKienLuot = { [S in DemoStep]?: SuKien<S> | Extract<DemoEvent, { trang_thai: "loi" }> };

export const BUOC: { id: DemoStep; so: string; ten: string }[] = [
  { id: "stt", so: "①", ten: "Ghi âm" },
  { id: "ban_tho", so: "②", ten: "Bản chép lời" },
  { id: "che", so: "③", ten: "Bản đã che" },
  { id: "ai", so: "④", ten: "AI phân tích" },
  { id: "luu", so: "⑤", ten: "Phiếu đã lưu" },
];

export const BUOC_TRONG: Record<DemoStep, BuocView> = {
  stt: { trang_thai: "cho", ms: null }, ban_tho: { trang_thai: "cho", ms: null }, che: { trang_thai: "cho", ms: null },
  ai: { trang_thai: "cho", ms: null }, luu: { trang_thai: "cho", ms: null },
};

export const RULES: PiiRule[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];
export const TEN_RULE: Record<PiiRule, string> = {
  R1: "Giá trị đã biết trong hồ sơ (bệnh nhân, người nhà, nhân viên, nơi làm việc)",
  R2: "Họ tên chưa có trong hồ sơ",
  R3: "Địa danh dưới cấp tỉnh",
  R4: "Mốc ngày gắn với bệnh nhân",
  R5: "Số điện thoại, email, URL",
  R6: "Mã định danh (CCCD, BHYT, PID…)",
  R7: "Thông tin nhạy cảm (quốc tịch, dân tộc…)",
  R8: "Nội dung ngoài phạm vi khám",
};

export const TEN_LY_DO_CHAN: Record<string, string> = {
  R11a_gia_tri_da_biet: "R11a · còn giá trị đã biết trong hồ sơ",
  R11b_day_so_dai: "R11b · còn dãy số dài (≥ 6 chữ số)",
  R11c_ten_rieng_con_sot: "R11c · còn cụm giống tên người",
  R11d_email_url: "R11d · còn email hoặc URL",
};

export const RUI_RO_R2 =
  "Chữ từ STT là chữ thường, không dấu câu, nên R2 không dựa vào chữ hoa: R2 dò theo từ điển họ người Việt và từ chỉ người. " +
  "Rủi ro còn lại: tên đứng một mình, không có họ hoặc từ chỉ người phía trước, có thể lọt — chốt chặn R11 là lớp bảo vệ sau.";

export function tongDaChe(counts: Partial<Record<PiiRule, number>> | undefined): number {
  return Object.values(counts ?? {}).reduce((n, v) => n + (v ?? 0), 0);
}

/** "01/11/2026 09:00" theo giờ Việt Nam. */
export function gioVN(iso: string | null | undefined): string {
  if (!iso) return "không rõ thời điểm";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(d);
}

export const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ef-xanh";
/** Nhãn che trong bản sạch, ví dụ `[BỆNH_NHÂN]`, `[NGƯỜI_1]`. */
export const NHAN_CHE = /\[[^\]\n]+\]/g;
