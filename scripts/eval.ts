// Chạy toàn bộ ca mẫu qua pipeline, so với expected và in bảng độ chính xác.
//   npm run eval                     dùng LLM_PROVIDER trong .env.local (mặc định mock)
//   npm run eval -- --rule-only      chỉ chạy bộ tách bằng quy tắc, làm mốc so sánh
//   npm run eval -- --provider=anthropic   (hoặc openai, gemini)
import { loadCases, loadCatalogs, loadForms, loadRules, loadVietTat } from "../lib/config";
import { normalizeVi } from "../lib/normalize";
import { runPipeline } from "../lib/pipeline";
import { fillDraft } from "../lib/schema";
import type { FieldDef, FieldValue, FormConfig, Values } from "../lib/types";

/** Ngưỡng giống nhau của văn bản tự do, vì LLM có thể diễn đạt khác đi đôi chút */
const TEXT_SIMILARITY = 0.7;
/** Ngưỡng tên để ghép một dòng kết quả với một dòng mong muốn */
const ROW_SIMILARITY = 0.5;

type Outcome = "dung" | "sai" | "thieu" | "thua";

interface Tally {
  dung: number;
  sai: number;
  thieu: number;
  thua: number;
}

const emptyTally = (): Tally => ({ dung: 0, sai: 0, thieu: 0, thua: 0 });

function isEmpty(value: FieldValue | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}

function tokens(text: string): string[] {
  return normalizeVi(text).split(" ").filter(Boolean);
}

function dice(a: string, b: string): number {
  const left = new Set(tokens(a));
  const right = new Set(tokens(b));
  if (left.size + right.size === 0) return 1;
  const shared = [...left].filter((token) => right.has(token)).length;
  return (2 * shared) / (left.size + right.size);
}

/** Số liệu và bên phải/trái phải trùng khít: chữ giống nhau nhưng sai số vẫn là sai */
function criticalTokensMatch(a: string, b: string): boolean {
  const critical = (text: string) =>
    tokens(text)
      .filter((token) => /\d/.test(token) || token === "phai" || token === "trai")
      .sort()
      .join(" ");
  return critical(a) === critical(b);
}

function sameValue(field: FieldDef, expected: FieldValue, actual: FieldValue): boolean {
  if (field.type === "number") return Number(expected) === Number(actual);
  const left = String(expected);
  const right = String(actual);
  if (field.type === "select" || field.catalog) return normalizeVi(left) === normalizeVi(right);
  return dice(left, right) >= TEXT_SIMILARITY && criticalTokensMatch(left, right);
}

function score(field: FieldDef, expected: FieldValue | undefined, actual: FieldValue | undefined): Outcome | null {
  const noExpected = isEmpty(expected);
  const noActual = isEmpty(actual);
  if (noExpected && noActual) return null;
  if (noExpected) return "thua";
  if (noActual) return "thieu";
  return sameValue(field, expected as FieldValue, actual as FieldValue) ? "dung" : "sai";
}

/** Ghép từng dòng mong muốn với dòng kết quả có tên giống nhất */
function alignRows(form: FormConfig, expected: Values[], actual: Values[]) {
  const nameId = form.fields.find((field) => field.name_field)?.name_field ?? form.fields[0].id;
  const unused = new Set(actual.map((_, index) => index));
  const pairs: [Values | null, Values | null][] = [];
  for (const row of expected) {
    let best = -1;
    let bestScore = ROW_SIMILARITY;
    for (const index of unused) {
      const similarity = dice(String(row[nameId] ?? ""), String(actual[index][nameId] ?? ""));
      if (similarity >= bestScore) {
        best = index;
        bestScore = similarity;
      }
    }
    if (best >= 0) unused.delete(best);
    pairs.push([row, best >= 0 ? actual[best] : null]);
  }
  for (const index of unused) pairs.push([null, actual[index]]);
  return pairs;
}

function accuracy(tally: Tally): string {
  const total = tally.dung + tally.sai + tally.thieu + tally.thua;
  return total === 0 ? "–" : `${((tally.dung / total) * 100).toFixed(1)}%`;
}

