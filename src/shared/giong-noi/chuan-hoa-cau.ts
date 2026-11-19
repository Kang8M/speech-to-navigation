// Chuẩn hóa câu nhận dạng giọng nói theo từng model. Thuần TS, không import node/server, dùng được cả hai phía.
// - zipformer: trả chữ in hoa, không dấu câu → đổi sang chữ thường, viết hoa chữ đầu.
// - rumble: đã có hoa thường và dấu câu; có thể kèm tiền tố "language Vietnamese<asr_text>" khi không ép ngôn ngữ → bỏ tiền tố.
// Không chuẩn hóa số ở đây (xem src/shared/giong-noi/sua-chu.ts cho bước đổi số đọc thành chữ số).

import type { TenModelGiongNoi } from "../model-giong-noi";

export const TIEN_TO_NGON_NGU = /^language\s+[A-Za-z]+\s*/i;
export const TIEN_TO_ASR_TEXT = /^<asr_text>\s*/i;
const CO_CHU_HOAC_SO = /[\p{L}\p{N}]/u;
const KET_CAU = /[.?!…]$/;

function vietHoaDauCau(text: string): string {
  return text.charAt(0).toLocaleUpperCase("vi") + text.slice(1);
}

/**
 * @param chot true cho câu đã chốt (thêm dấu chấm cuối nếu chưa có `.?!…`), false cho chữ tạm (không thêm dấu).
 * @returns chuỗi rỗng khi không còn chữ hay số nào.
 */
export function chuanHoaCau(text: string, model: TenModelGiongNoi, chot: boolean): string {
  let s = text.trim();
  if (model === "rumble") {
    s = s.replace(TIEN_TO_NGON_NGU, "").replace(TIEN_TO_ASR_TEXT, "").trim();
  }
  if (!CO_CHU_HOAC_SO.test(s)) return "";
  s = model === "zipformer" ? s.toLocaleLowerCase("vi") : s;
  s = vietHoaDauCau(s);
  if (chot && !KET_CAU.test(s)) s += ".";
  return s;
}
