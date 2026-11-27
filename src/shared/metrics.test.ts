import assert from "node:assert/strict";
import { test } from "node:test";
import { toCsv, type SessionRecord } from "./metrics";

const cu = { id: "s1", kieu_nhap: "go", tu_ca_mau: false, ca_mau_id: null, provider: "thu", thoi_gian_giay: 12 } as unknown as SessionRecord;

test("CSV có ba cột lệnh nhanh và chỗ vàng, lượt cũ để ô trống", () => {
  const moi = { ...cu, id: "s2", so_lenh_nhanh: 2, so_o_lenh_nhanh: 3, so_cho_vang: 1 } as SessionRecord;
  const [tieuDe, dongCu, dongMoi] = toCsv([cu, moi]).split("\n");
  const cot = tieuDe.split(",");
  for (const c of ["so_lenh_nhanh", "so_o_lenh_nhanh", "so_cho_vang"]) assert.ok(cot.includes(c), c);
  const lay = (dong: string, c: string) => dong.split(",")[cot.indexOf(c)];
  assert.equal(lay(dongCu, "so_lenh_nhanh"), "");
  assert.equal(lay(dongCu, "so_cho_vang"), "");
  assert.equal(lay(dongMoi, "so_o_lenh_nhanh"), "3");
});
