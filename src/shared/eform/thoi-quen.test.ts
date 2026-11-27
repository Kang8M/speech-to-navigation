import assert from "node:assert/strict";
import { test } from "node:test";
import { COT_THUOC } from "./thoi-quen";

test("cột thuốc lưu thói quen có khi_can và so_luong_ke", () => {
  assert.ok(COT_THUOC.includes("khi_can"));
  assert.ok(COT_THUOC.includes("so_luong_ke"));
});
