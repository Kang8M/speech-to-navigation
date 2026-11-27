import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import type { Encounter, Diagnosis, PrescriptionItem, RecordingSession, Source } from "@/shared/clinical/types";
import { approvalState } from "@/shared/clinical/approvals";
import { emptyDefinition } from "@/shared/clinical/schema";
import { ClinicalError, ClinicalRepository } from "./repository";
import { getDemoClinicalActor, resolveEncounterContext } from "./encounter-context";

function setup() {
  const store = new ClinicalRepository(fs.mkdtempSync(path.join(os.tmpdir(), "clinical-scopes-")));
  const actor = getDemoClinicalActor(); const context = resolveEncounterContext(actor, "LK-GIA-0456");
  const record: Encounter = JSON.parse(fs.readFileSync("docs/task-2/examples/encounter-service.example.json", "utf8"));
  Object.assign(record, { patient_id: context.patientId, appointment_id: context.appointmentId, facility_id: context.facilityId, examiner_id: actor.doctorId, primary_doctor_id: actor.doctorId, ai_runs: [], tom_tat: null });
  record.phieu_kham.ly_do_kham = "Đau tai"; record.phieu_kham.benh_su = "Đau tai ba ngày";
  const dx = emptyDefinition<Diagnosis>("diagnosis");
  Object.assign(dx, { id: "dx-initial", noi_dung: { giai_doan: "ban_dau", vai_tro: "chinh", mo_ta: "Viêm tai", muc_do_khang_dinh: "nghi_ngo" } });
  dx.icd.code = "H66.1"; record.chan_doan = [dx];
  record.chi_dinh.groups[0].chan_doan_lich_su_lam_sang = "Đau tai";
  record.chi_dinh.items[0].danh_muc.code = "service-demo";
  return { actor, store, record: store.create(record) };
}
async function service() {
  assert.ok(fs.existsSync("src/server/clinical/approval-service.ts"), "scope approval service must exist");
  return import("./approval-service");
}
const status = (value: number) => (error: unknown) => error instanceof ClinicalError && error.status === value;
function session(record: Encounter): RecordingSession {
  return { id: "session-1", encounter_id: record.id, sequence: 1, device_id: "device", generation: 1, started_at: "2026-11-14T01:00:00Z", ended_at: null, state: "recording", stop_reason: null, content_state: "empty", content_revision: 0, reviewed_content_revision: null, reviewed_digest: null, reviewed_transcripts: [], requests: [], discarded_at: null, discarded_by: null };
}

test("approval appends immutable full snapshots, stays open and preserves unrelated scopes", async () => {
  const { approveScopes } = await service(); const { actor, store, record } = setup();
  const approved = approveScopes(actor, { id: record.id, expected_revision: 1, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, store);
  assert.equal(approved.record.status, "dang_kham"); assert.equal(approved.record.revision, 2);
  assert.equal(approved.context.patientId, record.patient_id); assert.equal(approved.data.ca.pid, record.patient_id);
  assert.equal(approved.record.approval_versions.length, 2);
  for (const version of approved.record.approval_versions) {
    assert.match(version.digest, /^[a-f0-9]{64}$/); assert.equal(version.approved_by, actor.doctorId);
    const snapshot = version.snapshot as unknown as Encounter;
    assert.equal(snapshot.patient_id, record.patient_id); assert.deepEqual(snapshot.approval_versions, []);
  }
  const history = structuredClone(approved.record.approval_versions);
  const edited = store.update(record.id, 2, draft => { draft.phieu_kham.loi_dan = "Tái khám khi đau tăng"; return draft; }, actor.doctorId, new Date().toISOString());
  const conclusion = approveScopes(actor, { id: record.id, expected_revision: edited.revision, scopes: ["conclusion"], acknowledged_issues: true }, store);
  assert.deepEqual(conclusion.record.approval_versions.slice(0, 2), history);
  assert.equal(conclusion.record.approval_versions.length, 3);
  assert.deepEqual((conclusion.record.approval_versions[2].snapshot as unknown as Encounter).approval_versions, []);
});

test("scope validation approves orders independently and rejects incomplete selected sections atomically", async () => {
  const { approveScopes } = await service(); const { actor, store, record } = setup();
  const edited = store.update(record.id, 1, draft => { draft.phieu_kham.benh_su = null; return draft; }, actor.doctorId, new Date().toISOString());
  const order = approveScopes(actor, { id: record.id, expected_revision: edited.revision, scopes: ["service_order:svc-demo-001"], acknowledged_issues: true }, store);
  assert.equal(order.record.approval_versions.length, 1);
  assert.throws(() => approveScopes(actor, { id: record.id, expected_revision: order.record.revision, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, store), status(422));
  assert.equal(store.read(record.id).revision, order.record.revision);
  assert.throws(() => approveScopes(actor, { id: record.id, expected_revision: order.record.revision, scopes: ["service_order:missing"], acknowledged_issues: true }, store), status(422));
});

test("wait needs no definitive diagnosis and resume only accepts waiting encounters", async () => {
  const { transitionEncounter } = await service(); const { actor, store, record } = setup();
  const waiting = transitionEncounter(actor, { id: record.id, expected_revision: 1, action: "wait" }, store);
  assert.equal(waiting.record.status, "cho_kq_cls");
  const resumed = transitionEncounter(actor, { id: record.id, expected_revision: 2, action: "resume" }, store);
  assert.equal(resumed.record.status, "dang_kham");
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: 3, action: "resume" }, store), status(409));
});

