import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { apKetQuaLenh } from "./ap-lenh";
import type { DongChiDinh } from "./dien-phieu";
import { tachGoTat, type GoTat, type KetQuaGoTat } from "./go-tat";
import { dungMau, type LenhDien } from "./lenh-nhanh";
import type { PhieuMau } from "./phieu-mau";
import type { EformData, QuyTacAi, Truong } from "./types";

const quyTac = JSON.parse(fs.readFileSync("data/eform/quy-tac.json", "utf8")) as QuyTacAi;
const DATA = {
  icd10: [],
  quyTac,
  ca: { lich_su: { tien_su_ban_than: [], tien_su_gia_dinh: [], di_ung: [] } },
} as unknown as EformData;
const TRONG: Truong = { value: "", nguon: null };

function getTu(bang: Record<string, Truong>) {
  return (id: string) => bang[id] ?? TRONG;
}

const MAU: PhieuMau = {
  id: "dau-hong-gia",
  ten: "Đau họng giả",
  bi_danh: [],
  icd: "",
  khamKhac: "",
  oKhac: {},
  ketQua: {
    draft: {
      phieu_kham: { ly_do_kham: "Đau họng [số] ngày", kham_chuyen_khoa: "Họng đỏ" },
      chi_dinh: [{ ma_dich_vu: "DV-GIA-01", ten_dich_vu: "Nội soi họng", so_luong: 1 }],
      ke_don: [{ ten_thuoc: "Thuốc giả" }],
    },
    matches: {},
    provider: "mau",
    duration_ms: 0,
  },
};

const KHONG_GO_TAT: KetQuaGoTat = { cacO: {}, daDung: [], conLai: "" };
const BO_GO_TAT: GoTat[] = [{ ma: "tbt", o: "kham_chuyen_khoa", noi_dung: "Tai bình thường" }];

const lenh = (chiTiet: string, goTat = KHONG_GO_TAT): LenhDien => dungMau(MAU, chiTiet, goTat, {});

test("mẫu kèm chi tiết: chỗ trống vừa thay là 'xem', ô nằm trong oTuMau, thêm chỉ định", () => {
  const r = apKetQuaLenh(lenh("3 ngày"), DATA, getTu({}), []);
  assert.deepEqual(r.truong.ly_do, { value: "Đau họng 3 ngày", nguon: "xem" });
  assert.deepEqual(r.truong.kham_chuyen_khoa, { value: "Họng đỏ", nguon: "cu" });
  assert.ok(r.oTuMau.includes("ly_do"));
  assert.equal(r.chiDinhThem.length, 1);
  assert.equal(r.thongBao, 'Đã điền 2 ô từ mẫu "Đau họng giả". Còn 1 chỗ vàng cần xem. Thêm 1 chỉ định.');
  assert.deepEqual(r.ketQua?.donThuoc, []);
});

test("ô bác sĩ đã nhập giữ nguyên và báo bỏ qua", () => {
  const r = apKetQuaLenh(lenh("3 ngày"), DATA, getTu({ ly_do: { value: "Đau tai", nguon: "bs" } }), []);
  assert.equal(r.truong.ly_do, undefined);
  assert.ok(r.thongBao.includes("Bỏ qua 1 ô"));
  assert.deepEqual(r.ketQua?.donThuoc, []);
});

test("gọi lại cùng mẫu: chỉ định đã có cùng mã không thêm, ô đã đúng giá trị không đếm lại", () => {
  const lan1 = apKetQuaLenh(lenh("3 ngày"), DATA, getTu({}), []);
  const daCo: DongChiDinh[] = [{ ma: "DV-GIA-01", ten: "Nội soi họng", so_luong: "1", ghi_chu: "", nguon: "ai", ung_vien: [] }];
  const r = apKetQuaLenh(lenh("3 ngày"), DATA, getTu(lan1.truong), daCo);
  assert.deepEqual(r.chiDinhThem, []);
  assert.deepEqual(r.truong, {});
  assert.ok(!r.thongBao.includes("Thêm"));
  assert.deepEqual(r.ketQua?.donThuoc, []);
});

test("gõ tắt vào ô mẫu vừa điền: câu gõ tắt thay chữ mẫu, nguồn 'bs', bỏ khỏi oTuMau", () => {
  const goTat = tachGoTat("tbt", BO_GO_TAT);
  const r = apKetQuaLenh(lenh("3 ngày", goTat), DATA, getTu({}), []);
  assert.deepEqual(r.truong.kham_chuyen_khoa, { value: "Tai bình thường", nguon: "bs" });
  assert.ok(!r.oTuMau.includes("kham_chuyen_khoa"));
  assert.ok(r.oTuMau.includes("ly_do"));
  assert.ok(r.thongBao.endsWith(" Gõ tắt: tbt."));
  assert.deepEqual(r.ketQua?.donThuoc, []);
});

test("chỉ có gõ tắt: điền ô theo id eForm, nối vào ô bác sĩ đã gõ, câu đã có thì không nối lại", () => {
  const goTat = tachGoTat("tbt", BO_GO_TAT);
  const kq: LenhDien = { loai: "dien", mau: null, ketQua: null, goTat, phanDu: [] };
  const r = apKetQuaLenh(kq, DATA, getTu({ kham_chuyen_khoa: { value: "Mũi thông", nguon: "bs" } }), []);
  assert.deepEqual(r.truong.kham_chuyen_khoa, { value: "Mũi thông\nTai bình thường", nguon: "bs" });
  assert.deepEqual(r.oTuMau, []);
  assert.equal(r.thongBao, "Đã điền gõ tắt tbt: 1 ô.");
  assert.deepEqual(r.ketQua?.donThuoc, []);
  const lai = apKetQuaLenh(kq, DATA, getTu(r.truong), []);
  assert.deepEqual(lai.truong, {});
});

test("ô Khám các bộ phận khác của mẫu chỉ điền khi trống", () => {
  const mau = { ...MAU, khamKhac: "Hạch cổ không sờ thấy" };
  const kq = dungMau(mau, "", KHONG_GO_TAT, {});
  assert.deepEqual(apKetQuaLenh(kq, DATA, getTu({}), []).truong.kham_khac, { value: "Hạch cổ không sờ thấy", nguon: "cu" });
  const r = apKetQuaLenh(kq, DATA, getTu({ kham_khac: { value: "Khác", nguon: "bs" } }), []);
  assert.equal(r.truong.kham_khac, undefined);
});
