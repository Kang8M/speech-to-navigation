// Kiểm tra dữ liệu data/eform/thu-vien.json: ô có thật trên eForm, không còn chỗ trống [ ], tiền tố ICD tra được.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import type { ThuVien } from "@/shared/eform/goi-y-tab";
import { normalizeVi } from "@/shared/normalize";
import { loadIcd10 } from "./danh-muc";

/** Các ô chữ tự do có chữ mờ Tab trên eForm (TextBox trong src/client/eform/EformForm.tsx) */
const O_CHU = [
  "ly_do",
  "tien_su_ban_than",
  "tien_su_gia_dinh",
  "di_ung_mo_ta",
  "benh_su",
  "kham_toan_than",
  "kham_chuyen_khoa",
  "kham_khac",
  "ghi_chu_kq",
  "huong_dieu_tri",
  "loi_dan",
];

const thuVien = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "eform", "thu-vien.json"), "utf8")) as ThuVien;
const moiNhom = [{ id: "chung", cau: thuVien.chung }, ...thuVien.nhom];

test("mọi ô đều có câu chung, mỗi nhóm có id riêng", () => {
  assert.deepEqual(O_CHU.filter((o) => !thuVien.chung[o]?.length), []);
  assert.equal(new Set(thuVien.nhom.map((nhom) => nhom.id)).size, thuVien.nhom.length);
});

test("câu chỉ ghi vào ô có thật, không còn chỗ trống [ ], không trùng trong cùng ô của một nhóm", () => {
  for (const nhom of moiNhom) {
    for (const [o, cau] of Object.entries(nhom.cau)) {
      assert.ok(O_CHU.includes(o), `${nhom.id}: ô "${o}" không có trên eForm`);
      assert.deepEqual(cau.filter((item) => item.includes("[")), [], `${nhom.id}.${o}`);
      assert.equal(new Set(cau.map(normalizeVi)).size, cau.length, `${nhom.id}.${o} có câu trùng`);
    }
  }
});

test("mỗi tiền tố ICD của nhóm khớp ít nhất một mã trong danh mục", () => {
  const ma = loadIcd10().map((item) => item.ma);
  const thieu = thuVien.nhom.flatMap((nhom) => nhom.icd.filter((tienTo) => !ma.some((item) => item.startsWith(tienTo))).map((tienTo) => `${nhom.id}: ${tienTo}`));
  assert.deepEqual(thieu, []);
});
