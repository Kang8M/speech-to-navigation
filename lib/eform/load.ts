// Đọc dữ liệu trang eForm từ data/eform/ mỗi lần tải trang.
import fs from "node:fs";
import path from "node:path";
import type { CaGia, EformData, Icd10, MauCauData, QuyTacAi, TuyChon } from "./types";

function readJson<T>(name: string): T {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "eform", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadEformData(): EformData {
  return {
    ca: readJson<CaGia>("ca-gia.json"),
    icd10: readJson<Icd10[]>("icd10.json"),
    thuVien: readJson<Record<string, string[]>>("thu-vien.json"),
    tuyChon: readJson<TuyChon>("tuy-chon.json"),
    quyTac: readJson<QuyTacAi>("quy-tac.json"),
    mauCau: readJson<MauCauData>("mau-cau.json"),
  };
}
