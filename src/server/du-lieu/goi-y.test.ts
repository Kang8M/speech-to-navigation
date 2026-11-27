// Kiểm tra dữ liệu data/eform/goi-y-theo-chan-doan.json: khớp danh mục, tiền tố ICD, không chồng mã, phủ mọi phiếu mẫu.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { chonBoMau, khopBoMau, khopMaIcd, type MauGoiYGoc } from "@/shared/eform/goi-y";
import { loadCatalogs, loadVietTat } from "./config";
import { loadIcd10 } from "./danh-muc";
import { loadPhieuMau } from "./phieu-mau";

const goc = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "eform", "goi-y-theo-chan-doan.json"), "utf8")) as { mau: MauGoiYGoc[] }
).mau;
const catalogs = loadCatalogs();
const boMau = khopBoMau(goc, { dichVu: catalogs["dich-vu"] ?? [], thuoc: catalogs["thuoc"] ?? [] }, loadVietTat());
const maIcd = loadIcd10().map((item) => item.ma);

test("id không trùng, mỗi bộ có ít nhất một chỉ định", () => {
  assert.equal(new Set(goc.map((m) => m.id)).size, goc.length);
  assert.deepEqual(goc.filter((m) => m.chi_dinh.length === 0).map((m) => m.id), []);
});

test("mọi dòng chỉ định và thuốc khớp chắc danh mục", () => {
  const loi = boMau.flatMap((m) => [...m.chiDinh, ...m.donThuoc].filter((dong) => dong.nguon !== "ai").map((dong) => `${m.id} › ${dong.ten}`));
  assert.deepEqual(loi, []);
});

test("mỗi mã hoặc tiền tố ICD khớp ít nhất một mã trong danh mục", () => {
  const thieu = goc.flatMap((m) => m.icd.filter((tienTo) => !maIcd.some((ma) => khopMaIcd(ma, tienTo))).map((tienTo) => `${m.id}: ${tienTo}`));
  assert.deepEqual(thieu, []);
});

test("không mã ICD nào khớp hai bộ (tránh tích sẵn hai đơn cùng lúc)", () => {
  const trung = maIcd
    .map((ma) => ({ ma, bo: goc.filter((m) => m.icd.some((tienTo) => khopMaIcd(ma, tienTo))).map((m) => m.id) }))
    .filter((item) => item.bo.length > 1)
    .map((item) => `${item.ma}: ${item.bo.join(", ")}`);
  assert.deepEqual(trung, []);
});

test("mã ICD của mọi phiếu mẫu đều có bộ gợi ý", () => {
  const thieu = loadPhieuMau().filter((m) => chonBoMau([m.icd], boMau).length === 0).map((m) => `${m.id} (${m.icd})`);
  assert.deepEqual(thieu, []);
});

test("trong một bộ không có hai dòng cùng mã (dòng sau chỉ hiện 'Trùng gợi ý phía trên')", () => {
  const trung = boMau.flatMap((m) =>
    [m.chiDinh, m.donThuoc].flatMap((dong) => {
      const ma = dong.map((d) => d.ma);
      return ma.filter((item, i) => ma.indexOf(item) !== i).map((item) => `${m.id}: ${item}`);
    }),
  );
  assert.deepEqual(trung, []);
});
