import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { WarningRules } from "./types";
import { applyTotals, bungDonViLieu, computeTotal } from "./validate";

const rules = JSON.parse(fs.readFileSync("config/canh-bao.json", "utf8")) as WarningRules;

test('liều "1 v" bung thành "1 viên" và tính tổng', () => {
  assert.equal(bungDonViLieu("1 v", rules), "1 viên");
  assert.equal(bungDonViLieu("1/2v", rules), "1/2 viên");
  assert.equal(bungDonViLieu("1 viên", rules), "1 viên");
  assert.equal(computeTotal({ lieu_moi_lan: "1 v", so_lan_ngay: "3", so_ngay: "5" }, rules), 15);
  assert.equal(computeTotal({ lieu_moi_lan: "1/2v", so_lan_ngay: "2", so_ngay: "4" }, rules), 4);
});

test("có số lượng kê thì lấy số đó bất kể liều", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 v", so_lan_ngay: "3", so_ngay: "5", so_luong_ke: "10" }, rules), 10);
});

test("thuốc dùng khi cần không số lần: có số lượng kê thì ra số đó, không thì null", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", so_lan_ngay: "", so_ngay: "", so_luong_ke: "6" }, rules), 6);
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", so_lan_ngay: "", so_ngay: "" }, rules), null);
});

test("applyTotals bung đơn vị gõ tắt trong liều rồi ghi tổng", () => {
  const draft = { ke_don: [{ lieu_moi_lan: "1 v", so_lan_ngay: "2", so_ngay: "3" }] };
  applyTotals(draft, rules);
  assert.equal(draft.ke_don[0].lieu_moi_lan, "1 viên");
  assert.deepEqual((draft.ke_don[0] as Record<string, unknown>).tong_so_luong, 6);
});
