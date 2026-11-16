import { HO_VIET } from "./ho-viet";
import type { KnownIdentifier, PiiLabelKind, PiiRule, PiiSpan, RedactionResult } from "./types";

/**
 * Bộ che PII tự động pii-auto-1 (R1–R8, nhãn R10). Chạy được ở cả hai phía, không phụ thuộc chữ hoa.
 * Mọi dò tìm chạy trên hai chuỗi cùng độ dài: `f` (bỏ dấu) và `d` (chữ thường, giữ dấu), có bảng ánh xạ về bản thô.
 * Heuristic, không phải bảo đảm ẩn danh: chốt chặn phần còn sót là việc của bước sau.
 */

const MARK = /^\p{M}$/u;

function foldChunk(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").replace(/đ/g, "d");
}

/** Bỏ dấu, đ→d, chữ thường, gộp khoảng trắng. */
export function foldVietnamese(text: string): string {
  return foldChunk(text.normalize("NFC").toLowerCase()).replace(/\s+/g, " ").trim();
}

interface Text { f: string; d: string; startMap: number[]; endMap: number[] }

function buildText(raw: string): Text {
  const clusters: { s: number; e: number; text: string }[] = [];
  let i = 0;
  for (const ch of raw) {
    const len = ch.length;
    const last = clusters[clusters.length - 1];
    if (MARK.test(ch) && last) { last.e = i + len; last.text += ch; } else clusters.push({ s: i, e: i + len, text: ch });
    i += len;
  }
  let f = "", d = "";
  const startMap: number[] = [], endMap: number[] = [];
  let prevSpace = false;
  for (const c of clusters) {
    if (/^\s+$/.test(c.text)) {
      if (prevSpace) { endMap[endMap.length - 1] = c.e; continue; }
      f += " "; d += " "; startMap.push(c.s); endMap.push(c.e); prevSpace = true; continue;
    }
    prevSpace = false;
    const lower = c.text.normalize("NFC").toLowerCase();
    const folded = foldChunk(lower);
    const dChunk = lower.length === folded.length ? lower : folded;
    for (let k = 0; k < folded.length; k++) { startMap.push(c.s); endMap.push(c.e); }
    f += folded; d += dChunk;
  }
  return { f, d, startMap, endMap };
}

// ---------- Danh sách từ ----------
const STOP_WORDS = [
  "bị", "đau", "ho", "sốt", "khám", "và", "thì", "nên", "có", "không", "đã", "rồi", "ạ", "nhưng", "cũng", "hay", "với",
  "ở", "tại", "là", "đến", "vì", "mà", "anh", "chị", "ông", "bà", "cô", "chú", "bác", "em", "con", "cháu", "tôi", "nói",
  "bảo", "đang", "sẽ", "muốn", "cần", "xin", "ơi", "nhờ", "hỏi", "thấy", "nghe", "ngứa", "chảy", "nhức", "ù", "tai", "mũi",
  "họng", "ngày", "tuần", "tháng", "năm", "nay", "qua", "từ", "trong", "khi", "lúc", "sau", "trước", "này", "đó", "kia",
  "ấy", "nhé", "nha", "vậy", "thế", "nữa", "rất", "hơi", "khá", "quá", "lắm", "đây", "nhà", "xa", "gần", "sĩ",
];
const ADMIN_WORDS = [
  "đường(?!\\s+(?:huyết|ruột|thở|mật|tiêu hóa|hô hấp|niệu|tiết niệu|dẫn|truyền|uống|tiêm|máu|kính|vào|ra))",
  "phố", "ngõ", "ngách", "hẻm", "phường", "xã(?!\\s+hội)", "thị trấn", "quận", "huyện", "thành phố",
  "tỉnh(?!\\s+(?:táo|dậy|lại|giấc|ngủ))", "thôn", "ấp", "khu phố", "tổ dân phố",
];
const ADMIN_SRC = ADMIN_WORDS.join("|");
const STOP_SRC = STOP_WORDS.join("|");
const SYL = `(?!(?:${ADMIN_SRC}|${STOP_SRC})(?![\\p{L}\\d]))\\p{L}+`;
const CITIES = "hà nội|hồ chí minh|sài gòn|tp\\.?\\s*hcm|đà nẵng|hải phòng|cần thơ|huế";

