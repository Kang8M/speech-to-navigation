import assert from "node:assert/strict";
import { test } from "node:test";
import { chonBoMau, khopBoMau, khopMaIcd, type MauGoiY } from "./goi-y";

test("khớp mã ICD theo tiền tố: H66 khớp H66.0, S02.2 khớp S02.20, J35.0 không khớp J35.1", () => {
  assert.ok(khopMaIcd("H66.0", "H66"));
  assert.ok(khopMaIcd("H66", "H66"));
  assert.ok(khopMaIcd("S02.20", "S02.2"));
  assert.ok(!khopMaIcd("J35.1", "J35.0"));
  assert.ok(!khopMaIcd("H660", "H66"));
});

test("chọn bộ mẫu theo tiền tố, chẩn đoán chính trước, không lặp bộ", () => {
  const bo = (id: string, icd: string[]): MauGoiY => ({ id, ten: id, icd, chiDinh: [], donThuoc: [], loiDan: "" });
  const boMau = [bo("xoang", ["J01"]), bo("tai", ["H66.0", "H66.9"])];
  assert.deepEqual(
    chonBoMau(["H66.9", "J01.0", "J01.9"], boMau).map(({ ma, mau }) => `${ma}:${mau.id}`),
    ["H66.9:tai", "J01.0:xoang"],
  );
});

test("khopBoMau: dòng có thời điểm 'Khi sốt' ra khi_can true, giữ so_luong_ke", () => {
  const [bo] = khopBoMau(
    [{ id: "a", ten: "A", icd: ["R50"], chi_dinh: [], don_thuoc: [{ ten: "Thuốc mẫu", thoi_diem: "Khi sốt", so_luong_ke: "6" }, { ten: "Thuốc hai", thoi_diem: "Sau ăn" }] }],
    { dichVu: [], thuoc: [] },
    {} as never,
  );
  assert.equal(bo.donThuoc[0].khi_can, true);
  assert.equal(bo.donThuoc[0].so_luong_ke, "6");
  assert.equal(bo.donThuoc[1].khi_can, false);
});
