import assert from "node:assert/strict";
import { test } from "node:test";
import { chuanHoaCau } from "./chuan-hoa-cau";

test("zipformer: chữ in hoa thành chữ thường, viết hoa đầu câu", () =>
  assert.equal(chuanHoaCau("ĐAU HỌNG BA NGÀY", "zipformer", true), "Đau họng ba ngày."));
test("zipformer chữ tạm không thêm dấu chấm", () =>
  assert.equal(chuanHoaCau("ĐAU HỌNG", "zipformer", false), "Đau họng"));
test("rumble: giữ hoa thường và dấu câu sẵn có", () =>
  assert.equal(chuanHoaCau("Viêm họng cấp, cho Augmentin 1g.", "rumble", true), "Viêm họng cấp, cho Augmentin 1g."));
test("rumble: bỏ tiền tố nhận diện ngôn ngữ", () =>
  assert.equal(chuanHoaCau("language Vietnamese<asr_text>Đau tai trái", "rumble", true), "Đau tai trái."));
test("câu rỗng hoặc chỉ dấu câu trả rỗng", () => {
  assert.equal(chuanHoaCau("  ", "rumble", true), "");
  assert.equal(chuanHoaCau(".", "rumble", true), "");
});
