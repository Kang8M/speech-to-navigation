import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { emptyDefinition } from "@/shared/clinical/schema";
import type { RecordingSession } from "@/shared/clinical/types";
import { getDemoClinicalActor, resolveEncounterContext } from "./encounter-context";
import { openEncounter } from "./service";
import { ClinicalError, ClinicalRepository } from "./repository";
import { PrivacyTickets } from "./privacy";
import { prepareRecordingPrivacy, approveRecordingPrivacy, requireRecordingContext } from "./bound-privacy";

function setup() {
  const store = new ClinicalRepository(fs.mkdtempSync(path.join(os.tmpdir(), "bound-privacy-")));
  const actor = getDemoClinicalActor();
  const opened = openEncounter(resolveEncounterContext(actor, "000123"), store);
  const session = emptyDefinition<RecordingSession>("recordingSession");
  Object.assign(session, { id: randomUUID(), encounter_id: opened.record.id, device_id: "test-device", generation: 1, sequence: 1,
    started_at: "2026-11-14T01:00:00Z", ended_at: "2026-11-14T01:00:01Z", state: "stopped", content_state: "awaiting_review", content_revision: 1 });
  store.update(opened.record.id, opened.record.revision, record => { record.recording_sessions.push(session); return record; }, actor.doctorId, "2026-11-14T01:00:01Z");
  return { store, actor, binding: { encounter_id: opened.record.id, recording_session_id: session.id, generation: 1, content_revision: 1 }, tickets: new PrivacyTickets() };
}

test("privacy uses the selected patient's server identifiers and rejects fake ownership", () => {
  const { store, actor, binding, tickets } = setup();
  const preview = prepareRecordingPrivacy(actor, { binding, text: "BN: Trần Văn Mô Phỏng đau họng.", mode: "conversation" }, { store, tickets });
  assert.ok(!preview.preview.includes("Trần Văn Mô Phỏng"));
  assert.deepEqual(preview.binding, binding);
  assert.throws(() => requireRecordingContext({ ...actor, doctorId: "other" }, binding, store), (e: unknown) => e instanceof ClinicalError && e.status === 403);
  assert.throws(() => prepareRecordingPrivacy(actor, { binding: { ...binding, recording_session_id: randomUUID() }, text: "Đau tai", mode: "conversation" }, { store, tickets }));
});

test("server content invalidation rejects an old ticket even though its bearer has not expired", () => {
  const { store, actor, binding, tickets } = setup();
  const request = { binding, text: "BS: Họng đỏ.", mode: "dictation" as const };
  const preview = prepareRecordingPrivacy(actor, request, { store, tickets });
  const accepted = approveRecordingPrivacy(actor, { binding, ticket: preview.ticket, text: preview.preview, consent: true }, { store, tickets });
  assert.equal(accepted.status, "passed");
  const record = store.read(binding.encounter_id);
  store.update(record.id, record.revision, draft => { draft.recording_sessions[0].content_revision++; return draft; }, actor.doctorId, "2026-11-14T01:00:02Z");
  assert.throws(() => approveRecordingPrivacy(actor, { binding, ticket: preview.ticket, text: preview.preview, consent: true }, { store, tickets }),
    (e: unknown) => e instanceof ClinicalError && e.status === 409);
  assert.throws(() => approveRecordingPrivacy(actor, { binding: { ...binding, content_revision: 2 }, ticket: preview.ticket, text: preview.preview, consent: true }, { store, tickets }));
});
