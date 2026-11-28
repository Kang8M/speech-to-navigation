import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

test("1.1 migration preserves legacy approval and identity without inventing recordings", async () => {
  assert.ok(fs.existsSync("src/server/clinical/migrations.ts"), "pure encounter migration must exist");
  const { migrateEncounter } = await import("./migrations");
  const legacy = JSON.parse(fs.readFileSync("docs/task-2/examples/encounter.example.json", "utf8"));
  legacy.schema_version = "1.1.0";
  delete legacy.don_thuoc;
  delete legacy.recording_sessions;
  delete legacy.approval_versions;
  delete legacy.change_decisions;
  legacy.audit.approved_by = "doctor-legacy";
  legacy.audit.approved_at = "2026-11-12T12:00:00+07:00";
  const before = structuredClone(legacy);
  const migrated = migrateEncounter(legacy);
  assert.equal(migrated.schema_version, "1.3.0");
  assert.deepEqual(migrated.don_thuoc, { de_cap: "chua_de_cap", items: [] });
  for (const key of ["id", "patient_id", "appointment_id", "phieu_kham", "chi_dinh", "ai_runs", "nguon_du_lieu"]) assert.deepEqual(migrated[key as keyof typeof migrated], legacy[key]);
  assert.deepEqual(migrated.recording_sessions, []);
  assert.equal(migrated.approval_versions.length, 1);
  assert.equal(migrated.approval_versions[0].scope, "legacy");
  assert.deepEqual(migrated.approval_versions[0].snapshot, before);
  assert.equal(migrated.approval_versions[0].approved_by, "doctor-legacy");
  assert.deepEqual(migrateEncounter(migrated), migrated);
  assert.deepEqual(legacy, before, "migration is pure");
});

test("unsupported or malformed records are rejected rather than silently migrated", async () => {
  assert.ok(fs.existsSync("src/server/clinical/migrations.ts"), "pure encounter migration must exist");
  const { migrateEncounter } = await import("./migrations");
  assert.throws(() => migrateEncounter({ schema_version: "0.9.0" }));
  assert.throws(() => migrateEncounter({ schema_version: "1.1.0", audit: {} }));
});

test("repository reads legacy records without rewriting them on disk", async () => {
  const { ClinicalRepository } = await import("./repository");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "clinical-migration-"));
  const id = "d55423b5-1782-4e2f-98fc-3474aec69ace";
  const record = JSON.parse(fs.readFileSync("docs/task-2/examples/encounter.example.json", "utf8"));
  Object.assign(record, { id, schema_version: "1.1.0" });
  delete record.don_thuoc;
  delete record.recording_sessions;
  delete record.approval_versions;
  delete record.change_decisions;
  const serialized = JSON.stringify(record);
  const file = path.join(directory, `${id}.json`);
  fs.writeFileSync(file, serialized);
  const result = new ClinicalRepository(directory).read(id);
  assert.equal(result.schema_version, "1.3.0");
  assert.deepEqual(result.approval_versions, []);
  assert.equal(fs.readFileSync(file, "utf8"), serialized);
});

test("1.2 record migrates to 1.3 adding only an empty prescription block, purely and idempotently", async () => {
  const { migrateEncounter } = await import("./migrations");
  const old = JSON.parse(fs.readFileSync("docs/task-2/examples/encounter.example.json", "utf8"));
  old.schema_version = "1.2.0";
  delete old.don_thuoc;
  old.revision = 4;
  const before = structuredClone(old);
  const migrated = migrateEncounter(old);
  assert.equal(migrated.schema_version, "1.3.0");
  assert.deepEqual(migrated.don_thuoc, { de_cap: "chua_de_cap", items: [] });
  const { schema_version: _a, don_thuoc: _b, ...rest } = migrated;
  const { schema_version: _c, ...expected } = before;
  void _a; void _b; void _c;
  assert.deepEqual(rest, expected);
  assert.equal(migrated.revision, 4);
  assert.deepEqual(old, before, "migration is pure");
  assert.deepEqual(migrateEncounter(migrated), migrated);
  for (const version of ["1.4.0", "1.0.0"]) assert.throws(() => migrateEncounter({ ...before, schema_version: version }));
});

test("approved 1.2 record stays approved with its approval versions untouched", async () => {
  const { migrateEncounter } = await import("./migrations");
  const old = JSON.parse(fs.readFileSync("docs/task-2/examples/encounter.example.json", "utf8"));
  old.schema_version = "1.2.0";
  delete old.don_thuoc;
  old.audit.approved_by = "doctor-legacy";
  old.audit.approved_at = "2026-11-12T12:00:00+07:00";
  old.approval_versions = [{ id: "a-1", scope: "legacy", digest: "d", approved_by: "doctor-legacy", approved_at: "2026-11-12T12:00:00+07:00", sources: [], snapshot: { note: "bản cũ không có đơn thuốc" } }];
  const migrated = migrateEncounter(old);
  assert.deepEqual(migrated.approval_versions, old.approval_versions);
  assert.equal(migrated.audit.approved_at, old.audit.approved_at);
});
