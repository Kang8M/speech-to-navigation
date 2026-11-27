import assert from "node:assert/strict";
import { test } from "node:test";
import type { Values } from "../types";
import { chenGoTat, ketQuaGoTat, tachGoTat, type GoTat } from "./go-tat";

const BO: GoTat[] = [
  { ma: "tbt", o: "kham_chuyen_khoa", noi_dung: "Tai: hai bên sạch." },
  { ma: "mv", o: "kham_chuyen_khoa", noi_dung: "Mũi: niêm mạc nề, có dịch." },
  { ma: "ttbt", o: "kham_toan_than", noi_dung: "Tỉnh táo, thể trạng tốt." },
  { ma: "phoi", o: "kham_khac", noi_dung: "Phổi thông khí đều." },
  { ma: "vmx", o: "chan_doan_chinh", noi_dung: "viêm mũi xoang cấp" },
  { ma: "ldm", o: "loi_dan", noi_dung: "Rửa mũi ngày 2 lần." },
  { ma: "ldn", o: "loi_dan", noi_dung: "Uống nhiều nước." },
  { ma: "k", o: "tu", noi_dung: "không" },
];

test("mỗi mã bung đúng câu vào đúng ô, cùng ô thì nối theo thứ tự gõ", () => {
  const kq = tachGoTat("ttbt tbt mv, ldm ldn", BO);
  assert.deepEqual(kq.daDung, ["ttbt", "tbt", "mv", "ldm", "ldn"]);
  assert.equal(kq.cacO.kham_toan_than, "Tỉnh táo, thể trạng tốt.");
  assert.equal(kq.cacO.kham_chuyen_khoa, "Tai: hai bên sạch.\nMũi: niêm mạc nề, có dịch.");
  assert.equal(kq.cacO.loi_dan, "Rửa mũi ngày 2 lần. Uống nhiều nước.");
  assert.equal(kq.conLai, "");
});

test("phần không phải mã giữ lại làm chi tiết, từ ngắn (o = tu) bung tại chỗ", () => {
  const kq = tachGoTat("vmx, tbt, ngạt mũi 5n, k sốt", BO);
  assert.equal(kq.cacO.chan_doan_chinh, "viêm mũi xoang cấp");
  assert.equal(kq.conLai, "ngạt mũi 5n, không sốt");
  assert.deepEqual(kq.daDung, ["vmx", "tbt", "k"]);
});

test("mã phân biệt hoa thường và không nhận khi dính dấu hai chấm hay nằm trong từ", () => {
  const kq = tachGoTat("TBT, tbt: ống tai sạch, mvx, ktbt", BO);
  assert.deepEqual(kq.daDung, []);
  assert.equal(kq.conLai, "TBT, tbt: ống tai sạch, mvx, ktbt");
});

test("dấu chấm cuối mã vẫn nhận", () => {
  assert.deepEqual(tachGoTat("tbt. ldm.", BO).daDung, ["tbt", "ldm"]);
});

test("không có bộ gõ tắt thì trả nguyên văn", () => {
  const kq = tachGoTat("vtg cấp, tai P", []);
  assert.deepEqual(kq, { cacO: {}, daDung: [], conLai: "vtg cấp, tai P" });
});

test("chenGoTat: câu gõ tắt thay câu mẫu hay câu AI ở cùng ô, ô khác giữ nguyên", () => {
  const draft = { phieu_kham: { kham_chuyen_khoa: "câu của mẫu", loi_dan: "dặn của mẫu" }, chi_dinh: [{ ten_dich_vu: "Nội soi" }] };
  const moi = chenGoTat(draft, { kham_chuyen_khoa: "Tai: hai bên sạch.", kham_khac: "Phổi thông khí đều." });
  assert.deepEqual(moi.phieu_kham, { kham_chuyen_khoa: "Tai: hai bên sạch.", loi_dan: "dặn của mẫu" });
  assert.deepEqual(moi.chi_dinh, draft.chi_dinh);
  assert.equal((draft.phieu_kham as Values).kham_chuyen_khoa, "câu của mẫu", "không sửa bản gốc");
});

test("ketQuaGoTat: chỉ gõ tắt thì không có chỉ định, thuốc, không gọi AI", () => {
  const kq = ketQuaGoTat({ kham_toan_than: "Tỉnh táo, thể trạng tốt." });
  assert.equal(kq.provider, "go-tat");
  assert.deepEqual(kq.draft, { phieu_kham: { kham_toan_than: "Tỉnh táo, thể trạng tốt." }, chi_dinh: [], ke_don: [] });
});

test("câu trước không có dấu kết câu thì thêm dấu chấm khi nối cùng dòng", () => {
  const bo: GoTat[] = [
    { ma: "ldmh", o: "loi_dan", noi_dung: "Vệ sinh mũi họng hàng ngày" },
    { ma: "rm", o: "loi_dan", noi_dung: "Rửa mũi hàng ngày" },
  ];
  assert.equal(tachGoTat("ldmh rm", bo).cacO.loi_dan, "Vệ sinh mũi họng hàng ngày. Rửa mũi hàng ngày");
});