function printTable(title: string, rows: [string, Tally][]) {
  console.log(`\n${title}`);
  const width = Math.max(10, ...rows.map(([name]) => name.length)) + 2;
  console.log(`${"".padEnd(width)}${"Đúng".padStart(7)}${"Sai".padStart(7)}${"Thiếu".padStart(7)}${"Thừa".padStart(7)}${"Chính xác".padStart(11)}`);
  for (const [name, tally] of rows) {
    console.log(
      `${name.padEnd(width)}${String(tally.dung).padStart(7)}${String(tally.sai).padStart(7)}${String(tally.thieu).padStart(7)}${String(tally.thua).padStart(7)}${accuracy(tally).padStart(11)}`,
    );
  }
}

async function main() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Không có .env.local thì dùng mock
  }
  const args = process.argv.slice(2);
  const ruleOnly = args.includes("--rule-only");
  const providerArg = args.find((arg) => arg.startsWith("--provider="))?.split("=")[1];
  const provider = ruleOnly ? "mock" : providerArg || process.env.LLM_PROVIDER?.trim() || "mock";

  const forms = loadForms();
  const cases = loadCases();
  const context = { forms, catalogs: loadCatalogs(), vietTat: loadVietTat(), rules: loadRules(), cases };

  const variants = [
    { key: "input_noi", label: "nói" },
    { key: "input_go_tat", label: "gõ tắt" },
  ] as const;

  const bySection = new Map<string, Tally>();
  const byField = new Map<string, Tally>();
  const failures: string[] = [];
  let extraRows = 0;

  const add = (map: Map<string, Tally>, key: string, outcome: Outcome) => {
    const tally = map.get(key) ?? emptyTally();
    tally[outcome]++;
    map.set(key, tally);
  };

  console.log(`Chế độ: ${ruleOnly ? "mock, chỉ bộ tách quy tắc" : provider} · ${cases.length} ca x ${variants.length} kiểu nhập`);

  for (const item of cases) {
    for (const variant of variants) {
      let result;
      try {
        result = await runPipeline(item[variant.key], context, { provider, ruleOnly });
      } catch (error) {
        failures.push(`${item.id} (${variant.label}): ${error instanceof Error ? error.message : error}`);
        continue;
      }
      const expected = fillDraft(item.expected, forms);
      const record = (form: FormConfig, want: Values | null, got: Values | null) => {
        for (const field of form.fields) {
          const outcome = score(field, want?.[field.id], got?.[field.id]);
          if (!outcome) continue;
          add(bySection, `${form.title} (${variant.label})`, outcome);
          add(byField, `${form.id}.${field.id}`, outcome);
        }
      };
      for (const form of forms) {
        if (form.mode === "single") {
          record(form, expected[form.id] as Values, result.draft[form.id] as Values);
          continue;
        }
        for (const [want, got] of alignRows(form, expected[form.id] as Values[], result.draft[form.id] as Values[])) {
          if (!want) extraRows++;
          record(form, want, got);
        }
      }
    }
  }

  const sections = forms.flatMap((form) => variants.map((variant) => `${form.title} (${variant.label})`));
  printTable("Theo từng phần", sections.map((name) => [name, bySection.get(name) ?? emptyTally()]));
  printTable("Theo từng trường", [...byField.entries()]);

  console.log(`\nDòng thừa (dịch vụ/thuốc không có trong kết quả mong muốn): ${extraRows}`);
  console.log(`Chính xác = Đúng / (Đúng + Sai + Thiếu + Thừa). Thừa nghĩa là pipeline điền trường mà bác sĩ không nói.`);
  if (provider === "mock" && !ruleOnly) {
    console.log("Lưu ý: mock trả kết quả soạn sẵn cho ca mẫu nên điểm gần 100% là đương nhiên, chỉ để kiểm tra pipeline. Dùng --rule-only hoặc LLM thật để có số đo có ý nghĩa.");
  }
  if (failures.length > 0) {
    console.log(`\nCó ${failures.length} lượt lỗi:`);
    failures.forEach((failure) => console.log(`- ${failure}`));
    process.exitCode = 1;
  }
}

main();