test("complete rejects all active session states, pending review and unapproved current sections", async () => {
  const { transitionEncounter, approveScopes } = await service();
  for (const state of ["opening", "recording", "finalizing"] as const) {
    const { actor, store, record } = setup();
    store.update(record.id, 1, draft => { draft.recording_sessions = [{ ...session(draft), state }]; return draft; }, actor.doctorId, new Date().toISOString());
    assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: 2, action: "complete" }, store), status(409));
  }
  const { actor, store, record } = setup();
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: 1, action: "complete" }, store), status(422));
  const approved = approveScopes(actor, { id: record.id, expected_revision: 1, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, store);
  const pending = store.update(record.id, approved.record.revision, draft => { draft.recording_sessions = [{ ...session(draft), state: "stopped", ended_at: "2026-11-14T01:01:00Z", content_state: "awaiting_review", content_revision: 1 }]; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: pending.revision, action: "complete" }, store), status(409));
  const reviewed = store.update(record.id, pending.revision, draft => { draft.recording_sessions[0].content_state = "discarded"; draft.phieu_kham.loi_dan = "Lời dặn mới"; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: reviewed.revision, action: "complete" }, store), status(422));
  const final = approveScopes(actor, { id: record.id, expected_revision: reviewed.revision, scopes: ["conclusion"], acknowledged_issues: true }, store);
  const completed = transitionEncounter(actor, { id: record.id, expected_revision: final.record.revision, action: "complete" }, store);
  assert.equal(completed.record.status, "hoan_thanh_kham");
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: completed.record.revision, action: "resume" }, store), status(409));
  assert.throws(() => approveScopes(actor, { id: record.id, expected_revision: completed.record.revision, scopes: ["initial_note"], acknowledged_issues: true }, store), status(409));
});

test("approval and transition reject foreign actors, stale revisions and unknown request fields", async () => {
  const { approveScopes, transitionEncounter } = await service(); const { actor, store, record } = setup();
  const request = { id: record.id, expected_revision: 1, scopes: ["initial_note"] as const, acknowledged_issues: true as const };
  for (const foreign of [{ ...actor, doctorId: "foreign" }, { ...actor, facilityId: "foreign" }]) {
    assert.throws(() => approveScopes(foreign, { ...request, scopes: [...request.scopes] }, store), status(403));
    assert.throws(() => transitionEncounter(foreign, { id: record.id, expected_revision: 1, action: "wait" }, store), status(403));
  }
  assert.throws(() => approveScopes(actor, { ...request, expected_revision: 99, scopes: [...request.scopes] }, store), status(409));
  assert.throws(() => approveScopes(actor, { ...request, scopes: [...request.scopes], patient_id: "spoof" } as never, store));
  assert.equal(store.read(record.id).revision, 1);
});

