import assert from "node:assert/strict";
import { test } from "node:test";
import { HO_VIET, PII_POLICY_VERSION, foldVietnamese, redactPii } from "./index";

const none = [] as never[];

test("phiên bản rule và bỏ dấu", () => {
  assert.equal(PII_POLICY_VERSION, "pii-auto-1");
  assert.equal(foldVietnamese("  Nguyễn  Thị Đào "), "nguyen thi dao");
  assert.ok(HO_VIET.length >= 90);
});

test("R1: tên đã biết, viết không dấu vẫn bị che", () => {
  const r = redactPii("chị nguyen thi gia đau tai", [{ value: "Nguyễn Thị Giả", kind: "BỆNH_NHÂN" }]);
  assert.equal(r.clean, "chị [BỆNH_NHÂN] đau tai");
  assert.equal(r.counts.R1, 1);
  assert.equal(r.spans[0].start, 4);
  assert.equal(r.spans[0].end, 18);
  assert.equal(r.spans[0].rule, "R1");
});

test("R1: người nhà xuất hiện hai lần cùng nhãn; số điện thoại đã biết tách khoảng trắng", () => {
  const r = redactPii("trần văn chồng chở tôi, trần văn chồng ở ngoài, gọi 0 9 1 2 3 4 5 6 7 8", [
    { value: "Trần Văn Chồng", kind: "NGƯỜI_NHÀ" },
    { value: "0912345678", kind: "LIÊN_HỆ" },
  ]);
  assert.equal(r.clean, "[NGƯỜI_NHÀ_1] chở tôi, [NGƯỜI_NHÀ_1] ở ngoài, gọi [LIÊN_HỆ_1]");
});

test("R2: tên người không cần chữ hoa", () => {
  assert.equal(redactPii("con tôi tên là lê minh bé, bị sổ mũi", none).clean, "con tôi tên là [NGƯỜI_1], bị sổ mũi");
  const r = redactPii("bác sĩ ơi ông phạm văn hàng xóm cũng bị", none);
  assert.ok(r.clean.includes("[NGƯỜI_1]"));
  assert.ok(!r.clean.includes("phạm"));
});

test("R2: không nhầm ho (triệu chứng) hay chữ thường gặp", () => {
  const text = "bé ho 3 ngày, cao 90 cm, dương tính với cúm";
  assert.equal(redactPii(text, none).clean, text);
});

test("R3: địa chỉ và địa danh", () => {
  const a = redactPii("nhà ở số 12 đường lê lợi phường bến thành", none).clean;
  for (const s of ["lê lợi", "bến thành", "12"]) assert.ok(!a.includes(s), s);
  assert.ok(redactPii("quê ở huyện mỹ đức", none).clean.includes("[ĐỊA_DANH_1]"));
  assert.equal(redactPii("đường huyết cao, tỉnh táo", none).clean, "đường huyết cao, tỉnh táo");
});

test("R4: ngày tháng, giữ thời gian bệnh", () => {
  const r = redactPii("sinh ngày 10/03/1978, đau tai 3 ngày nay", none);
  assert.ok(r.clean.includes("[NGÀY]"));
  assert.ok(r.clean.includes("3 ngày nay"));
  assert.ok(!r.clean.includes("1978"));
});

test("R5: liên hệ", () => {
  const r = redactPii("số 0912 345 678 mail giả@vi.du email demo.gia@vi.du web https://vi.du ip 192.168.1.10", none);
  assert.ok(!/0912|demo\.gia|https:|192\./.test(r.clean), r.clean);
  assert.equal(r.counts.R5, 4);
  assert.match(r.clean, /\[LIÊN_HỆ_1\]/);
  assert.match(r.clean, /\[LIÊN_HỆ_4\]/);
});

test("R6: mã định danh", () => {
  for (const [text, secret] of [
    ["cccd 001234567890", "001234567890"],
    ["biển số 29A-123.45", "123.45"],
    ["pid GIA-000123", "000123"],
    ["số tài khoản 0123456789", "0123456789"],
  ] as const) {
    const r = redactPii(text, none);
    assert.ok(r.clean.includes("[MÃ_ĐỊNH_DANH_1]"), r.clean);
    assert.ok(!r.clean.includes(secret), r.clean);
  }
});

test("R7: thông tin nhạy cảm", () => {
  for (const text of ["quốc tịch nhật", "theo đạo thiên chúa", "đã ly hôn"]) {
    assert.ok(redactPii(text, none).clean.includes("[THÔNG_TIN_NHẠY_CẢM_1]"), text);
  }
  assert.equal(redactPii("viêm âm đạo", none).spans.length, 0);
});

test("R8: nội dung ngoài khám, giữ tiền sử gia đình", () => {
  assert.ok(redactPii("chuyện vay tiền nhà hàng xóm", none).clean.includes("[NỘI_DUNG_NGOÀI_KHÁM]"));
  const keep = "mẹ tôi bị ung thư vòm họng";
  assert.equal(redactPii(keep, none).clean, keep);
});

test("giữ nguyên thuốc, liều, bên tai, thời gian bệnh", () => {
  const raw = "amoxicillin 500 mg ngày 2 lần, tai phải, sốt 38,5 độ, đau 3 ngày nay";
  const r = redactPii(raw, none);
  assert.equal(r.clean, raw);
  assert.equal(r.spans.length, 0);
});

test("tuổi và giới tính gắn R7", () => {
  const r = redactPii("bệnh nhân nữ 47 tuổi", none);
  assert.ok(r.clean.includes("[GIỚI_TÍNH]"));
  assert.ok(r.clean.includes("[TUỔI]"));
  assert.ok(r.spans.every(s => s.rule === "R7"));
});

test("span hợp lệ, không chồng nhau, vị trí đúng cả khi bản thô là NFD", () => {
  const raw = "chị Nguyễn Thị Giả (0912 345 678) sinh ngày 10/03/1978 quốc tịch nhật".normalize("NFD");
  const r = redactPii(raw, [{ value: "Nguyễn Thị Giả", kind: "BỆNH_NHÂN" }]);
  let last = 0;
  for (const s of r.spans) {
    assert.ok(raw.slice(s.start, s.end).length > 0);
    assert.ok(s.start >= last);
    last = s.end;
  }
  assert.equal(raw.slice(r.spans[0].start, r.spans[0].end).normalize("NFC"), "Nguyễn Thị Giả");
  assert.ok(!/Nguy|0912|1978|nhật/.test(r.clean.normalize("NFC")), r.clean);
});
