import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { applyAiDraft, aiEformPatch } from "./apply-ai";
import { applyEformSnapshot, parseEformSnapshot } from "./eform";
import { emptyEncounter, parseEncounter } from "./schema";
import type { ClinicalExtraction } from "./api";

const fixture = (name: string) => JSON.parse(fs.readFileSync(`docs/task-2/examples/${name}.example.json`, "utf8"));
let sequence = 0;
const context = { newId: () => `ai-row-${++sequence}`, now: "2026-11-12T10:00:00+07:00", services: [] };
const run = (): ClinicalExtraction => ({ run_id: "run-1", draft: fixture("ai-output-service"), transcript: fixture("transcript-service"), provider: "mock", model: "extractive", prompt_version: "1", created_at: context.now, input_digest: "digest", duration_ms: 1 });
test("AI draft becomes structured notes/services with provenance; retry does not duplicate rows", () => {
  const base = emptyEncounter({ id: "enc-1", patientId: "patient-demo", doctorId: "doctor-demo", now: context.now });
  const result = applyAiDraft(base, run(), context);
  assert.equal(result.chi_dinh.items.length, 1);
  assert.equal(result.chi_dinh.items[0].noi_dung.ben, "trai");
  assert.equal(result.ai_runs.length, 1);
  assert.ok(result.nguon_du_lieu.some(item => item.field_path === "/chi_dinh/items/0/noi_dung" && item.ai_run_id === "run-1"));
  const retry = applyAiDraft(result, run(), context);
  assert.deepEqual(retry, result);
  assert.deepEqual(result.don_thuoc, { de_cap: "chua_de_cap", items: [] });
  parseEncounter(result);
});
test("UI patch does not fill administrative/default/absent fields, retains positive clinical claims", () => {
  const r = run();
  r.draft = fixture("ai-output");
  const patch = aiEformPatch(r, context);
  assert.equal(patch.fields.ly_do.value, "Đau họng");
  assert.equal(patch.fields.icd_ra_vien, undefined);
  assert.equal(patch.fields.thoi_gian_kham, undefined);
  assert.equal(patch.fields.co_pttt, undefined);
  assert.equal(patch.fields.hen_tai_kham.value, "Có");
  assert.equal(patch.fields.kham_chuyen_khoa.nguon, "xem");
});
test("applyAiDraft giữ nguyên don_thuoc đã có của bác sĩ", () => {
  const base = emptyEncounter({ id: "enc-1", patientId: "patient-demo", doctorId: "doctor-demo", now: context.now });
  const withDrugs = applyEformSnapshot(parseEncounter(base), parseEformSnapshot({ fields: {}, chiDinh: [], trangThai: "Đang khám", donThuoc: [
    { ma: "T-1", ten: "Paracetamol 500mg", ham_luong: "500mg", duong_dung: "Uống", lieu_moi_lan: "1 viên", khi_can: false, so_lan_ngay: "3", thoi_diem: "Sau ăn", so_ngay: "5", so_luong_ke: "", ghi_chu: "", nguon: "bs", ung_vien: [] },
  ] }), { now: context.now, newId: () => "drug-row-1", services: [], drugs: [{ ma: "T-1", ten: "Paracetamol 500mg" }] });
  withDrugs.don_thuoc.items[0].review = { trang_thai: "chap_nhan", reviewer_id: "doctor-demo", reviewed_at: context.now };
  const truoc = structuredClone(withDrugs.don_thuoc);
  assert.equal(truoc.items.length, 1);
  assert.equal(truoc.items[0].danh_muc.code, "T-1");
  const result = applyAiDraft(withDrugs, run(), context);
  assert.deepEqual(result.don_thuoc, truoc);
  const nguonThuoc = (record: typeof result) => record.nguon_du_lieu.filter(item => item.field_path.startsWith("/don_thuoc"));
  assert.deepEqual(nguonThuoc(result), nguonThuoc(withDrugs));
});
