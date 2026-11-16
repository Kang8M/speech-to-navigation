import { foldVietnamese, isCommonHoPair, isHo, nameTailEnd } from "./redact";
import type { KnownIdentifier } from "./types";

export type GateReason = "R11a_gia_tri_da_biet" | "R11b_day_so_dai" | "R11c_ten_rieng_con_sot" | "R11d_email_url";
/** Cảnh báo: `excerpt` có thể chứa chính phần PII còn sót. Không bao giờ ghi đĩa, log hay đưa vào nhật ký. */
export interface GateResult { passed: boolean; reasons: { reason: GateReason; excerpt: string }[] }

const LABEL = /\[[^\]]*\]/g;
const MAX_EXCERPT = 40;

/** Cụm từ lâm sàng bắt đầu bằng họ ("tiền sử", "cao huyết áp", "dương tính"...), viết không dấu. Luôn gộp với allowlist của người gọi. */
export const DEFAULT_CLINICAL_ALLOWLIST: ReadonlySet<string> = new Set(
  ["tiền sử", "cao huyết áp", "dịch mủ", "dương tính", "phù nề", "niêm mạc", "ngày mai", "tái khám ngày mai"].map(foldVietnamese),
);

/** Token nào nằm trong một lần xuất hiện bất kỳ của cụm allowlist (so không dấu). */
function coveredByAllowlist(folded: string[], allow: ReadonlySet<string>): boolean[] {
  const covered = new Array<boolean>(folded.length).fill(false);
  for (const phrase of allow) {
    const p = phrase.split(" ").filter(Boolean);
    if (p.length === 0) continue;
    for (let i = 0; i + p.length <= folded.length; i++) {
      if (p.every((w, n) => folded[i + n] === w)) for (let n = 0; n < p.length; n++) covered[i + n] = true;
    }
  }
  return covered;
}

const cut = (s: string, from: number, to: number) => s.slice(Math.max(0, from), to).trim().slice(0, MAX_EXCERPT);

/**
 * R11: chốt chặn trước khi gọi AI. Không qua thì không được gửi bản sạch đi đâu.
 * Nhãn `[…]` được thay bằng dấu ngắt để không bị coi là nội dung. Excerpt lấy từ bản sạch, ≤ 40 ký tự.
 */
export function checkResidualPii(clean: string, known: KnownIdentifier[], allowlist: ReadonlySet<string>): GateResult {
  const reasons: GateResult["reasons"] = [];
  const text = clean.replace(LABEL, " | ");
  const folded = foldVietnamese(text);

  // (a) giá trị đã biết còn sót
  for (const k of known) {
    const v = foldVietnamese(k.value);
    if (v.length <= 2) continue;
    const at = folded.indexOf(v);
    if (at >= 0) reasons.push({ reason: "R11a_gia_tri_da_biet", excerpt: cut(folded, at - 10, at + v.length + 10) });
  }

  // (b) dãy số dài
  const digits = /\d(?:[\s.-]?\d){5,}/.exec(text);
  if (digits) reasons.push({ reason: "R11b_day_so_dai", excerpt: cut(text, digits.index - 10, digits.index + digits[0].length + 10) });

  // (c) tên người còn sót: cùng logic với bộ dò tên R2 (họ có dấu khớp đúng, họ không dấu trừ họ mơ hồ,
  // đuôi không phải từ dừng/cặp từ thường), chỉ khác là không cần từ chỉ người đứng trước.
  const lower = text.normalize("NFC").toLowerCase();
  const toks = [...lower.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], f: foldVietnamese(m[0]), s: m.index!, e: m.index! + m[0].length }));
  const joined = (a: number, b: number) => !/[|,;.!?\n:]/.test(lower.slice(toks[a].e, toks[b].s));
  const covered = coveredByAllowlist(toks.map((t) => t.f), new Set([...DEFAULT_CLINICAL_ALLOWLIST, ...[...allowlist].map(foldVietnamese)]));
  for (let j = 0; j < toks.length - 1; j++) {
    if (covered[j] || !isHo(toks[j].w) || isCommonHoPair(toks, j)) continue;
    // "thị"/"văn" không dấu sau họ là đệm tên điển hình; "thi" trùng từ dừng "thì" nên bộ dò R2 bỏ qua, ở đây vẫn chặn.
    const dem = j + 2 < toks.length && (toks[j + 1].f === "thi" || toks[j + 1].f === "van") && joined(j, j + 1) && joined(j + 1, j + 2);
    const k = nameTailEnd(toks, j, joined);
    if (k - j - 1 < 1 && !dem) continue;
    reasons.push({ reason: "R11c_ten_rieng_con_sot", excerpt: cut(text, toks[j].s, toks[Math.max(k - 1, dem ? j + 2 : 0)].e) });
    break;
  }

  // (d) email hoặc URL
  const mail = /[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\//i.exec(text);
  if (mail) reasons.push({ reason: "R11d_email_url", excerpt: cut(text, mail.index - 10, mail.index + mail[0].length + 10) });

  return { passed: reasons.length === 0, reasons };
}

/** R14: chưa có đồng ý xử lý AI thì chỉ được chạy cục bộ. */
export type AiRoute = "external_allowed" | "local_only";
export function aiRouteFor(consent: boolean): AiRoute {
  return consent ? "external_allowed" : "local_only";
}
