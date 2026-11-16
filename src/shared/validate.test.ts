import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { Values, WarningRules } from "./types";
import { applyTotals, computeTotal } from "./validate";

const rules = JSON.parse(fs.readFileSync("config/canh-bao.json", "utf8")) as WarningRules;

test("thuốc đếm được: liều × số lần/ngày × số ngày", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", so_lan_ngay: 3, so_ngay: 3 }, rules), 9);
  assert.equal(computeTotal({ lieu_moi_lan: "1/2 viên", so_lan_ngay: 3, so_ngay: 3 }, rules), 5);
});

test("số lượng bác sĩ nói rõ được ưu tiên hơn số tự tính", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", so_lan_ngay: 3, so_ngay: 3, so_luong_ke: 10 }, rules), 10);
});

test("thuốc dùng khi cần không có số lần/ngày: có số lượng kê thì ra tổng, không thì để trống", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", khi_can: "Có", so_luong_ke: 10 }, rules), 10);
  assert.equal(computeTotal({ lieu_moi_lan: "1 viên", khi_can: "Có", so_ngay: 3 }, rules), null);
});

test("thuốc không đếm được (xịt, giọt) không tự tính", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "2 xịt", so_lan_ngay: 2, so_ngay: 7 }, rules), null);
});

test("đơn vị viết tắt (\"1 v\", \"1v\") vẫn tính được tổng", () => {
  assert.equal(computeTotal({ lieu_moi_lan: "1 v", so_lan_ngay: 2, so_ngay: 7 }, rules), 14);
  assert.equal(computeTotal({ lieu_moi_lan: "1/2v", so_lan_ngay: 2, so_ngay: 5 }, rules), 5);
});

test("applyTotals bung đơn vị viết tắt trong liều để phiếu hiện đủ chữ", () => {
  const draft: { ke_don: Values[] } = { ke_don: [{ lieu_moi_lan: "1 v", so_lan_ngay: 2, so_ngay: 7 }, { lieu_moi_lan: "2 xịt", so_lan_ngay: 2, so_ngay: 7 }] };
  applyTotals(draft, rules);
  assert.equal(draft.ke_don[0].lieu_moi_lan, "1 viên");
  assert.equal(draft.ke_don[0].tong_so_luong, 14);
  assert.equal(draft.ke_don[1].lieu_moi_lan, "2 xịt");
});
