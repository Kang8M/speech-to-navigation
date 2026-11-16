// Kiểm tra bộ gõ tắt giả data/eform/go-tat-mau.json và cách chọn bộ riêng theo tài khoản.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { O_GO_TAT } from "@/shared/eform/go-tat";
import { docBoGoTat, docGoTat, kiemTraGoTat } from "./go-tat";

test("bộ giả hợp lệ: mã không trùng, ô đúng, có câu", () => {
  const bo = docBoGoTat(path.join(process.cwd(), "data", "eform", "go-tat-mau.json"));
  assert.ok(bo.length >= 10, `mới có ${bo.length} mã`);
  assert.equal(new Set(bo.map((item) => item.ma)).size, bo.length);
  for (const item of bo) {
    assert.ok((O_GO_TAT as readonly string[]).includes(item.o), `${item.ma}: ô ${item.o}`);
    assert.ok(item.noi_dung.trim(), `${item.ma}: chưa có câu`);
  }
});

test("tài khoản chưa có bộ riêng thì dùng bộ giả; tên tài khoản sai dạng cũng vậy", () => {
  const gia = docBoGoTat(path.join(process.cwd(), "data", "eform", "go-tat-mau.json"));
  assert.deepEqual(docGoTat("chua_co_tai_khoan_nay").bo, gia);
  assert.equal(docGoTat("chua_co_tai_khoan_nay").rieng, false);
  assert.equal(docGoTat("../../etc").rieng, false);
});

test("kiemTraGoTat bỏ dòng sai ô, thiếu mã, mã có dấu cách; mã trùng thì giữ dòng đầu", () => {
  const bo = kiemTraGoTat([
    { ma: "tbt", o: "kham_chuyen_khoa", noi_dung: "Tai sạch." },
    { ma: "tbt", o: "loi_dan", noi_dung: "trùng" },
    { ma: "x y", o: "loi_dan", noi_dung: "có dấu cách" },
    { ma: "", o: "loi_dan", noi_dung: "thiếu mã" },
    { ma: "ava", o: "phau_thuat", noi_dung: "ô không có trên phiếu ngoại trú" },
    { ma: "ld", o: "loi_dan", noi_dung: "  " },
  ]);
  assert.deepEqual(bo, [{ ma: "tbt", o: "kham_chuyen_khoa", noi_dung: "Tai sạch." }]);
});

test("file không đọc được thì trả rỗng, không làm hỏng trang", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "go-tat-")), "hong.json");
  fs.writeFileSync(f, "{ không phải json");
  assert.deepEqual(docBoGoTat(f), []);
});
