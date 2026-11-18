import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { Draft } from "../types";
import { dienPhieu, gopTruongMoi } from "./dien-phieu";
import type { EformData, QuyTacAi, Truong } from "./types";

const quyTac = JSON.parse(fs.readFileSync("data/eform/quy-tac.json", "utf8")) as QuyTacAi;
const DATA = { icd10: [], quyTac } as unknown as EformData;
const TRONG: Truong = { value: "", nguon: null };

function getTu(bang: Record<string, Truong>) {
  return (id: string) => bang[id] ?? TRONG;
}

const nhap = (pk: Record<string, string>): Draft => ({ phieu_kham: pk, chi_dinh: [], ke_don: [] });

test("chiOTrong giữ ô có dữ liệu cũ", () => {
  const kq = dienPhieu(nhap({ ly_do_kham: "Đau tai trái" }), {}, DATA, getTu({ ly_do: { value: "Đau tai", nguon: "cu" } }), {
    chiOTrong: true,
  });
  assert.equal(kq.truong.ly_do, undefined);
  assert.deepEqual(kq.boQua, ["Lý do đến khám"]);
});

test("không chiOTrong thì vẫn ghi đè ô 'cu' như cũ", () => {
  const kq = dienPhieu(nhap({ ly_do_kham: "Đau tai trái" }), {}, DATA, getTu({ ly_do: { value: "Đau tai", nguon: "cu" } }));
  assert.equal(kq.truong.ly_do?.value, "Đau tai trái");
});

test("icd truyền vào thay cho goiYIcd", () => {
  const kq = dienPhieu(nhap({ chan_doan_chinh: "Viêm tai giữa cấp tai phải" }), {}, DATA, getTu({}), { icd: "H66.0" });
  assert.deepEqual(kq.truong.icd_ra_vien, { value: "H66.0", nguon: "xem" });
  assert.deepEqual(kq.truong.icd_ban_dau, { value: "H66.0", nguon: "xem" });
});

test("chẩn đoán kèm theo đúng tên mã ICD thì lấy đúng mã, kể cả tên có dấu phẩy; bỏ mã trùng chẩn đoán chính", () => {
  const icd10 = [
    { ma: "H66.0", ten: "Viêm tai giữa có mủ cấp tính" },
    { ma: "J02.9", ten: "Viêm họng cấp tính, không xác định" },
    { ma: "J00", ten: "Viêm mũi họng cấp tính [cảm thường]" },
  ];
  const data = { ...DATA, icd10 } as unknown as EformData;
  const kq = dienPhieu(
    nhap({ chan_doan_kem: "Viêm họng cấp tính, không xác định; Viêm mũi họng cấp tính [cảm thường]; Viêm tai giữa có mủ cấp tính" }),
    {},
    data,
    getTu({ icd_ra_vien: { value: "H66.0", nguon: "bs" } }),
  );
  assert.deepEqual(kq.truong.icd_kem_theo, { value: "J02.9,J00", nguon: "xem" });
});

test("chỗ trống làm ô thành 'xem'", () => {
  const kq = dienPhieu(nhap({ benh_su: "Đau tai [phải|trái] 3 ngày", loi_dan: "Giữ khô tai" }), {}, DATA, getTu({}));
  assert.equal(kq.truong.benh_su?.nguon, "xem");
  assert.equal(kq.truong.loi_dan?.nguon, "ai");
});

test("gọi lần hai chỉ điền ô còn trống", () => {
  const kq = dienPhieu(nhap({ benh_su: "Mẫu mới", loi_dan: "Giữ khô tai" }), {}, DATA, getTu({ benh_su: { value: "Lần trước", nguon: "ai" } }), {
    chiOTrong: true,
  });
  assert.equal(kq.truong.benh_su, undefined);
  assert.equal(kq.truong.loi_dan?.value, "Giữ khô tai");
});

test("hẹn tái khám 'Không' mặc định vẫn được mẫu điền", () => {
  const kq = dienPhieu(
    nhap({ hen_tai_kham: "Sau 7 ngày" }),
    {},
    DATA,
    getTu({ hen_tai_kham: { value: "Không", nguon: "cu" }, thoi_gian_kham: { value: "2026-11-09T09:15", nguon: "cu" } }),
    { chiOTrong: true },
  );
  assert.equal(kq.truong.hen_tai_kham?.value, "Có");
  assert.equal(kq.truong.ngay_tai_kham?.value, "2026-11-16");
});

test("hẹn tái khám bác sĩ đã chọn thì giữ", () => {
  const kq = dienPhieu(nhap({ hen_tai_kham: "Sau 7 ngày" }), {}, DATA, getTu({ hen_tai_kham: { value: "Không", nguon: "bs" } }), {
    chiOTrong: true,
  });
  assert.equal(kq.truong.hen_tai_kham, undefined);
});

