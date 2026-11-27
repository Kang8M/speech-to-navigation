import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import type { Encounter, JsonValue } from "./types";
import * as approvals from "./approvals";

const fixture = (): Encounter => ({ ...JSON.parse(fs.readFileSync("docs/task-2/examples/encounter-service.example.json", "utf8")), tom_tat: null });
function approve(record: Encounter, scope: approvals.ApprovalScope) {
  record.approval_versions.push({ id: `approval-${record.approval_versions.length}`, scope, snapshot: structuredClone(record) as unknown as JsonValue, digest: "server-digest", approved_by: "doctor", approved_at: "2026-11-14T00:00:00Z", sources: [] });
}

test("scope comparison preserves unrelated approvals and historical snapshots", () => {
  assert.equal(typeof approvals.approvalState, "function", "scope state implementation must exist");
  const record = fixture();
  approve(record, "initial_note"); approve(record, "service_order:svc-demo-001");
  const history = structuredClone(record.approval_versions);
  record.phieu_kham.loi_dan = "Tái khám khi cần";
  assert.equal(approvals.approvalState(record, "initial_note"), "current");
  assert.equal(approvals.approvalState(record, "service_order:svc-demo-001"), "current");
  record.phieu_kham.benh_su = "Bệnh sử bổ sung";
  assert.equal(approvals.approvalState(record, "initial_note"), "changed");
  assert.deepEqual(record.approval_versions, history);
});

test("review, recording and encounter metadata do not change clinical approval state", () => {
  assert.equal(typeof approvals.approvalState, "function");
  const record = fixture(); approve(record, "initial_note"); approve(record, "service_order:svc-demo-001");
  record.revision++; record.encounter_at = "2026-11-14T03:00:00Z"; record.status = "cho_kq_cls";
  record.audit.approved_by = "other"; record.audit.updated_at = "2026-11-14T03:00:00Z";
  record.chi_dinh.items[0].review.trang_thai = "chap_nhan"; record.chi_dinh.items[0].trang_thai = "da_xac_nhan";
  record.chi_dinh.groups[0].created_at = "2026-11-14T03:00:00Z";
  assert.equal(approvals.approvalState(record, "initial_note"), "current");
  assert.equal(approvals.approvalState(record, "service_order:svc-demo-001"), "current");
  record.chi_dinh.groups[0].chan_doan_lich_su_lam_sang = "Chẩn đoán mới";
  assert.equal(approvals.approvalState(record, "service_order:svc-demo-001"), "changed");
});

test("legacy approval never certifies new scopes and latest approval wins", () => {
  assert.equal(typeof approvals.approvalState, "function");
  const record = fixture();
  record.approval_versions.push({ id: "legacy", scope: "legacy", snapshot: structuredClone(record) as unknown as JsonValue, digest: "legacy", approved_by: "doctor", approved_at: "2026-11-14T00:00:00Z", sources: [] });
  assert.equal(approvals.approvalState(record, "initial_note"), "unapproved");
  approve(record, "initial_note"); record.phieu_kham.benh_su = "new"; approve(record, "initial_note");
  record.phieu_kham.benh_su = null;
  assert.equal(approvals.approvalState(record, "initial_note"), "changed");
});

test("scope mapping explicitly covers clinical form fields and refuses unknown paths", () => {
  assert.equal(typeof approvals.approvalScopeForPath, "function");
  for (const path of ["/phieu_kham/benh_su", "/phieu_kham/di_ung/mo_ta", "/phieu_kham/co_pttt", "/sinh_hieu/mach/value", "/referral_source", "/thong_tin_khac/xn_me", "/chi_dinh/de_cap", "/chan_doan/ban_dau/0/icd/code"]) assert.equal(approvals.approvalScopeForPath(path), "initial_note", path);
  for (const path of ["/phieu_kham/ghi_chu_ket_qua", "/phieu_kham/da_xu_ly", "/phieu_kham/huong_dieu_tri", "/phieu_kham/loi_dan", "/phieu_kham/hen_tai_kham/ngay_cu_the", "/phieu_kham/tinh_trang_ra_vien", "/chan_doan/ra_vien/0/icd/code", "/ket_qua/0/ket_qua_text"]) assert.equal(approvals.approvalScopeForPath(path), "conclusion", path);
  assert.equal(approvals.approvalScopeForPath("/tom_tat"), "summary");
  assert.equal(approvals.approvalScopeForPath("/chi_dinh/items/0/noi_dung/so_luong", "stable-order"), "service_order:stable-order");
  assert.equal(approvals.approvalScopeForPath("/chi_dinh/groups/0/chan_doan_lich_su_lam_sang", "stable-order"), "service_order:stable-order");
  for (const path of ["/unknown", "/phieu_kham/unknown", "/audit/updated_at", "/encounter_at", "/chi_dinh/items/0", "/chan_doan/0/icd/code"]) assert.throws(() => approvals.approvalScopeForPath(path));
});

