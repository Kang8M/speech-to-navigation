import assert from "node:assert/strict";
import { test } from "node:test";
import type { GoTat } from "./go-tat";
import { khoCau, maGoTatCuaO, nhanGoiY, timGoiYTab, type CauGoiY, type NguonCau } from "./goi-y-tab";
import type { PhieuMau } from "./phieu-mau";

function mau(id: string, ten: string, icd: string, phieuKham: Record<string, string>, khamKhac = ""): PhieuMau {
  return {
    id,
    ten,
    bi_danh: [],
    icd,
    khamKhac,
    ketQua: { draft: { phieu_kham: phieuKham, chi_dinh: [], ke_don: [] }, matches: {}, provider: "mau", duration_ms: 0 },
  };
}

const GO_TAT: GoTat[] = [
  { ma: "tbth", o: "kham_chuyen_khoa", noi_dung: "Tai: ống tai 2 bên khô sạch, màng nhĩ 2 bên sáng." },
  { ma: "ldtai", o: "loi_dan", noi_dung: "Giữ khô tai, không tự lấy ráy tai." },
  { ma: "vhc", o: "chan_doan_chinh", noi_dung: "viêm họng cấp" },
  { ma: "k", o: "tu", noi_dung: "không" },
];

/** Câu tự đặt cho test, coi là đủ chắc để gợi ý cả ở ô trống */
const chac = (...cau: string[]): CauGoiY[] => cau.map((item) => ({ cau: item, chac: true }));
const cau = (kho: CauGoiY[]) => kho.map((item) => item.cau);

const NGUON: NguonCau = {
  goTat: GO_TAT,
  thoiQuen: [],
  phieuMau: [
    mau("vtg", "Viêm tai giữa cấp", "H66.0", { loi_dan: "Uống thuốc đúng giờ. Quay lại ngay nếu sốt cao." }),
    mau("vh", "Viêm họng cấp", "J02.9", {
      loi_dan: "Súc họng nước muối ấm. Uống thuốc đúng giờ.",
      ly_do_kham: "Đau họng [số] ngày",
    }),
  ],
  thuVien: { loi_dan: ["Dùng thuốc theo đơn, không tự ý ngừng thuốc."] },
};

test("kho câu: câu của bác sĩ đứng đầu, phiếu mẫu đúng bệnh trước bệnh khác, bỏ câu còn chỗ trống", () => {
  const kho = cau(khoCau("loi_dan", NGUON, { text: "Đau họng", icd: ["J02.9"] }));
  assert.equal(kho[0], "Giữ khô tai, không tự lấy ráy tai.");
  // "Uống thuốc đúng giờ." có ở hai mẫu, một mẫu đúng bệnh, nên đứng trước câu chỉ có ở mẫu đúng bệnh
  assert.deepEqual(kho.slice(1, 3), ["Uống thuốc đúng giờ.", "Súc họng nước muối ấm."]);
  assert.ok(kho.indexOf("Dùng thuốc theo đơn, không tự ý ngừng thuốc.") < kho.indexOf("Quay lại ngay nếu sốt cao."));
  assert.deepEqual(khoCau("ly_do", NGUON, { text: "", icd: [] }), []);
});

test("đang gõ dở: khớp không dấu, nhận gợi ý thì sửa luôn dấu và chữ hoa", () => {
  const kho = khoCau("loi_dan", NGUON, { text: "", icd: [] });
  const goiY = timGoiYTab("Đã dặn. suc hong", kho, maGoTatCuaO("loi_dan", GO_TAT), false);
  assert.ok(goiY);
  assert.equal(goiY.hien, " nước muối ấm.");
  assert.equal(nhanGoiY("Đã dặn. suc hong", goiY), "Đã dặn. Súc họng nước muối ấm.");
});

test("vế sau dấu phẩy cũng được gợi ý, giữ chữ thường; gõ một chữ thì chưa gợi ý", () => {
  const kho = chac("Phổi không ran.");
  const goiY = timGoiYTab("Tim đều, ph", kho, new Map(), false);
  assert.equal(goiY && nhanGoiY("Tim đều, ph", goiY), "Tim đều, phổi không ran.");
  assert.equal(timGoiYTab("Tim đều, p", kho, new Map(), false), null);
});