test("ô đã đúng giá trị mẫu thì không tính là vừa điền", () => {
  const kq = dienPhieu(nhap({ hen_tai_kham: "Sau 7 ngày" }), {}, DATA, getTu({ hen_tai_kham: { value: "Có", nguon: "ai" }, ngay_tai_kham: { value: "2026-11-16", nguon: "ai" } }), {
    chiOTrong: true,
  });
  assert.equal(kq.truong.hen_tai_kham, undefined);
  assert.deepEqual(kq.daDien.map((m) => m.id), []);
});

const LICH_SU = {
  tien_su_ban_than: [
    { ngay: "03/03/2026", bac_si: "BS. C", khoa: "TMH", noi_dung: "Cũ" },
    { ngay: "14/08/2026", bac_si: "BS. B", khoa: "TMH", noi_dung: "Viêm mũi dị ứng" },
  ],
  tien_su_gia_dinh: [],
  benh_su: [],
  di_ung: [{ ngay: "20/11/2025", loai_phieu: "Phiếu khám", loai: "Thuốc", thong_tin: "Penicillin: nổi mẩn", nguoi: "bs" }],
};
const DATA_LS = { ...DATA, ca: { lich_su: LICH_SU } } as unknown as EformData;

test("phiếu mẫu điền ô o_khac, ô chọn mặc định 'Không' vẫn được đổi, ô bác sĩ chọn thì giữ", () => {
  const kq = dienPhieu(
    nhap({}),
    {},
    DATA,
    getTu({ co_pttt: { value: "Không", nguon: "cu" }, da_xu_ly: { value: "Không", nguon: "bs" } }),
    { chiOTrong: true, oKhac: { ghi_chu_kq: "Chờ kết quả nội soi tai.", co_pttt: "Có", da_xu_ly: "Có", tinh_trang_ra_vien: "Đỡ, giảm" } },
  );
  assert.equal(kq.truong.ghi_chu_kq?.value, "Chờ kết quả nội soi tai.");
  assert.equal(kq.truong.co_pttt?.value, "Có");
  assert.equal(kq.truong.da_xu_ly, undefined);
  assert.equal(kq.truong.tinh_trang_ra_vien?.value, "Đỡ, giảm");
});

test("phiếu mẫu chép tiền sử, dị ứng mới nhất từ lần khám trước, đánh dấu dữ liệu cũ", () => {
  const kq = dienPhieu(nhap({}), {}, DATA_LS, getTu({}), { chiOTrong: true, chepLichSu: true });
  assert.deepEqual(kq.truong.tien_su_ban_than, { value: "Viêm mũi dị ứng", nguon: "cu" });
  assert.equal(kq.truong.tien_su_gia_dinh, undefined);
  assert.equal(kq.truong.di_ung?.value, "Có");
  assert.equal(kq.truong.di_ung_mo_ta?.value, "Penicillin: nổi mẩn");
});

test("chép lịch sử không đè tiền sử, dị ứng đã có trên phiếu", () => {
  const kq = dienPhieu(nhap({}), {}, DATA_LS, getTu({ tien_su_ban_than: { value: "BS ghi", nguon: "bs" }, di_ung: { value: "Không", nguon: "bs" } }), {
    chiOTrong: true,
    chepLichSu: true,
  });
  assert.equal(kq.truong.tien_su_ban_than, undefined);
  assert.equal(kq.truong.di_ung, undefined);
  assert.equal(kq.truong.di_ung_mo_ta, undefined);
});

test("gopTruongMoi bỏ ô bị sửa trong lúc chờ AI", () => {
  const luc: Record<string, Truong> = { huong_dieu_tri: TRONG, loi_dan: TRONG };
  const bsGo: Truong = { value: "Theo dõi", nguon: "bs" };
  const hienTai = { ...luc, huong_dieu_tri: bsGo };
  const moi = { huong_dieu_tri: { value: "Điều trị nội khoa", nguon: "ai" as const }, loi_dan: { value: "Giữ khô tai", nguon: "ai" as const } };
  const ra = gopTruongMoi(hienTai, luc, moi);
  assert.equal(ra.huong_dieu_tri, bsGo);
  assert.equal(ra.loi_dan.value, "Giữ khô tai");
});

test("thuốc dùng khi cần: lấy cờ của AI, hoặc nhận ra từ 'Khi đau' ở thời điểm dùng", () => {
  const draft: Draft = {
    phieu_kham: {},
    chi_dinh: [],
    ke_don: [
      { ten_thuoc: "Paracetamol", lieu_moi_lan: "1 viên", khi_can: "Có", so_luong_ke: 10 },
      { ten_thuoc: "Ibuprofen", lieu_moi_lan: "1 viên", so_lan_ngay: 3, thoi_diem: "Khi đau" },
      { ten_thuoc: "Augmentin", lieu_moi_lan: "1 viên", so_lan_ngay: 2, thoi_diem: "Sau ăn" },
    ],
  };
  const { donThuoc } = dienPhieu(draft, {}, DATA, getTu({}));
  assert.deepEqual(donThuoc.map((row) => row.khi_can), [true, true, false]);
  assert.equal(donThuoc[0].so_luong_ke, "10");
  assert.equal(donThuoc[0].so_lan_ngay, "");
});
