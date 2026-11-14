import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import { getDemoClinicalActor, resolveEncounterContext, listEncounterContexts, validateEncounterContexts } from "./encounter-context";
import { loadEformData } from "@/server/du-lieu/eform";
import { ClinicalError } from "./repository";

test("server contexts replace complete patient data and preserve leading zero appointment", () => {
  const actor = getDemoClinicalActor();
  const a = resolveEncounterContext(actor, "LK-GIA-0456");
  const b = resolveEncounterContext(actor, "000123");
  assert.equal(b.appointmentId, "000123");
  assert.equal(b.patientId, "GIA-000456");
  assert.equal(b.data.ca.ho_ten, "Trần Văn Mô Phỏng");
  assert.equal(b.data.ca.gioi_tinh, "Nam");
  assert.equal(b.data.ca.canh_bao_di_ung, "");
  assert.deepEqual(b.data.ca.lich_su, { tien_su_ban_than: [], tien_su_gia_dinh: [], benh_su: [], di_ung: [] });
  assert.deepEqual(b.data.ca.xet_nghiem, []);
  assert.deepEqual(b.data.ca.chan_doan_hinh_anh, []);
  assert.deepEqual(b.data.ca.can_lam_sang, []);
  assert.notDeepEqual(b.data.ca.sinh_hieu, a.data.ca.sinh_hieu);
  assert.match(b.data.ca.gia_tri.ly_do, /họng/);
  assert.equal(b.data.ca.gia_tri.di_ung_mo_ta, undefined);
  assert.equal(resolveEncounterContext(actor, "LK-GIA-0457").data.ca.gia_tri.benh_su, undefined);
  b.data.ca.ho_ten = "changed";
  assert.equal(resolveEncounterContext(actor, "000123").data.ca.ho_ten, "Trần Văn Mô Phỏng");
  assert.deepEqual(loadEformData().ca, a.data.ca);
  assert.equal(listEncounterContexts(actor).length, 3);
});

test("context authorization uses server doctor and facility, never patient identifiers", () => {
  const status = (expected: number) => (error: unknown) => error instanceof ClinicalError && error.status === expected;
  assert.throws(() => resolveEncounterContext({ doctorId: "other", facilityId: "facility-prototype" }, "000123"), status(403));
  assert.throws(() => resolveEncounterContext({ doctorId: "user_bs01", facilityId: "other" }, "000123"), status(403));
  assert.throws(() => resolveEncounterContext(getDemoClinicalActor(), "123"), status(404));
  assert.deepEqual(listEncounterContexts({ doctorId: "other", facilityId: "facility-prototype" }), []);
});

test("fixture validation rejects identity corruption, duplicate appointments and inconsistent patient demographics", () => {
  const fixture = () => JSON.parse(fs.readFileSync("data/eform/encounter-contexts.json", "utf8"));
  const corrupt = fixture(); corrupt.contexts[1].ca.pid = "GIA-000123";
  assert.throws(() => validateEncounterContexts(corrupt));
  const duplicate = fixture(); duplicate.contexts.push(structuredClone(duplicate.contexts[0]));
  assert.throws(() => validateEncounterContexts(duplicate));
  const age = fixture(); age.contexts[0].age_months = 0;
  assert.throws(() => validateEncounterContexts(age));
  const identity = fixture(); identity.contexts[2].ca.ho_ten = "Another name";
  assert.throws(() => validateEncounterContexts(identity));
  const otherFacility = fixture(); const other = structuredClone(otherFacility.contexts[0]); other.facility_id = "second";
  otherFacility.contexts.push(other);
  assert.doesNotThrow(() => validateEncounterContexts(otherFacility));
});