test("completion rejects changed approved note and requires meaningful summary approval", async () => {
  const { approveScopes, transitionEncounter } = await service(); const { actor, store, record } = setup();
  const approved = approveScopes(actor, { id: record.id, expected_revision: 1, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, store);
  const history = structuredClone(approved.record.approval_versions);
  const changed = store.update(record.id, approved.record.revision, draft => { draft.phieu_kham.benh_su = "Bệnh sử đã sửa"; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: changed.revision, action: "complete" }, store), status(422));
  const renewed = approveScopes(actor, { id: record.id, expected_revision: changed.revision, scopes: ["initial_note"], acknowledged_issues: true }, store);
  const summary = store.update(record.id, renewed.record.revision, draft => { draft.tom_tat = "Tóm tắt mới"; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => transitionEncounter(actor, { id: record.id, expected_revision: summary.revision, action: "complete" }, store), status(422));
  const final = approveScopes(actor, { id: record.id, expected_revision: summary.revision, scopes: ["summary"], acknowledged_issues: true }, store);
  const completed = transitionEncounter(actor, { id: record.id, expected_revision: final.record.revision, action: "complete" }, store);
  assert.equal(completed.record.status, "hoan_thanh_kham");
  assert.deepEqual(completed.record.approval_versions.slice(0, 2), history);
});

// ---- Đơn thuốc (phạm vi "prescription") ----
type Drug = Partial<PrescriptionItem["noi_dung"]> & { code?: string | null };
function withDrugs(store: ClinicalRepository, id: string, actor: ReturnType<typeof getDemoClinicalActor>, rows: Drug[] | "khong_ke_don" | "chua_de_cap") {
  const revision = store.read(id).revision;
  return store.update(id, revision, draft => {
    if (typeof rows === "string") { draft.don_thuoc = { de_cap: rows, items: [] }; return draft; }
    const items = rows.map((row, index) => {
      const item = emptyDefinition<PrescriptionItem>("prescriptionItem");
      const { code = "TH-003", ...content } = row;
      item.id = `drug-${index + 1}`;
      Object.assign(item.noi_dung, { ten_thuoc: "Amoxicillin", lieu_moi_lan: "1 v", khi_can: false, so_lan_ngay: "3", so_ngay: "5", so_luong_ke: null }, content);
      item.danh_muc.code = code; item.danh_muc.display = code ? "Amoxicillin 500 mg" : null;
      return item;
    });
    draft.don_thuoc = { de_cap: "co_ke_don", items };
    draft.nguon_du_lieu = draft.nguon_du_lieu.filter(source => !source.field_path.startsWith("/don_thuoc/"));
    items.forEach((_, index) => { const source = emptyDefinition<Source>("source"); Object.assign(source, { field_path: `/don_thuoc/items/${index}`, nguon: "nhap_tay", source_system: "prototype-eform" }); draft.nguon_du_lieu.push(source); });
    return draft;
  }, actor.doctorId, new Date().toISOString());
}
const approveRx = (svc: Awaited<ReturnType<typeof service>>, actor: ReturnType<typeof getDemoClinicalActor>, store: ClinicalRepository, id: string) =>
  svc.approveScopes(actor, { id, expected_revision: store.read(id).revision, scopes: ["prescription"], acknowledged_issues: true }, store);
const message = (pattern: RegExp) => (error: unknown) => error instanceof ClinicalError && error.status === 422 && pattern.test(error.message);

test("duyệt đơn thuốc: chưa xác nhận có hoặc không kê thì 422", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  assert.throws(() => approveRx(svc, actor, store, record.id), message(/Hãy xác nhận có hoặc không kê đơn thuốc\./));
});

test("duyệt đơn thuốc: thiếu chẩn đoán có mã ICD thì 422", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  withDrugs(store, record.id, actor, [{}]);
  store.update(record.id, store.read(record.id).revision, draft => { draft.chan_doan[0].icd.code = null; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => approveRx(svc, actor, store, record.id), message(/chẩn đoán/i));
});

test("duyệt đơn thuốc: chẩn đoán duy nhất có mã ICD nhưng đã phủ định thì 422", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  withDrugs(store, record.id, actor, [{}]);
  store.update(record.id, store.read(record.id).revision, draft => { draft.chan_doan[0].noi_dung.muc_do_khang_dinh = "phu_dinh"; return draft; }, actor.doctorId, new Date().toISOString());
  assert.throws(() => approveRx(svc, actor, store, record.id), message(/chẩn đoán/i));
});

