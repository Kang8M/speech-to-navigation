import { HO_VIET } from "./ho-viet";
import { foldVietnamese } from "./redact";
import type { KnownIdentifier } from "./types";

export type GateReason = "R11a_gia_tri_da_biet" | "R11b_day_so_dai" | "R11c_ten_rieng_con_sot" | "R11d_email_url";
export interface GateResult { passed: boolean; reasons: { reason: GateReason; excerpt: string }[] }

const LABEL = /\[[^\]]*\]/g;
const MAX_EXCERPT = 40;
const HO_FOLD: ReadonlySet<string> = new Set(HO_VIET.map(foldVietnamese));

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

  // (c) họ + ≥1 âm tiết, không thuộc allowlist
  const allow = new Set([...allowlist].map(foldVietnamese));
  const toks = [...text.matchAll(/[\p{L}]+/gu)].map((m) => ({ f: foldVietnamese(m[0]), start: m.index!, end: m.index! + m[0].length }));
  for (let i = 0; i < toks.length - 1; i++) {
    if (!HO_FOLD.has(toks[i].f)) continue;
    // hai âm tiết liền nhau, không bị ngắt bởi nhãn/dấu "|"
    if (/[|]/.test(text.slice(toks[i].end, toks[i + 1].start))) continue;
    if (allow.has(toks[i].f)) continue;
    let ok = false;
    for (let n = 2; n <= Math.min(6, toks.length - i); n++) {
      if (allow.has(toks.slice(i, i + n).map((t) => t.f).join(" "))) { ok = true; break; }
    }
    if (ok) continue;
    reasons.push({ reason: "R11c_ten_rieng_con_sot", excerpt: cut(text, toks[i].start, toks[Math.min(i + 3, toks.length - 1)].end) });
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
