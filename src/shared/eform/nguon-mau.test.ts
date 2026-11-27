import assert from "node:assert/strict";
import { test } from "node:test";
import { datGoTat, doiNguonKhiLuu, ganNguonMau } from "./nguon-mau";

test("ganNguonMau: khác chữ gốc hoặc còn chỗ [..] thì xem, còn lại cu", () => {
  const kq = ganNguonMau(
    {
      benh_su: { value: "3 ngày nay đau họng", nguon: "ai" },
      kham_chuyen_khoa: { value: "Họng đỏ", nguon: "ai" },
      ly_do: { value: "Đau họng [trái|phải]", nguon: "xem" },
    },
    {
      benh_su: { value: "[số] ngày nay đau họng", nguon: "xem" },
      kham_chuyen_khoa: { value: "Họng đỏ", nguon: "ai" },
      ly_do: { value: "Đau họng [trái|phải]", nguon: "xem" },
    },
  );
  assert.equal(kq.benh_su.nguon, "xem");
  assert.equal(kq.kham_chuyen_khoa.nguon, "cu");
  assert.equal(kq.ly_do.nguon, "xem");
  assert.equal(kq.benh_su.value, "3 ngày nay đau họng");
});

test("datGoTat: ô trống hoặc nguồn cu thì thay bằng câu, nguồn bs thì nối", () => {
  assert.deepEqual(datGoTat({ value: "", nguon: null }, "Tai bình thường", true), { value: "Tai bình thường", nguon: "bs" });
  assert.deepEqual(datGoTat({ value: "Họng đỏ", nguon: "cu" }, "Tai bình thường", true), { value: "Tai bình thường", nguon: "bs" });
  assert.equal(datGoTat({ value: "Họng đỏ", nguon: "bs" }, "Tai bình thường", true).value, "Họng đỏ\nTai bình thường");
  assert.equal(datGoTat({ value: "Họng đỏ", nguon: "bs" }, "Tai bình thường", false).value, "Họng đỏ Tai bình thường");
  assert.equal(datGoTat({ value: "Họng đỏ", nguon: "sua" }, "Tai bình thường", false).nguon, "bs");
});

test("datGoTat: gõ cùng mã hai lần không nối câu hai lần", () => {
  const hienTai = { value: "Họng đỏ\nTai bình thường", nguon: "bs" as const };
  assert.equal(datGoTat(hienTai, "Tai bình thường", true), hienTai);
});

test("doiNguonKhiLuu: chỉ ô do mẫu điền thành bs, không đổi thì trả đúng object cũ", () => {
  const f = {
    a: { value: "x", nguon: "cu" as const },
    b: { value: "y", nguon: "xem" as const },
    c: { value: "z", nguon: "cu" as const },
  };
  const kq = doiNguonKhiLuu(f, new Set(["a", "b"]));
  assert.equal(kq.a.nguon, "bs");
  assert.equal(kq.b.nguon, "bs");
  assert.equal(kq.c.nguon, "cu");
  assert.equal(kq.a.value, "x");
  assert.equal(doiNguonKhiLuu(f, new Set()), f);
});

test("doiNguonKhiLuu: ô còn chỗ [..] giữ nguyên nguồn xem, ô đã điền xong thành bs", () => {
  const f = {
    a: { value: "Phổi [phải|trái|2 bên] sạch", nguon: "xem" as const },
    b: { value: "sốt [số] độ", nguon: "cu" as const },
    c: { value: "ổn", nguon: "xem" as const },
  };
  const kq = doiNguonKhiLuu(f, new Set(["a", "b", "c"]));
  assert.equal(kq.a, f.a);
  assert.equal(kq.b, f.b);
  assert.equal(kq.c.nguon, "bs");
  const chiCo = { a: f.a, b: f.b };
  assert.equal(doiNguonKhiLuu(chiCo, new Set(["a", "b"])), chiCo);
});
