import assert from "node:assert/strict";
import { test } from "node:test";
import { loadForms } from "@/server/du-lieu/config";
import type { GoTat } from "@/shared/eform/go-tat";
import type { Draft } from "@/shared/types";
import { buildSystemPrompt, buildUserPrompt } from "./prompt";

const MAU: Draft = { phieu_kham: { benh_su: "Đau tai [phải|trái] [số] ngày" }, chi_dinh: [], ke_don: [] };

test("không có mẫu thì prompt như cũ", () => {
  assert.equal(buildUserPrompt("abc"), "<tom_tat>\nabc\n</tom_tat>");
});

test("có mẫu thì kèm <phieu_mau> và JSON mẫu", () => {
  const prompt = buildUserPrompt("tai T, 3n", undefined, MAU);
  assert.ok(prompt.startsWith("<tom_tat>\ntai T, 3n\n</tom_tat>"));
  assert.ok(prompt.includes(`<phieu_mau>\n${JSON.stringify(MAU)}\n</phieu_mau>`));
  assert.ok(prompt.includes("giữ nguyên cả ngoặc"));
});

test("lỗi lần trước vẫn được nối khi có mẫu", () => {
  assert.ok(buildUserPrompt("x", "thiếu trường", MAU).includes("Lần trả lời trước không hợp lệ (thiếu trường)"));
});

const FORMS = loadForms();
const CAU_QUEN: GoTat[] = [
  { ma: "tbth", o: "kham_chuyen_khoa", noi_dung: "Tai: hai bên sạch." },
  { ma: "mnde", o: "kham_chuyen_khoa", noi_dung: "Mũi: niêm mạc nề." },
  { ma: "ldm", o: "loi_dan", noi_dung: "Rửa mũi ngày 2 lần." },
  { ma: "ptot", o: "kham_khac", noi_dung: "Phổi thông khí đều." },
  { ma: "kco", o: "tu", noi_dung: "không có" },
];

test("không có câu quen thì system prompt như cũ", () => {
  assert.equal(buildSystemPrompt(FORMS, {}, []), buildSystemPrompt(FORMS, {}));
  assert.ok(!buildSystemPrompt(FORMS, {}).includes("<cau_quen>"));
});

test("câu quen xếp theo trường, bỏ từ ngắn và ô ngoài schema", () => {
  const prompt = buildSystemPrompt(FORMS, {}, CAU_QUEN);
  const phan = prompt.slice(prompt.indexOf("<cau_quen>"), prompt.indexOf("</cau_quen>"));
  assert.ok(phan.includes('kham_chuyen_khoa:\n  - "Tai: hai bên sạch."\n  - "Mũi: niêm mạc nề."'));
  assert.ok(phan.includes('loi_dan:\n  - "Rửa mũi ngày 2 lần."'));
  assert.ok(!phan.includes("Phổi thông khí đều"));
  assert.ok(!phan.includes("không có"));
  assert.ok(prompt.includes("nguyên văn"));
});
