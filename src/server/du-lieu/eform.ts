// Đọc dữ liệu trang eForm từ data/eform/ mỗi lần tải trang.
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getProviderName, loadCases, loadCatalogs, loadRules, loadVietTat } from "./config";
import { loadIcd10 } from "./danh-muc";
import { khopBoMau, type MauGoiYGoc } from "@/shared/eform/goi-y";
import type { CaGia, EformData, MauCauData, QuyTacAi, TuyChon } from "@/shared/eform/types";

/** Ca mẫu trùng bệnh nhân giả của trang eForm; ở chế độ mock câu này trả kết quả soạn sẵn */
const CA_MAU = "ca-11";

function readJson<T>(name: string): T {
  const file = path.join(/*turbopackIgnore: true*/ process.cwd(), "data", "eform", name);
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

export function loadEformData(): EformData {
  const catalogs = loadCatalogs();
  const caMau = loadCases().find((item) => item.id === CA_MAU);
  const danhMuc = { dichVu: catalogs["dich-vu"] ?? [], thuoc: catalogs["thuoc"] ?? [] };
  const vietTat = loadVietTat();
  return {
    ca: readJson<CaGia>("ca-gia.json"),
    icd10: loadIcd10(),
    thuVien: readJson<Record<string, string[]>>("thu-vien.json"),
    tuyChon: readJson<TuyChon>("tuy-chon.json"),
    quyTac: readJson<QuyTacAi>("quy-tac.json"),
    mauCau: readJson<MauCauData>("mau-cau.json"),
    danhMuc,
    vietTat,
    canhBao: loadRules(),
    goiY: khopBoMau(readJson<{ mau: MauGoiYGoc[] }>("goi-y-theo-chan-doan.json").mau, danhMuc, vietTat),
    provider: getProviderName(),
    cauMau: { id: CA_MAU, noi: caMau?.input_noi ?? "", goTat: caMau?.input_go_tat ?? "" },
  };
}
