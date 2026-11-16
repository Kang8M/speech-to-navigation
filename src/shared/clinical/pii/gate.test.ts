import assert from "node:assert/strict";
import { test } from "node:test";
import { PII_POLICY_VERSION, redactPii, type KnownIdentifier } from "./index";
import { aiRouteFor, checkResidualPii } from "./gate";
import { buildAuditEntry } from "./audit";

const none: KnownIdentifier[] = [];
const noAllow: ReadonlySet<string> = new Set();
const reasons = (s: string, known = none, allow = noAllow) => checkResidualPii(s, known, allow).reasons.map((r) => r.reason);

test("R11a: giá trị đã biết còn sót (không dấu) bị chặn", () => {
  const r = checkResidualPii("bệnh nhân tên nguyen thi gia đau tai", [{ value: "Nguyễn Thị Giả", kind: "BỆNH_NHÂN" }], noAllow);
  assert.equal(r.passed, false);
  assert.ok(r.reasons.some((x) => x.reason === "R11a_gia_tri_da_biet"));
  assert.ok(r.reasons.every((x) => x.excerpt.length <= 40));
});

test("R11a: giá trị ngắn (<= 2 ký tự) bị bỏ qua", () => {
  assert.equal(checkResidualPii("đau tai lê", [{ value: "Lê", kind: "BỆNH_NHÂN" }], noAllow).reasons.some((x) => x.reason === "R11a_gia_tri_da_biet"), false);
});

test("R11b: dãy số dài, kể cả tách khoảng trắng; số trong nhãn không tính", () => {
  assert.ok(reasons("gọi 0 9 1 2 3 4 5 6 7 8 nhé").includes("R11b_day_so_dai"));
  assert.ok(reasons("mã 012-345").includes("R11b_day_so_dai"));
  assert.equal(reasons("liên hệ [MÃ_ĐỊNH_DANH_123456] đau tai").includes("R11b_day_so_dai"), false);
  assert.equal(reasons("uống 500 mg ngày 2 lần, đau 3 ngày").includes("R11b_day_so_dai"), false);
});

test("R11c: họ + âm tiết chữ thường, không dấu cũng bắt", () => {
  assert.equal(checkResidualPii("gặp lý hoài an ở chợ", none, noAllow).passed, false);
  assert.ok(reasons("gặp lý hoài an ở chợ").includes("R11c_ten_rieng_con_sot"));
  const gap = checkResidualPii("chi le thi hoa tho kho", none, noAllow);
  assert.equal(gap.passed, false);
  assert.ok(gap.reasons.some((x) => x.reason === "R11c_ten_rieng_con_sot"));
});

test("R11c: câu lâm sàng thường qua; nhãn không bị coi là tên", () => {
  assert.equal(checkResidualPii("thủng màng nhĩ, viêm tai giữa", none, noAllow).passed, true);
  assert.equal(reasons("[BỆNH_NHÂN] đau tai [NGƯỜI_1] đưa đến").includes("R11c_ten_rieng_con_sot"), false);
});

test("R11c: allowlist (fold) cho cụm bắt đầu bằng họ đi qua", () => {
  assert.equal(checkResidualPii("bị cao huyết áp", none, noAllow).passed, false);
  assert.equal(checkResidualPii("bị cao huyết áp", none, new Set(["cao huyết áp"])).passed, true);
  assert.equal(checkResidualPii("bị Cao Huyết Áp", none, new Set(["cao huyet ap"])).passed, true);
  assert.equal(checkResidualPii("hẹn mai tái khám", none, new Set(["mai"])).passed, true);
});

test("R11d: email hoặc URL", () => {
  assert.ok(reasons("gửi về abc@example.test nhé").includes("R11d_email_url"));
  assert.ok(reasons("xem https://example.test/x").includes("R11d_email_url"));
});

test("bản sạch từ bộ che qua chốt chặn", () => {
  const known: KnownIdentifier[] = [{ value: "Nguyễn Thị Giả", kind: "BỆNH_NHÂN" }];
  const r = redactPii("chị nguyen thi gia đau tai phải ba ngày dùng amoxicillin 500 mg", known);
  const g = checkResidualPii(r.clean, known, new Set(["ba ngày"])); // "ba" (số 3) trùng họ Bá sau khi bỏ dấu
  assert.equal(g.passed, true);
  assert.equal(g.reasons.length, 0);
});

test("R14: không đồng ý thì chỉ chạy cục bộ", () => {
  assert.equal(aiRouteFor(false), "local_only");
  assert.equal(aiRouteFor(true), "external_allowed");
});

test("R13: nhật ký không mang bản thô", () => {
  const raw = "chị nguyen thi gia đau tai";
  const known: KnownIdentifier[] = [{ value: "Nguyễn Thị Giả", kind: "BỆNH_NHÂN" }];
  const red = redactPii(raw, known);
  const gate = checkResidualPii(red.clean, known, noAllow);
  const e = buildAuditEntry({
    now: "2026-11-16T01:02:03.000Z", encounter_id: "LK-GIA-0001", session_sequence: 1,
    policy_version: PII_POLICY_VERSION, counts: red.counts, gate: gate.passed,
    gate_reasons: gate.reasons.map((x) => x.reason), ai_route: aiRouteFor(true),
    provider: "mock", model: "mock-1", clean_sha256: "a".repeat(64),
  });
  assert.equal(e.at, "2026-11-16T01:02:03.000Z");
  assert.equal(e.gate, true);
  const json = JSON.stringify(e).toLowerCase();
  assert.equal(json.includes("nguyen"), false);
  assert.equal(json.includes("đau tai"), false);
  assert.equal("now" in e, false);
});
