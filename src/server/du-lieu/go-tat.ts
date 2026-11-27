// Đọc bộ gõ tắt riêng của bác sĩ: data/go-tat/<tài khoản>.json (không đưa lên git, có thể là câu chữ thật của bác sĩ).
// Tài khoản chưa có file riêng thì dùng bộ giả data/eform/go-tat-mau.json.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { O_GO_TAT, type GoTat } from "@/shared/eform/go-tat";
import { MAU_TAI_KHOAN } from "./thoi-quen";

const THU_MUC_RIENG = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "go-tat");
const FILE_GIA = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "eform", "go-tat-mau.json");
const MA_HOP_LE = /^\S{1,20}$/;

/** Bỏ dòng sai (ô không có trên phiếu ngoại trú, thiếu mã hay câu); mã trùng thì giữ dòng đầu như UniKey */
export function kiemTraGoTat(ds: unknown[]): GoTat[] {
  const daCo = new Set<string>();
  const bo: GoTat[] = [];
  for (const item of ds) {
    const { ma, o, noi_dung } = (item ?? {}) as Partial<Record<keyof GoTat, unknown>>;
    if (typeof ma !== "string" || !MA_HOP_LE.test(ma) || daCo.has(ma)) continue;
    if (typeof o !== "string" || !(O_GO_TAT as readonly string[]).includes(o)) continue;
    if (typeof noi_dung !== "string" || !noi_dung.trim()) continue;
    daCo.add(ma);
    bo.push({ ma, o: o as GoTat["o"], noi_dung: noi_dung.trim() });
  }
  return bo;
}

export function docBoGoTat(file: string): GoTat[] {
  try {
    const ds = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
    return Array.isArray(ds) ? kiemTraGoTat(ds) : [];
  } catch {
    return [];
  }
}

/** rieng: true khi đọc được file riêng của tài khoản */
export function docGoTat(taiKhoan: string): { bo: GoTat[]; rieng: boolean } {
  if (MAU_TAI_KHOAN.test(taiKhoan)) {
    const file = path.join(THU_MUC_RIENG, `${taiKhoan}.json`);
    if (fs.existsSync(file)) return { bo: docBoGoTat(file), rieng: true };
  }
  return { bo: docBoGoTat(FILE_GIA), rieng: false };
}
