import assert from "node:assert/strict";
import { test } from "node:test";
import { chiaNhom, giaDichVu, nhomDichVu, thanhTien, vnd, xepGoi, type BangGiaDichVu, type GoiChiDinh } from "./goi-chi-dinh";

const BANG: BangGiaDichVu = {
  mac_dinh: 100,
  gia: [
    { tu_khoa: ["khám"], gia: 690000 },
    { tu_khoa: ["CT"], gia: 1800000 },
  ],
  nhom: [
    { ten: "Xét nghiệm", tu_khoa: ["định lượng"] },
    { ten: "Chẩn đoán hình ảnh", tu_khoa: ["chụp", "CT"] },
  ],
};

test("giá và nhóm khớp nguyên từ, không dấu: CT không khớp Electrocochleography", () => {
  assert.equal(giaDichVu("Khám lại (khám chuyên sâu TMH)", BANG), 690000);
  assert.equal(giaDichVu("Chụp CT xoang", BANG), 1800000);
  assert.equal(giaDichVu("Đo điện ốc tai (Electrocochleography)", BANG), 100);
  assert.equal(nhomDichVu("dinh luong glucose", BANG), "Xét nghiệm");
  assert.equal(nhomDichVu("Nội soi tai", BANG), "Dịch vụ chung");
});

test("thành tiền nhân số lượng, số lượng trống tính 1", () => {
  assert.equal(thanhTien({ ten: "Chụp CT xoang", so_luong: "2" }, BANG), 3600000);
  assert.equal(thanhTien({ ten: "Chụp CT xoang", so_luong: "" }, BANG), 1800000);
  assert.equal(vnd(690000), "690,000 VNĐ");
});

test("chia nhóm theo thứ tự trong bảng, Dịch vụ chung cuối, bỏ nhóm rỗng, giữ chỉ số dòng gốc", () => {
  const rows = [{ ten: "Nội soi tai" }, { ten: "Định lượng Glucose" }];
  assert.deepEqual(
    chiaNhom(rows, BANG).map((g) => `${g.nhom}:${g.dong.map((d) => d.index).join(",")}`),
    ["Xét nghiệm:1", "Dịch vụ chung:0"],
  );
});

test("gói hợp chẩn đoán lên đầu theo thứ tự mã trên phiếu, gói không có icd không bao giờ hợp", () => {
  const goi = (ma: string, icd: string[]): GoiChiDinh => ({ ma, ten: ma, loai: "chia_se", icd, dichVu: [] });
  const ds = [goi("gan", []), goi("xoang", ["J32"]), goi("amydan", ["J35"])];
  assert.deepEqual(
    xepGoi(ds, ["J35.0", "J32.4"]).map(({ goi: g, hop }) => `${g.ma}:${hop ?? "-"}`),
    ["amydan:J35.0", "xoang:J32.4", "gan:-"],
  );
});