test("completion requires initial note, every current order and meaningful optional sections", () => {
  assert.equal(typeof approvals.requiredApprovalScopes, "function");
  const record = fixture();
  assert.deepEqual(approvals.requiredApprovalScopes(record), ["initial_note", "service_order:svc-demo-001"]);
  record.phieu_kham.hen_tai_kham.co_hen = false;
  assert.deepEqual(approvals.requiredApprovalScopes(record), ["initial_note", "service_order:svc-demo-001", "conclusion"]);
  record.tom_tat = "  "; assert.equal(approvals.requiredApprovalScopes(record).includes("summary"), false);
  record.tom_tat = "Bản tóm tắt";
  assert.deepEqual(approvals.requiredApprovalScopes(record), ["initial_note", "service_order:svc-demo-001", "conclusion", "summary"]);
});

test("compatibility badge requires all current scopes, preserves equivalent legacy content only", () => {
  const record = fixture();
  approve(record, "initial_note");
  assert.deepEqual(approvals.approvalAuditCompatibility(record), { approved_at: null, approved_by: null });
  approve(record, "service_order:svc-demo-001");
  assert.deepEqual(approvals.approvalAuditCompatibility(record), { approved_at: "2026-11-14T00:00:00Z", approved_by: "doctor" });
  record.phieu_kham.benh_su = "Changed";
  assert.deepEqual(approvals.approvalAuditCompatibility(record), { approved_at: null, approved_by: null });
  record.approval_versions = [{ id: "legacy", scope: "legacy", snapshot: structuredClone(record) as unknown as JsonValue, digest: "old", approved_by: "legacy-doctor", approved_at: "2026-11-13T00:00:00Z", sources: [] }];
  record.status = "cho_kq_cls";
  assert.deepEqual(approvals.approvalAuditCompatibility(record), { approved_at: "2026-11-13T00:00:00Z", approved_by: "legacy-doctor" });
  assert.equal(approvals.approvalState(record, "initial_note"), "unapproved");
  record.tom_tat = "Summary added";
  assert.deepEqual(approvals.approvalAuditCompatibility(record), { approved_at: null, approved_by: null });
});

test("canonical scope serialization ignores object key order and missing orders never stay current", () => {
  assert.equal(approvals.serializeApprovalScope({ z: [{ b: 2, a: 1 }], a: false }), '{"a":false,"z":[{"a":1,"b":2}]}');
  const record = fixture(); approve(record, "service_order:svc-demo-001");
  record.chi_dinh.items = [];
  assert.equal(approvals.approvalState(record, "service_order:svc-demo-001"), "changed");
  assert.equal(approvals.scopeProjection(record, "service_order:svc-demo-001"), null);
});

test("metadata paths and unknown nested clinical fields do not acquire a scope", () => {
  for (const path of ["/sinh_hieu/measured_at", "/sinh_hieu/source_system", "/thong_tin_khac/unknown", "/phieu_kham/di_ung/unknown", "/chi_dinh/items/0/review", "/chi_dinh/groups/0/created_at"]) assert.throws(() => approvals.approvalScopeForPath(path, "stable-order"), path);
});

