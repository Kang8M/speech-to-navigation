import assert from "node:assert/strict";
import { test } from "node:test";
import { giaiMaChiaDoi, getAsrModel } from "./bo-nhan-dang";

const MAU = 16000;

test("giaiMaChiaDoi: đoạn ngắn giải mã một lần", () => {
  const goi: number[] = [];
  const text = giaiMaChiaDoi(new Float32Array(10 * MAU), (s) => (goi.push(s.length), "a"), 18 * MAU);
  assert.equal(text, "a");
  assert.deepEqual(goi, [10 * MAU]);
});

test("giaiMaChiaDoi: đoạn 20 giây chia đôi và nối chữ bằng dấu cách", () => {
  const goi: number[] = [];
  let n = 0;
  const text = giaiMaChiaDoi(new Float32Array(20 * MAU), (s) => (goi.push(s.length), `p${++n}`), 18 * MAU);
  assert.equal(text, "p1 p2");
  assert.deepEqual(goi, [10 * MAU, 10 * MAU]);
});

test("giaiMaChiaDoi: chia đệ quy và bỏ nửa rỗng khi nối", () => {
  const goi: number[] = [];
  const text = giaiMaChiaDoi(new Float32Array(40 * MAU), (s) => (goi.push(s.length), goi.length === 2 ? "" : "x"), 18 * MAU);
  assert.equal(goi.length, 4);
  assert.ok(goi.every((d) => d <= 18 * MAU));
  assert.equal(text, "x x x");
});

test("getAsrModel đọc ASR_MODEL mỗi lần gọi", () => {
  const truoc = process.env.ASR_MODEL;
  const canhBao = console.warn;
  console.warn = () => undefined;
  try {
    process.env.ASR_MODEL = "rumble";
    assert.equal(getAsrModel(), "rumble");
    process.env.ASR_MODEL = " Rumble ";
    assert.equal(getAsrModel(), "rumble");
    process.env.ASR_MODEL = "zipformer";
    assert.equal(getAsrModel(), "zipformer");
    process.env.ASR_MODEL = "abc";
    assert.equal(getAsrModel(), "zipformer");
    delete process.env.ASR_MODEL;
    assert.equal(getAsrModel(), "zipformer");
  } finally {
    console.warn = canhBao;
    if (truoc === undefined) delete process.env.ASR_MODEL;
    else process.env.ASR_MODEL = truoc;
  }
});
