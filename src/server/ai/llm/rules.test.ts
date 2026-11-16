import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCatalogs, loadForms, loadVietTat } from "@/server/du-lieu/config";
import type { Values } from "@/shared/types";
import { ruleExtract } from "./rules";

const forms = loadForms();
const catalogs = loadCatalogs();
const vietTat = loadVietTat();
const donThuoc = (text: string) => (ruleExtract(text, forms, catalogs, vietTat).ke_don ?? []) as Values[];

test("thuốc dùng khi cần: không có số lần/ngày, lấy số lượng kê và giới hạn", () => {
  const [row] = donThuoc("Kê đơn: Paracetamol 500 mg uống 1 viên khi đau, cách nhau 4 đến 6 giờ, tối đa 4 viên một ngày, kê 10 viên.");
  assert.equal(row.ten_thuoc, "Paracetamol");
  assert.equal(row.lieu_moi_lan, "1 viên");
  assert.equal(row.khi_can, "Có");
  assert.equal(row.so_lan_ngay, null);
  assert.equal(row.so_ngay, null);
  assert.equal(row.so_luong_ke, 10);
  assert.equal(row.thoi_diem, "Khi đau");
  assert.equal(row.ghi_chu, "Cách nhau 4 đến 6 giờ, tối đa 4 viên một ngày");
});

test("tên thuốc đứng trước 'khi đau' không dính chữ", () => {
  const [row] = donThuoc("Kê đơn: Paracetamol uống khi đau, kê 10 viên");
  assert.equal(row.ten_thuoc, "Paracetamol");
  assert.equal(row.lieu_moi_lan, null);
  assert.equal(row.so_luong_ke, 10);
});

test("dùng khi cần kèm tối đa số lần/ngày thì giữ số lần đó", () => {
  const [row] = donThuoc("Kê đơn: Paracetamol 500 mg uống 1 viên một lần, ngày 3 lần, khi đau hoặc sốt, 3 ngày.");
  assert.equal(row.khi_can, "Có");
  assert.equal(row.so_lan_ngay, 3);
  assert.equal(row.so_ngay, 3);
  assert.equal(row.so_luong_ke, null);
});

test("thuốc uống theo giờ cố định không bị đánh dấu khi cần", () => {
  const [row] = donThuoc("Kê đơn: Cefuroxim 500 mg uống 1 viên một lần, ngày 2 lần, sau ăn, 7 ngày.");
  assert.equal(row.khi_can, null);
  assert.equal(row.so_luong_ke, null);
  assert.equal(row.ghi_chu, null);
});