const HO_D = new Set(HO_VIET);
const AMBIGUOUS_ASCII_HO = new Set(["ho", "do", "la", "mai", "cao", "ta", "chu", "ma", "vi", "ca", "lai", "dang", "ong"]);
const HO_ASCII = new Set(HO_VIET.map(h => foldVietnamese(h)).filter(h => !AMBIGUOUS_ASCII_HO.has(h)));
/** Họ trùng chữ thường khác: đầu câu không có từ chỉ người thì không coi là họ. */
const SENTENCE_START_EXCLUDE = new Set(["cao", "dương", "lâm", "triệu", "trương", "mai", "la", "lã", "hà", "đỗ", "tiêu", "sơn", "đồng", "đào", "chu", "ca", "bình", "hầu", "lại", "ân", "viên", "vi", "sử", "hồ", "thân", "tôn", "tử"]);
const PERSON_TRIGGERS = new Set(["anh", "chị", "ông", "bà", "cô", "chú", "bác", "bé", "em", "con", "cháu", "tên", "bs", "thầy"]);
const TRIGGER_FILLERS = new Set(["sĩ", "là"]);
const STOP_SET = new Set(STOP_WORDS);

function isHo(d: string): boolean {
  if (HO_D.has(d)) return true;
  return /^[a-z]+$/.test(d) && HO_ASCII.has(d);
}

// ---------- Thu thập ứng viên ----------
interface Cand { rule: PiiRule; kind: PiiLabelKind; start: number; end: number; key: string }
type Add = (rule: PiiRule, kind: PiiLabelKind, s: number, e: number, key?: string) => void;

