import assert from "node:assert/strict";
import { test } from "node:test";
import { batDauDoanChuTam } from "./doan-chu-tam";

const MAU = 16000;
const demDau = 0.5 * MAU;
const toiDa = 10 * MAU;

test("batDauDoanChuTam: 12 giây im lặng rồi 3 giây nói vẫn có chữ tạm, bắt đầu trước chỗ nói 0,5 giây", () => {
  const tu = batDauDoanChuTam({ batDau: 0, doDai: 15 * MAU, noiTu: 12 * MAU, demDau, toiDa });
  assert.equal(tu, 11.5 * MAU);
});

test("batDauDoanChuTam: đang nói quá 10 giây thì bỏ qua", () => {
  assert.equal(batDauDoanChuTam({ batDau: 0, doDai: 15 * MAU, noiTu: 2 * MAU, demDau, toiDa }), null);
});

test("batDauDoanChuTam: bộ đệm đã cắt đầu thì tính theo vị trí tuyệt đối, không lùi quá đầu bộ đệm", () => {
  assert.equal(batDauDoanChuTam({ batDau: 100 * MAU, doDai: 5 * MAU, noiTu: 100.2 * MAU, demDau, toiDa }), 0);
  assert.equal(batDauDoanChuTam({ batDau: 100 * MAU, doDai: 8 * MAU, noiTu: 104 * MAU, demDau, toiDa }), 3.5 * MAU);
});

test("batDauDoanChuTam: chưa biết chỗ bắt đầu nói thì lấy cả bộ đệm", () => {
  assert.equal(batDauDoanChuTam({ batDau: 0, doDai: 4 * MAU, noiTu: null, demDau, toiDa }), 0);
});
