// Đọc cấu hình JSON từ đĩa mỗi lần gọi, nên sửa file rồi tải lại trang là thấy ngay.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  CaseData,
  FormConfig,
  VietTat,
  WarningRules,
} from "@/shared/types";

export { loadCatalogs } from "./danh-muc";

const FORM_FILES = ["phieu-kham", "chi-dinh", "ke-don"];

function readJson<T>(...parts: string[]): T {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), ...parts);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadForms(): FormConfig[] {
  return FORM_FILES.map((name) =>
    readJson<FormConfig>("config", "forms", `${name}.json`),
  );
}

export function loadTheme(): Record<string, string> {
  return readJson<Record<string, string>>("config", "theme.json");
}

export function loadVietTat(): VietTat {
  return readJson<VietTat>("config", "viet-tat.json");
}

export function loadRules(): WarningRules {
  return readJson<WarningRules>("config", "canh-bao.json");
}

export function loadCases(): CaseData[] {
  const dir = path.join(process.cwd(), "data", "cases");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((file) => readJson<CaseData>("data", "cases", file));
}

export function getProviderName(): string {
  return process.env.LLM_PROVIDER?.trim() || "mock";
}
