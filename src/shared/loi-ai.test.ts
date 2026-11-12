import assert from "node:assert/strict";
import { test } from "node:test";
import { thongBaoLoiAi } from "./loi-ai";

const GEMINI_503 =
  '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}';
const GEMINI_429 = '{"error":{"code":429,"message":"You exceeded your current quota","status":"RESOURCE_EXHAUSTED"}}';

test("quá tải (503) báo tiếng Việt, không lộ JSON", () => {
  const loi = thongBaoLoiAi(GEMINI_503);
  assert.match(loi, /quá tải/);
  assert.doesNotMatch(loi, /[{}]|UNAVAILABLE|demand/);
});

test("hết lượt gọi (429) báo chờ rồi bấm lại", () => assert.match(thongBaoLoiAi(GEMINI_429), /hết lượt/));

test("mất mạng báo kiểm tra kết nối", () => assert.match(thongBaoLoiAi("fetch failed"), /kết nối/));

test("lỗi lạ vẫn là câu tiếng Việt, kết thúc bằng dấu chấm", () => {
  const loi = thongBaoLoiAi("Unexpected token < in JSON at position 0");
  assert.doesNotMatch(loi, /Unexpected/);
  assert.match(loi, /\.$/);
});