test("lời dặn đã kê: đúng chẩn đoán thì đứng đầu, chẩn đoán khác xếp sau thư viện chung", () => {
  const don = (icd_chinh: string, loi_dan: string) => ({ id: icd_chinh, thoi_diem: "", icd_chinh, chi_dinh: [], don_thuoc: [], loi_dan });
  const nguon = { ...NGUON, goTat: [], thoiQuen: [don("J35.0", "Ăn mềm, nguội 7 ngày."), don("H66.0", "Không để nước vào tai.")] };
  const kho = cau(khoCau("loi_dan", nguon, { text: "", icd: ["H66.0"] }));
  assert.equal(kho[0], "Không để nước vào tai.");
  assert.ok(kho.indexOf("Ăn mềm, nguội 7 ngày.") > kho.indexOf("Dùng thuốc theo đơn, không tự ý ngừng thuốc."));
});

test("câu gần trùng với chữ đã có trong ô thì không gợi ý lại", () => {
  const kho = chac("Dùng thuốc theo đơn, ăn mềm nguội trong 7 ngày.", "Tái khám sau 1 tuần.");
  assert.equal(timGoiYTab("Ăn mềm, nguội trong 7 ngày. Dùng thuốc theo đơn.", kho, new Map(), false)?.chen, " Tái khám sau 1 tuần.");
});

test("ô trống hoặc vừa hết câu: gợi ý câu tiếp chưa có trong ô, ô khám xuống dòng", () => {
  const kho = chac("Tai: sạch.", "Mũi: thông thoáng.");
  assert.deepEqual(timGoiYTab("", kho, new Map(), true), { tu: 0, chen: "Tai: sạch.", hien: "Tai: sạch." });
  assert.equal(timGoiYTab("Tai: sạch.", kho, new Map(), true)?.chen, "\nMũi: thông thoáng.");
  assert.equal(timGoiYTab("Tai: sạch. ", kho, new Map(), false)?.chen, "Mũi: thông thoáng.");
  assert.equal(timGoiYTab("Tai: sạch. Mũi: thông thoáng.", kho, new Map(), false), null);
});

test("chữ cuối là mã gõ tắt của ô thì gợi ý bung mã; mã của ô khác không bung", () => {
  const ma = maGoTatCuaO("kham_chuyen_khoa", GO_TAT);
  const goiY = timGoiYTab("Khám: tbth", [], ma, true);
  assert.equal(goiY && nhanGoiY("Khám: tbth", goiY), "Khám: Tai: ống tai 2 bên khô sạch, màng nhĩ 2 bên sáng.");
  assert.equal(timGoiYTab("Họng đau, k", [], ma, false)?.chen, "không");
  assert.equal(timGoiYTab("ldtai", [], ma, false), null);
});

test("ô trống chỉ gợi ý câu đủ chắc: câu của bệnh khác chỉ hiện khi bác sĩ đã gõ đầu câu", () => {
  // Ca đau tai chưa có mã ICD: "Súc họng nước muối ấm." chỉ có ở mẫu viêm họng (bệnh khác)
  const kho = khoCau("loi_dan", { ...NGUON, goTat: [], thuVien: {} }, { text: "Đau tai phải", icd: [] });
  assert.equal(kho.find((item) => item.cau === "Súc họng nước muối ấm.")?.chac, false);
  assert.equal(timGoiYTab("", kho, new Map(), false), null);
  assert.equal(timGoiYTab("suc h", kho, new Map(), false)?.chen, "Súc họng nước muối ấm.");
  // Có mã đúng bệnh thì câu của mẫu đó đủ chắc
  const dungBenh = khoCau("loi_dan", { ...NGUON, goTat: [], thuVien: {} }, { text: "", icd: ["J02.9"] });
  assert.equal(timGoiYTab("", dungBenh, new Map(), false)?.chen, "Uống thuốc đúng giờ.");
});
