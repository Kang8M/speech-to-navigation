import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ClinicalError } from "@/server/clinical/repository";
import { getDemoClinicalActor, resolveEncounterContext } from "@/server/clinical/encounter-context";
import { approveDemoPhieu, createDemoPhieu, demoStore, readDemoPhieu, resetDemoData, saveDoctorEdit, type DemoStore } from "./store";
import { mergeSession } from "./merge";
import type { DemoPhieu } from "@/shared/demo-luong/types";
import type { EformSnapshot } from "@/shared/clinical/eform";

const parent = fs.mkdtempSync(path.join(os.tmpdir(), "demo-luong-store-"));
let storeCount = 0;
/** Mở phiếu theo ngữ cảnh fixture có sẵn (không ghi data/clinical/walk-in-contexts/, tránh đụng test khác chạy song song). */
function fixtureOpener(): DemoStore["openContext"] {
  const rows = (JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "eform", "encounter-contexts.json"), "utf8")) as { contexts: { appointment_id: string; patient_id: string }[] }).contexts;
  const used = new Set<string>();
  return (actor, patientId) => {
    const row = rows.find((r) => r.patient_id === patientId && !used.has(r.appointment_id));
    if (!row) throw new Error(`Hết ngữ cảnh fixture cho ${patientId}`);
    used.add(row.appointment_id);
    return resolveEncounterContext(actor, row.appointment_id);
  };
}
const newStore = () => demoStore(path.join(parent, `s${++storeCount}`), fixtureOpener());

after(() => fs.rmSync(parent, { recursive: true, force: true }));

const status = (code: number) => (e: unknown) => e instanceof ClinicalError && e.status === code;

test("createDemoPhieu tạo phiếu mới, chưa có phiên, đọc lại từ đĩa", () => {
  const store = newStore(); const root = store.root; const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  assert.ok(p.revision >= 1);
  assert.equal(p.sessions.length, 0);
  assert.equal(p.duyet, null);
  assert.deepEqual(p.sources, {});
  assert.ok(fs.existsSync(path.join(root, "encounters", `${p.encounter_id}.json`)));
  assert.ok(fs.existsSync(path.join(root, "meta", `${p.encounter_id}.json`)));
  assert.deepEqual(readDemoPhieu(store, p.encounter_id), p);
  assert.ok("ly_do" in p.snapshot.fields);
  const q = create("GIA-000123");
  assert.notEqual(q.encounter_id, p.encounter_id);
});

test("saveDoctorEdit ghi ô bác sĩ sửa, revision cũ thì 409, ô lạ thì 400", () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  const edited = saveDoctorEdit(store, p.encounter_id, p.revision, { ly_do: "BS sửa" });
  assert.equal(edited.revision, p.revision + 1);
  assert.equal(edited.snapshot.fields.ly_do.value, "BS sửa");
  assert.deepEqual(edited.sources.ly_do, { nguon: "bac_si", phien: null });
  assert.throws(() => saveDoctorEdit(store, p.encounter_id, p.revision, { ly_do: "khác" }), status(409));
  assert.throws(() => saveDoctorEdit(store, p.encounter_id, edited.revision, { khong_co: "x" }), status(400));
  assert.equal(readDemoPhieu(store, p.encounter_id).revision, edited.revision);
});

test("approveDemoPhieu ghi người duyệt, sửa sau duyệt thì về nháp", () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  const approved = approveDemoPhieu(store, p.encounter_id, p.revision);
  assert.equal(approved.duyet?.boi, getDemoClinicalActor().doctorId);
  assert.ok(approved.duyet && !Number.isNaN(Date.parse(approved.duyet.luc)));
  assert.equal(approved.revision, p.revision + 1);
  assert.throws(() => approveDemoPhieu(store, p.encounter_id, p.revision), status(409));
  const edited = saveDoctorEdit(store, p.encounter_id, approved.revision, { benh_su: "BS ghi bệnh sử" });
  assert.equal(edited.duyet, null);
});

test("resetDemoData xóa dữ liệu chạy, giữ kich-ban/", () => {
  const store = newStore(); const root = store.root; const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  fs.mkdirSync(path.join(root, "kich-ban"), { recursive: true });
  fs.writeFileSync(path.join(root, "kich-ban", "giu.json"), "{}");
  for (const d of ["runs", "transcripts", "audit"]) { fs.mkdirSync(path.join(root, d), { recursive: true }); fs.writeFileSync(path.join(root, d, "x.json"), "{}"); }
  resetDemoData(store);
  assert.deepEqual(fs.readdirSync(root), ["kich-ban"]);
  assert.ok(fs.existsSync(path.join(root, "kich-ban", "giu.json")));
  assert.throws(() => readDemoPhieu(store, p.encounter_id), status(404));
});

const snap = (fields: Record<string, string>): EformSnapshot => ({ fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, { value: v, nguon: v ? "xem" : null }])), chiDinh: [], trangThai: "Đang khám" });
const phieuWith = (sources: DemoPhieu["sources"]) => ({ sources } as DemoPhieu);

test("mergeSession: ô bác sĩ sửa giữ nguyên, AI nói khác thì cờ xung đột; ô khác ghi nguồn AI phiên", () => {
  const before = snap({ ly_do: "BS sửa", benh_su: "cũ", loi_dan: "" });
  const afterSnap = snap({ ly_do: "đau tai", benh_su: "mới", loi_dan: "" });
  const r = mergeSession(phieuWith({ ly_do: { nguon: "bac_si", phien: null }, benh_su: { nguon: "ai", phien: 1 } }), before, afterSnap, 2);
  assert.equal(r.snapshot.fields.ly_do.value, "BS sửa");
  assert.deepEqual(r.sources.ly_do, { nguon: "bac_si", phien: null, xung_dot: { phien: 2, gia_tri_ai: "đau tai" } });
  assert.equal(r.snapshot.fields.benh_su.value, "mới");
  assert.deepEqual(r.sources.benh_su, { nguon: "ai", phien: 2 });
  assert.equal(r.sources.loi_dan, undefined);
});

test("mergeSession: AI không nói (rỗng) hoặc nói giống thì không cờ xung đột, nguồn giữ nguyên", () => {
  const src = { ly_do: { nguon: "bac_si" as const, phien: null }, benh_su: { nguon: "ai" as const, phien: 1 } };
  const r = mergeSession(phieuWith(src), snap({ ly_do: "BS sửa", benh_su: "cũ" }), snap({ ly_do: "", benh_su: "cũ" }), 3);
  assert.equal(r.snapshot.fields.ly_do.value, "BS sửa");
  assert.deepEqual(r.sources.ly_do, { nguon: "bac_si", phien: null });
  assert.deepEqual(r.sources.benh_su, { nguon: "ai", phien: 1 });
  const same = mergeSession(phieuWith(src), snap({ ly_do: "BS sửa" }), snap({ ly_do: "BS sửa" }), 3);
  assert.equal(same.sources.ly_do.xung_dot, undefined);
});