function withDrug(record: Encounter, deCap: "co_ke_don" | "khong_ke_don" = "co_ke_don"): Encounter {
  record.don_thuoc = { de_cap: deCap, items: [] };
  if (deCap === "co_ke_don") {
    record.don_thuoc.items.push({
      id: "rx-demo-001", noi_dung: { ten_thuoc: "Paracetamol", ham_luong: "500mg", duong_dung: "uống", lieu_moi_lan: "1 viên", khi_can: false, so_lan_ngay: "3", thoi_diem: null, so_ngay: "5", so_luong_ke: null, ghi_chu: null },
      danh_muc: structuredClone(record.chi_dinh.items[0].danh_muc), chan_doan_ids: [], requester_id: null, requested_at: null, review: structuredClone(record.chi_dinh.items[0].review),
    });
  }
  return record;
}

test("prescription scope: path mapping", () => {
  assert.equal(approvals.approvalScopeForPath("/don_thuoc/de_cap"), "prescription");
  assert.equal(approvals.approvalScopeForPath("/don_thuoc/items/0/noi_dung"), "prescription");
  assert.throws(() => approvals.approvalScopeForPath("/don_thuoc/items/0/review"));
});

test("prescription scope: required only once decided", () => {
  const record = fixture();
  assert.ok(!approvals.requiredApprovalScopes(record).includes("prescription"));
  assert.ok(approvals.requiredApprovalScopes(withDrug(structuredClone(record))).includes("prescription"));
  const none = approvals.requiredApprovalScopes(withDrug(structuredClone(record), "khong_ke_don"));
  assert.ok(none.includes("prescription"));
  const scopes = approvals.requiredApprovalScopes(withDrug(structuredClone(record)));
  assert.ok(scopes.indexOf("prescription") > scopes.indexOf(`service_order:${record.chi_dinh.items[0].id}`));
});

test("prescription scope: state follows dose, diagnosis, allergy and de_cap but not review or other notes", () => {
  const record = withDrug(fixture());
  record.chan_doan.push({ id: "dx-demo-001", noi_dung: { giai_doan: "ban_dau", mo_ta: "Viêm họng", muc_do_khang_dinh: "xac_dinh", vai_tro: "chinh" }, icd: structuredClone(record.chi_dinh.items[0].danh_muc), review: structuredClone(record.chi_dinh.items[0].review) });
  approve(record, "prescription");
  assert.equal(approvals.approvalState(record, "prescription"), "current");
  record.don_thuoc.items[0].review.trang_thai = "chua_duyet";
  record.phieu_kham.benh_su = "Bệnh sử khác";
  assert.equal(approvals.approvalState(record, "prescription"), "current");
  const base = structuredClone(record);
  record.don_thuoc.items[0].noi_dung.lieu_moi_lan = "2 viên";
  assert.equal(approvals.approvalState(record, "prescription"), "changed");
  const di = structuredClone(base); di.phieu_kham.di_ung.mo_ta = "Dị ứng mới";
  assert.equal(approvals.approvalState(di, "prescription"), "changed");
  const cd = structuredClone(base); cd.chan_doan.find(item => item.noi_dung.giai_doan === "ban_dau")!.noi_dung.mo_ta = "Chẩn đoán khác";
  assert.equal(approvals.approvalState(cd, "prescription"), "changed");
  const dc = structuredClone(base); dc.don_thuoc = { de_cap: "khong_ke_don", items: [] };
  assert.equal(approvals.approvalState(dc, "prescription"), "changed");
});

test("prescription scope: old snapshots without don_thuoc stay readable and approved", () => {
  const record = fixture(); approve(record, "initial_note"); approve(record, `service_order:${record.chi_dinh.items[0].id}`);
  for (const version of record.approval_versions) delete (version.snapshot as Record<string, unknown>).don_thuoc;
  assert.doesNotThrow(() => approvals.approvalState(record, "initial_note"));
  assert.equal(approvals.approvalState(record, "initial_note"), "current");
  assert.notEqual(approvals.approvalAuditCompatibility(record).approved_at, null);
  const legacy = fixture(); legacy.approval_versions = [{ id: "legacy", scope: "legacy", snapshot: structuredClone(legacy) as unknown as JsonValue, digest: "old", approved_by: "doctor", approved_at: "2026-11-13T00:00:00Z", sources: [] }]; delete (legacy.approval_versions[0].snapshot as Record<string, unknown>).don_thuoc;
  assert.doesNotThrow(() => approvals.approvalAuditCompatibility(legacy));
  assert.equal(approvals.approvalState(withDrug(structuredClone(legacy)), "prescription"), "unapproved");
});