const UNNUMBERED = new Set<PiiLabelKind>(["BỆNH_NHÂN", "BÁC_SĨ", "NGÀY", "TUỔI", "GIỚI_TÍNH", "NỘI_DUNG_NGOÀI_KHÁM"]);
const RULES: PiiRule[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8"];
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function knownRegex(value: string): RegExp | null {
  const folded = foldVietnamese(value);
  if (folded.replace(/\s/g, "").length < 3) return null;
  const compact = folded.replace(/[\s.-]/g, "");
  const body = /^\+?\d{6,}$/.test(compact)
    ? [...compact].map(esc).join("[\\s.-]*")
    : folded.split(" ").map(esc).join("\\s+");
  return new RegExp(`(?<![a-z0-9])${body}(?![a-z0-9])`, "g");
}

export function redactPii(raw: string, known: KnownIdentifier[]): RedactionResult {
  const t = buildText(raw);
  const { f, d } = t;
  const accepted: Cand[] = [];
  const add: Add = (rule, kind, s, e, key) => {
    if (e <= s || accepted.some(c => s < c.end && e > c.start)) return;
    accepted.push({ rule, kind, start: s, end: e, key: key ?? f.slice(s, e).replace(/[\s.,-]/g, "") });
  };
  const scan = (rule: PiiRule, kind: PiiLabelKind, re: RegExp) => {
    for (const m of d.matchAll(re)) if (m[0].length > 0) add(rule, kind, m.index!, m.index! + m[0].length);
  };

  // R1: giá trị đã biết (dài trước)
  const sorted = [...known].filter(k => k.value?.trim()).sort((a, b) => b.value.length - a.value.length);
  for (const k of sorted) {
    const re = knownRegex(k.value);
    if (!re) continue;
    const key = foldVietnamese(k.value).replace(/[\s.-]/g, "");
    for (const m of f.matchAll(re)) add("R1", k.kind, m.index!, m.index! + m[0].length, key);
  }

  // R6: mã định danh
  const idValue = "(?:\\d{4,}(?:[ .-]?\\d{2,})*|[a-z]{1,6}-?\\d{3,}(?:-\\w+)*|\\d{2}[a-z]{1,2}[- ]?\\d{3}\\.?\\d{2})";
  const idKeywords = "cccd|cmnd|căn cước(?: công dân)?|hộ chiếu|(?:thẻ )?bhyt|thẻ bảo hiểm|bảo hiểm(?: y tế| bảo lãnh)?|mã bảo lãnh|pid|mã (?:bệnh nhân|định danh|hồ sơ)|số (?:tài khoản|thẻ|hồ sơ)|stk|tài khoản|biển số(?: xe)?";
  scan("R6", "MÃ_ĐỊNH_DANH", new RegExp(`(?<=(?<![\\p{L}])(?:${idKeywords})\\s*[:：]?\\s*)${idValue}(?![\\p{L}\\d])`, "gu"));
  scan("R6", "MÃ_ĐỊNH_DANH", /(?<![\p{L}\d])\d{2}[a-z]-?\d{3}\.\d{2}(?!\d)/gu);
  scan("R6", "MÃ_ĐỊNH_DANH", /(?<![\p{L}\d])[a-z]{2,5}-\d{4,}(?!\d)/gu);
  scan("R6", "MÃ_ĐỊNH_DANH", /(?<![\d.,])(?:\d{12}|\d{9})(?!\d)/gu);

  // R5: liên hệ
  scan("R5", "LIÊN_HỆ", /[\w.+%-]+@[\w.-]+\.[a-z]{2,}/gu);
  scan("R5", "LIÊN_HỆ", /(?:https?:\/\/|www\.)[^\s,;]*[^\s,;.]/gu);
  scan("R5", "LIÊN_HỆ", /(?<![\d.])(?:\d{1,3}\.){3}\d{1,3}(?![\d])/gu);
  scan("R5", "LIÊN_HỆ", /(?<![\d.,])(?:\+84|0)(?:[\s.-]*\d){8,10}(?!\d)/gu);
  scan("R5", "LIÊN_HỆ", /(?<=(?:số điện thoại|điện thoại|sđt|sdt|zalo|phone|liên hệ)\s*[:：]?\s*)\+?\d(?:[\s.-]?\d){7,}(?!\d)/gu);

  // R4: ngày tháng
  scan("R4", "NGÀY", /(?:ngày\s+)?\d{1,2}\s+tháng\s+\d{1,2}\s+năm\s+(?:19|20)\d{2}/gu);
  scan("R4", "NGÀY", /(?<=(?:ngày sinh|sinh ngày|năm sinh|sinh năm)\s*[:：]?\s*)\d{1,4}(?:[/.-]\d{1,4}){0,2}/gu);
  scan("R4", "NGÀY", /(?<![\d/.-])(?:\d{1,2}[/.-]\d{1,2}[/.-](?:19|20)\d{2}|(?:19|20)\d{2}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2})(?![\d/])/gu);
  scan("R4", "NGÀY", /(?<=(?:ngày\s+(?:khám|nhập viện|xuất viện|điều trị|tái khám)|(?:khám|nhập viện|xuất viện|điều trị|tái khám)\s+ngày)\s*[:：]?\s*)\d{1,2}[/.-]\d{1,2}(?![\d/.-])/gu);

  // R3: địa chỉ, địa danh
  scan("R3", "ĐỊA_DANH", new RegExp(`(?<![\\p{L}\\d])(?:số\\s+\\d+[a-z]?(?:/\\d+)*\\s+)?(?:${ADMIN_SRC})\\s+(?:\\d+|${SYL}(?:\\s+${SYL}){0,2})(?![\\p{L}\\d])`, "gu"));
  scan("R3", "ĐỊA_DANH", /(?<![\p{L}\d])số nhà\s*\d+[a-z]?(?:\/\d+)*/gu);
  scan("R3", "ĐỊA_DANH", new RegExp(`(?<![\\p{L}])(?:${CITIES})(?![\\p{L}])`, "gu"));
  scan("R3", "ĐỊA_DANH", new RegExp(`(?<=(?<![\\p{L}])(?:quê quán|quê|sống ở|sinh sống ở|cư trú ở|cư trú tại|sống tại|địa chỉ(?: nhà)?(?: là)?)\\s+(?:ở\\s+)?)${SYL}(?:\\s+${SYL}){0,2}`, "gu"));

  // R7: thông tin nhạy cảm
  const religions = "thiên chúa(?: giáo)?|công giáo|phật(?: giáo)?|tin lành|hồi(?: giáo)?|cao đài|hòa hảo";
  scan("R7", "THÔNG_TIN_NHẠY_CẢM", /(?<![\p{L}])quốc tịch\s+\p{L}+(?:\s+(?:quốc|lan|bản))?(?![\p{L}])/gu);
  scan("R7", "THÔNG_TIN_NHẠY_CẢM", new RegExp(`(?<![\\p{L}])(?:theo\\s+)?(?:(?<!âm\\s)đạo|tôn giáo)\\s+(?:${religions})(?![\\p{L}])`, "gu"));
  scan("R7", "THÔNG_TIN_NHẠY_CẢM", new RegExp(`(?<![\\p{L}])theo\\s+(?:${religions})(?![\\p{L}])`, "gu"));
  scan("R7", "THÔNG_TIN_NHẠY_CẢM", /(?<![\p{L}])(?:(?:đã|đang)\s+)?(?:ly hôn|li hôn|ly dị|ly thân|góa(?:\s+(?:chồng|vợ))?)(?![\p{L}])/gu);
  scan("R7", "THÔNG_TIN_NHẠY_CẢM", /(?<![\p{L}])(?:dân tộc\s+\p{L}+|đảng viên)(?![\p{L}])/gu);

  // R8: nội dung ngoài khám
  scan("R8", "NỘI_DUNG_NGOÀI_KHÁM", new RegExp(`(?<![\\p{L}])(?:chuyện\\s+(?:vay tiền|mua nhà|làm ăn|tiền bạc|đất đai|chính trị)|nợ nần|tranh chấp tài sản|cờ bạc|cá độ)(?:\\s+(?!(?:${STOP_SRC})(?![\\p{L}]))\\p{L}+){0,4}`, "gu"));

  // R2: tên người, dựa vào từ chỉ người hoặc đầu câu + họ
  nameScan(d, f, add);

  // Tuổi, giới tính (gắn R7 như bộ cũ)
  const age = "\\d{1,3}(?:[.,]\\d+)?\\s*(?:(?:tháng|năm)\\s*)?tuổi";
  scan("R7", "TUỔI", new RegExp(`(?:(?<![\\p{L}])tuổi\\s*[:：]\\s*\\d{1,3}(?:[.,]\\d+)?|(?<![\\p{L}\\d])${age})(?![\\p{L}\\d])`, "gu"));
  scan("R7", "GIỚI_TÍNH", /(?<=(?:giới tính\s*[:：]?\s*|(?<![\p{L}])bệnh nhân\s+|(?<![\p{L}])bn\s*[:：]\s*|tôi là\s+))(?:nam|nữ)(?![\p{L}])/gu);
  scan("R7", "GIỚI_TÍNH", new RegExp(`(?<![\\p{L}])(?:nam|nữ)(?=\\s+${age})`, "gu"));

  // Dựng kết quả: sắp theo vị trí, gán nhãn R10
  accepted.sort((a, b) => a.start - b.start);
  const counters = new Map<string, Map<string, number>>();
  const label = (c: Cand): string => {
    if (UNNUMBERED.has(c.kind)) return `[${c.kind}]`;
    let m = counters.get(c.kind);
    if (!m) counters.set(c.kind, m = new Map());
    let n = m.get(c.key);
    if (n === undefined) m.set(c.key, n = m.size + 1);
    return `[${c.kind}_${n}]`;
  };
  const counts = Object.fromEntries(RULES.map(r => [r, 0])) as Record<PiiRule, number>;
  const spans: PiiSpan[] = accepted.map(c => {
    counts[c.rule]++;
    return { rule: c.rule, kind: c.kind, start: t.startMap[c.start], end: t.endMap[c.end - 1], label: label(c) };
  });
  let clean = raw;
  for (let i = spans.length - 1; i >= 0; i--) clean = clean.slice(0, spans[i].start) + spans[i].label + clean.slice(spans[i].end);
  return { raw, clean, spans, counts };
}

