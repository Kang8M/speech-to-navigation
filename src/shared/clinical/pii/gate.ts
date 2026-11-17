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

  // (c) tên người còn sót
  const name = residualNames(text, allowlist)[0];
  if (name) reasons.push({ reason: "R11c_ten_rieng_con_sot", excerpt: cut(text, name.s, name.e) });

  // (d) email hoặc URL
  const mail = /[^\s@]+@[^\s@]+\.[^\s@]+|https?:\/\//i.exec(text);
  if (mail) reasons.push({ reason: "R11d_email_url", excerpt: cut(text, mail.index - 10, mail.index + mail[0].length + 10) });

  return { passed: reasons.length === 0, reasons };
}

type Tok = { w: string; f: string; s: number; e: number };
const tokensOf = (lower: string): Tok[] =>
  [...lower.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => ({ w: m[0], f: foldVietnamese(m[0]), s: m.index!, e: m.index! + m[0].length }));

/**
 * Cụm giống tên người (R11c): cùng logic với bộ dò tên R2 (họ có dấu khớp đúng, họ không dấu trừ họ mơ hồ,
 * đuôi không phải từ dừng/cặp từ thường), chỉ khác là không cần từ chỉ người đứng trước.
 * `text` đã thay nhãn bằng dấu `|`; vị trí trả về tính trên `text`.
 */
function residualNames(text: string, allowlist: ReadonlySet<string>): { s: number; e: number }[] {
  const lower = text.normalize("NFC").toLowerCase();
  const toks = tokensOf(lower);
  const joined = (a: number, b: number) => !/[|,;.!?\n:]/.test(lower.slice(toks[a].e, toks[b].s));
  const covered = coveredByAllowlist(toks.map((t) => t.f), new Set([...DEFAULT_CLINICAL_ALLOWLIST, ...[...allowlist].map(foldVietnamese)]));
  const found: { s: number; e: number }[] = [];
  for (let j = 0; j < toks.length - 1; j++) {
    if (covered[j] || !isHo(toks[j].w) || isCommonHoPair(toks, j)) continue;
    // "thị"/"văn" không dấu sau họ là đệm tên điển hình; "thi" trùng từ dừng "thì" nên bộ dò R2 bỏ qua, ở đây vẫn chặn.
    const dem = j + 2 < toks.length && (toks[j + 1].f === "thi" || toks[j + 1].f === "van") && joined(j, j + 1) && joined(j + 1, j + 2);
    const k = nameTailEnd(toks, j, joined);
    if (k - j - 1 < 1 && !dem) continue;
    const last = Math.max(k - 1, dem ? j + 2 : 0);
    found.push({ s: toks[j].s, e: toks[last].e });
    j = last;
  }
  return found;
}

/** Nhãn dùng khi tự che phần còn sót. Tên người lạ dùng nhãn riêng để không trùng số với nhãn `[NGƯỜI_n]` của R2. */
const RESIDUAL_LABEL = {
  R11b_day_so_dai: "[MÃ_ĐỊNH_DANH]",
  R11c_ten_rieng_con_sot: "[NGƯỜI_KHÁC]",
  R11d_email_url: "[LIÊN_HỆ]",
} as const;

/** Kết quả tự che phần còn sót. `masked[].excerpt` chứa chính phần đã che: chỉ hiện cho bác sĩ, không ghi đĩa hay log. */
export interface ResidualMaskResult { clean: string; masked: GateResult["reasons"] }

/**
 * Tự che những gì chốt chặn R11 còn thấy trong bản sạch, thay vì bắt bác sĩ sửa tay.
 * Người gọi PHẢI chạy lại `checkResidualPii` trên kết quả: phần nào không che được (ví dụ giá trị đã biết
 * dính liền trong một từ) vẫn còn đó và chốt chặn sẽ chặn như cũ.
 */
export function maskResidualPii(clean: string, known: KnownIdentifier[], allowlist: ReadonlySet<string>): ResidualMaskResult {
  const src = clean.normalize("NFC");
  // Thay nhãn bằng dấu ngắt cùng độ dài để vị trí khớp với `src`.
  const text = src.replace(LABEL, (m) => "|" + " ".repeat(m.length - 1));
  const lower = text.toLowerCase();
  if (lower.length !== text.length) return { clean: src, masked: [] };
  const spans: { s: number; e: number; label: string; reason: GateReason }[] = [];

  // (a) giá trị đã biết, so theo từng âm tiết không dấu
  const toks = tokensOf(lower);
  for (const k of known) {
    const v = foldVietnamese(k.value);
    if (v.length <= 2) continue;
    const parts = [...v.matchAll(/[\p{L}\p{N}]+/gu)].map((m) => m[0]);
    if (parts.length === 0) continue;
    for (let i = 0; i + parts.length <= toks.length; i++) {
      if (parts.every((p, n) => toks[i + n].f === p)) spans.push({ s: toks[i].s, e: toks[i + parts.length - 1].e, label: `[${k.kind}]`, reason: "R11a_gia_tri_da_biet" });
    }
  }
  // (b) dãy số dài
  for (const m of text.matchAll(/\d(?:[\s.-]?\d){5,}/g)) spans.push({ s: m.index!, e: m.index! + m[0].length, label: RESIDUAL_LABEL.R11b_day_so_dai, reason: "R11b_day_so_dai" });
  // (c) tên người
  for (const n of residualNames(text, allowlist)) spans.push({ ...n, label: RESIDUAL_LABEL.R11c_ten_rieng_con_sot, reason: "R11c_ten_rieng_con_sot" });
  // (d) email hoặc URL (che cả địa chỉ)
  for (const m of text.matchAll(/[^\s@|]+@[^\s@|]+\.[^\s@|]+|https?:\/\/[^\s|]+/gi)) {
    const e = m.index! + m[0].replace(/[.,;:!?)]+$/, "").length;
    spans.push({ s: m.index!, e, label: RESIDUAL_LABEL.R11d_email_url, reason: "R11d_email_url" });
  }

  if (spans.length === 0) return { clean: src, masked: [] };
  // Gộp các đoạn chồng nhau, giữ nhãn của đoạn bắt đầu sớm nhất (cùng điểm đầu thì đoạn dài hơn).
  spans.sort((a, b) => a.s - b.s || b.e - a.e);
  const merged: typeof spans = [];
  for (const sp of spans) {
    const last = merged[merged.length - 1];
    if (last && sp.s < last.e) last.e = Math.max(last.e, sp.e);
    else merged.push({ ...sp });
  }
  let out = "";
  let at = 0;
  for (const sp of merged) {
    out += src.slice(at, sp.s) + sp.label;
    at = sp.e;
  }
  out += src.slice(at);
  return { clean: out, masked: merged.map((sp) => ({ reason: sp.reason, excerpt: cut(src, sp.s, sp.e) })) };
}

/** R14: chưa có đồng ý xử lý AI thì chỉ được chạy cục bộ. */
export type AiRoute = "external_allowed" | "local_only";
export function aiRouteFor(consent: boolean): AiRoute {
  return consent ? "external_allowed" : "local_only";
}
