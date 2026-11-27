import assert from "node:assert/strict";
import { test } from "node:test";
import type { GoTat } from "./go-tat";
import { xuLyLenh, type DuLieuLenh, type LenhDien } from "./lenh-nhanh";
import type { PhieuMau } from "./phieu-mau";

function mau(id: string, ten: string, bi_danh: string[]): PhieuMau {
  return {
    id,
    ten,
    bi_danh,
    icd: "",
    khamKhac: "",
    oKhac: {},
    ketQua: {
      draft: {
        phieu_kham: { benh_su: "[số] ngày nay đau họng, sốt [số] độ", kham_chuyen_khoa: "Họng đỏ" },
        chi_dinh: [],
        ke_don: [],
      },
      matches: {},
      provider: "mau",
      duration_ms: 0,
    },
  };
}

const VIEM_HONG = mau("viem-hong", "Viêm họng cấp", []);
const goTat: GoTat[] = [{ ma: "tbt", o: "kham_chuyen_khoa", noi_dung: "Tai bình thường" }];
const du: DuLieuLenh = { goTat, phieuMau: [VIEM_HONG], vietTat: {} };

function dien(lenh: string, d: DuLieuLenh = du): LenhDien {
  const kq = xuLyLenh(lenh, d);
  assert.equal(kq.loai, "dien");
  return kq as LenhDien;
}

test("tên mẫu kèm chi tiết: điền chỗ trống và báo phần dư", () => {
  const kq = dien("viêm họng cấp, 3 ngày, sốt 38 độ, kèm ho đờm");
  assert.equal(kq.mau?.id, "viem-hong");
  assert.equal((kq.ketQua?.draft.phieu_kham as Record<string, string>).benh_su, "3 ngày nay đau họng, sốt 38 độ");
  assert.deepEqual(kq.phanDu, ["kèm ho đờm"]);
});

test("sau tên mẫu chỉ có từ đệm: không phần dư, giữ nguyên kết quả mẫu", () => {
  const kq = dien("viêm họng cấp nhé");
  assert.deepEqual(kq.phanDu, []);
  assert.equal(kq.ketQua, VIEM_HONG.ketQua);
});

test("chỉ có gõ tắt: không mẫu", () => {
  const kq = dien("tbt");
  assert.equal(kq.mau, null);
  assert.equal(kq.ketQua, null);
  assert.deepEqual(kq.goTat.daDung, ["tbt"]);
  assert.deepEqual(kq.phanDu, []);
});

test("bí danh trùng thì chọn mẫu, giữ chi tiết", () => {
  const hai = { ...du, phieuMau: [mau("a", "Viêm họng cấp", ["vh"]), mau("b", "Viêm hầu", ["vh"])] };
  const kq = xuLyLenh("vh 2 ngày", hai);
  assert.equal(kq.loai, "chon_mau");
  if (kq.loai === "chon_mau") {
    assert.equal(kq.cacMau.length, 2);
    assert.equal(kq.chiTiet, "2 ngày");
  }
});

test("không có gì để làm thì trống", () => {
  assert.deepEqual(xuLyLenh("không có gì", du), { loai: "trong" });
});