test("duyệt đơn thuốc: dòng thiếu mã, liều, lần/ngày, số ngày hoặc Tổng SL thì 422", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  const cases: [Drug, RegExp][] = [
    [{ code: null }, /chọn đúng thuốc/],
    [{ lieu_moi_lan: "" }, /liều/i],
    [{ so_lan_ngay: null }, /lần mỗi ngày|lần\/ngày/i],
    [{ so_ngay: "0" }, /số ngày/i],
    [{ khi_can: true, so_lan_ngay: null, so_ngay: null, so_luong_ke: null }, /Tổng SL/],
    [{ lieu_moi_lan: "2 giọt", so_luong_ke: null }, /Tổng SL/],
  ];
  for (const [row, pattern] of cases) {
    withDrugs(store, record.id, actor, [row]);
    assert.throws(() => approveRx(svc, actor, store, record.id), message(pattern), JSON.stringify(row));
  }
  assert.equal(store.read(record.id).approval_versions.length, 0);
});

test("duyệt đơn thuốc hợp lệ: dòng được chấp nhận, ghi phiên bản, phần khác không đổi", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  withDrugs(store, record.id, actor, [{}, { khi_can: true, so_lan_ngay: null, so_ngay: null, so_luong_ke: "6" }]);
  const before = store.read(record.id);
  const approved = approveRx(svc, actor, store, record.id).record;
  assert.ok(approved.don_thuoc.items.every(item => item.review.trang_thai === "chap_nhan" && item.review.reviewer_id === actor.doctorId));
  assert.equal(approved.approval_versions.length, 1);
  const version = approved.approval_versions[0];
  assert.equal(version.scope, "prescription"); assert.match(version.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(version.sources.map(source => source.field_path), ["/don_thuoc/items/0", "/don_thuoc/items/1"]);
  assert.ok(approved.nguon_du_lieu.filter(source => source.field_path.startsWith("/don_thuoc/")).every(source => source.review.trang_thai === "chap_nhan"));
  assert.deepEqual(approved.phieu_kham, before.phieu_kham);
  assert.deepEqual(approved.chi_dinh.items.map(item => item.review), before.chi_dinh.items.map(item => item.review));
  assert.deepEqual(approved.chan_doan.map(item => item.review), before.chan_doan.map(item => item.review));
  assert.equal(approvalState(approved, "prescription"), "current");
});

test("duyệt đơn: 'không kê đơn' duyệt được; sửa liều sau duyệt thành 'changed'; duyệt phiếu không động đến đơn", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  withDrugs(store, record.id, actor, "khong_ke_don");
  assert.equal(approveRx(svc, actor, store, record.id).record.approval_versions.at(-1)?.scope, "prescription");
  withDrugs(store, record.id, actor, [{}]);
  const approved = approveRx(svc, actor, store, record.id).record;
  assert.equal(approvalState(approved, "prescription"), "current");
  const edited = store.update(record.id, approved.revision, draft => { draft.don_thuoc.items[0].noi_dung.lieu_moi_lan = "2 v"; return draft; }, actor.doctorId, new Date().toISOString());
  assert.equal(approvalState(edited, "prescription"), "changed");
  const note = svc.approveScopes(actor, { id: record.id, expected_revision: edited.revision, scopes: ["initial_note"], acknowledged_issues: true }, store).record;
  assert.equal(approvalState(note, "prescription"), "changed");
  assert.equal(note.approval_versions.filter(version => version.scope === "prescription").length, approved.approval_versions.filter(version => version.scope === "prescription").length);
});

test("hoàn tất khám đòi duyệt đơn khi đã kê; chưa xác nhận có hoặc không kê vẫn hoàn tất được", async () => {
  const svc = await service(); const { actor, store, record } = setup();
  const complete = () => svc.transitionEncounter(actor, { id: record.id, expected_revision: store.read(record.id).revision, action: "complete" }, store);
  svc.approveScopes(actor, { id: record.id, expected_revision: 1, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, store);
  withDrugs(store, record.id, actor, [{}]);
  assert.throws(() => complete(), message(/Cần duyệt các phần hiện tại/));
  approveRx(svc, actor, store, record.id);
  assert.equal(complete().record.status, "hoan_thanh_kham");
  const other = setup();
  other.store.update(other.record.id, 1, draft => { draft.don_thuoc = { de_cap: "chua_de_cap", items: [] }; return draft; }, other.actor.doctorId, new Date().toISOString());
  svc.approveScopes(other.actor, { id: other.record.id, expected_revision: 2, scopes: ["initial_note", "service_order:svc-demo-001"], acknowledged_issues: true }, other.store);
  assert.equal(svc.transitionEncounter(other.actor, { id: other.record.id, expected_revision: 3, action: "complete" }, other.store).record.status, "hoan_thanh_kham");
});
