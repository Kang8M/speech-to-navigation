import assert from "node:assert/strict";
import { test } from "node:test";
import { PRIVACY_POLICY_VERSION, privacyReviewRisks, redactTranscript } from "./privacy";

test("redacts alphanumeric insurance authorization references", () => {
  const result = redactTranscript("Mã bảo lãnh: BHVN2026-ABC123. Đau họng 3 ngày.");
  assert.ok(!result.text.includes("BHVN2026-ABC123"));
  assert.ok(result.text.includes("Đau họng 3 ngày"));
});

test("removes labelled names, contacts, identifiers and addresses, retaining clinical measurements", () => {
  const result = redactTranscript("BN: Tôi tên là Nguyễn Văn Mẫu. SĐT: 0912 345 678. Email: demo@example.test. CCCD: 012345678901. Địa chỉ: 12 Đường Mẫu, Hà Nội. Đau tai phải 3 ngày, sốt 38.5 độ, cân nặng 20 kg.");
  for (const privateValue of ["Nguyễn Văn Mẫu", "0912", "example.test", "012345678901", "Đường Mẫu", "Hà Nội"]) assert.ok(!result.text.includes(privateValue));
  assert.match(result.text, /tai phải 3 ngày/);
  assert.match(result.text, /38.5/);
  assert.match(result.text, /20 kg/);
});
test("removes known identities and nonclinical chatter, retains relevant family history", () => {
  const result = redactTranscript("BS: Bác sĩ Mẫu đang khám. BN: Gia đình có người bị hen. Chuyện vay tiền mua nhà khiến gia đình tranh cãi. Tôi đau họng.", ["Bác sĩ Mẫu"]);
  assert.ok(!result.text.includes("Bác sĩ Mẫu"));
  assert.ok(!result.text.includes("vay tiền"));
  assert.match(result.text, /Gia đình có người bị hen/);
  assert.match(result.text, /đau họng/);
  assert.equal(redactTranscript(result.text).text, result.text);
});

test("keeps clinical facts beside identifiers and does not mistake family history for chatter", () => {
  const result = redactTranscript("BN: Tôi tên là Nguyễn Văn Mẫu bị đau tai 3 ngày. Chuyện gia đình có người bị hen. Ngày sinh: 12/03/1990. BHYT: DN 401 0123456789. BS: Hẹn sau 10 ngày, huyết áp 120/80, SpO2 98%.");
  assert.ok(!result.text.includes("Nguyễn Văn Mẫu"));
  assert.ok(!result.text.includes("12/03/1990"));
  assert.ok(!result.text.includes("0123456789"));
  assert.match(result.text, /bị đau tai 3 ngày/);
  assert.match(result.text, /gia đình có người bị hen/);
  assert.match(result.text, /120\/80/);
  assert.match(result.text, /SpO2 98%/);
  assert.equal(redactTranscript(result.text).text, result.text);
});

test("known identifiers use literal Unicode boundaries rather than deleting clinical word fragments", () => {
  const result = redactTranscript("BN: Mai đau họng. Trẻ bị dị ứng Amoxicillin, không có bệnh tim.", ["Mai", "tim"]);
  assert.ok(!result.text.includes("Mai"));
  assert.match(result.text, /Amoxicillin/);
  assert.match(result.text, /bệnh \[NGƯỜI_ĐÃ_ẨN\]/);
});


test("masks explicit demographics and calendar treatment times while preserving clinical intervals", () => {
  const result = redactTranscript("BN: Nam, 67 tuổi. Giới tính: nam. Nhập viện ngày 12/03/2026 lúc 08:30. Điều trị 3 ngày. Hẹn sau 2 tuần. Đau ngực 15 phút, huyết áp 120/80, SpO2 98%, amiodarone 200 mg, tacrolimus 1 mg.");
  for (const value of ["67 tuổi", "12/03/2026", "08:30", "Giới tính: nam"]) assert.ok(!result.text.includes(value));
  for (const value of ["Điều trị 3 ngày", "Hẹn sau 2 tuần", "Đau ngực 15 phút", "120/80", "SpO2 98%", "amiodarone 200 mg", "tacrolimus 1 mg"]) assert.ok(result.text.includes(value));
  assert.equal(redactTranscript(result.text).text, result.text);
  assert.equal(PRIVACY_POLICY_VERSION, "local-review-2");
  assert.match(result.text, /^BN:/);
});

test("masks age labels, infant age and sex tied to the patient without changing unrelated words", () => {
  const result = redactTranscript("Tuổi: 45. Bé 6 tháng tuổi. Bệnh nhân nữ. Tôi là nam. Nam giới trong nghiên cứu; dùng thuốc nam. Khám ngày 3 tháng 4 năm 2026. Ngày điều trị: 2026-04-05.");
  for (const value of ["Tuổi: 45", "6 tháng tuổi", "Bệnh nhân nữ", "Tôi là nam", "3 tháng 4 năm 2026", "2026-04-05"]) assert.ok(!result.text.includes(value));
  assert.match(result.text, /thuốc nam/);
});

test("rare disease and combinations require review without deleting clinical disease or drug names", () => {
  const input = "Bệnh hiếm: amyloidosis. Đang dùng tafamidis 61 mg. Không đau ngực.";
  const result = redactTranscript(input);
  assert.match(result.text, /amyloidosis/);
  assert.match(result.text, /tafamidis 61 mg/);
  assert.match(result.text, /Không đau ngực/);
  assert.ok(privacyReviewRisks(input).includes("rare_disease_review"));
  assert.ok(privacyReviewRisks("Đau ngực").includes("reidentification_review"));
});
