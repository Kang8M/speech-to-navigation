// Kiểm tra dữ liệu data/eform/goi-chi-dinh.json: mã gói không trùng, mọi dịch vụ khớp chắc danh mục, tiền tố ICD có thật.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { khopGoi, type GoiChiDinhGoc } from "@/shared/eform/goi-chi-dinh";
import { khopMaIcd } from "@/shared/eform/goi-y";
import { loadCatalogs, loadVietTat } from "./config";
import { loadIcd10 } from "./danh-muc";

const goc = (
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "eform", "goi-chi-dinh.json"), "utf8")) as { goi: GoiChiDinhGoc[] }
).goi;
const goi = khopGoi(goc, loadCatalogs()["dich-vu"] ?? [], loadVietTat());

test("mã gói không trùng, gói nào cũng có dịch vụ", () => {
  assert.equal(new Set(goc.map((g) => g.ma)).size, goc.length);
  assert.deepEqual(goc.filter((g) => g.dich_vu.length === 0).map((g) => g.ma), []);
});

test("mọi dịch vụ trong gói khớp chắc danh mục, không trùng mã trong một gói", () => {
  const loi = goi.flatMap((g) => g.dichVu.filter((dong) => dong.nguon === "xem").map((dong) => `${g.ma} › ${dong.ten}`));
  assert.deepEqual(loi, []);
  const trung = goi.filter((g) => new Set(g.dichVu.map((d) => d.ma)).size !== g.dichVu.length).map((g) => g.ma);
  assert.deepEqual(trung, []);
});

test("mỗi mã hoặc tiền tố ICD của gói khớp ít nhất một mã trong danh mục", () => {
  const maIcd = loadIcd10().map((item) => item.ma);
  const thieu = goc.flatMap((g) => g.icd.filter((tienTo) => !maIcd.some((ma) => khopMaIcd(ma, tienTo))).map((tienTo) => `${g.ma}: ${tienTo}`));
  assert.deepEqual(thieu, []);
});