function nameScan(d: string, f: string, add: Add): void {
  const toks = [...d.matchAll(/[\p{L}\p{N}]+/gu)].map(m => ({ w: m[0], s: m.index!, e: m.index! + m[0].length }));
  const joined = (a: number, b: number) => !/[,;.!?\n:]/.test(d.slice(toks[a].e, toks[b].s));
  const startOfSentence = (i: number) => i === 0 || /[.!?\n]/.test(d.slice(toks[i - 1].e, toks[i].s));
  for (let i = 0; i < toks.length; i++) {
    let j = -1;
    let needFollow = 1;
    if (PERSON_TRIGGERS.has(toks[i].w)) {
      j = i + 1;
      for (let n = 0; n < 2 && j < toks.length && TRIGGER_FILLERS.has(toks[j].w) && joined(j - 1, j); n++) j++;
      if (j < toks.length && !joined(j - 1, j)) continue;
    } else if (startOfSentence(i) && !SENTENCE_START_EXCLUDE.has(toks[i].w)) {
      j = i;
      needFollow = 2;
    }
    if (j < 0 || j >= toks.length || !isHo(toks[j].w)) continue;
    let k = j + 1;
    while (k <= j + 3 && k < toks.length && joined(k - 1, k) && /^\p{L}+$/u.test(toks[k].w) && !STOP_SET.has(toks[k].w)) k++;
    if (k - j - 1 < needFollow) continue;
    const s = toks[j].s, e = toks[k - 1].e;
    add("R2", "NGƯỜI", s, e, f.slice(s, e).replace(/\s/g, ""));
    i = k - 1;
  }
}
