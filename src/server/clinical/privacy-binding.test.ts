import assert from "node:assert/strict";
import { test } from "node:test";
import { PrivacyTickets } from "./privacy";
import { ClinicalError } from "./repository";

const a = { encounter_id: "encounter-a", recording_session_id: "session-a", generation: 1, content_revision: 1 };
const conflict = (error: unknown) => error instanceof ClinicalError && error.status === 409;

test("reviewed tickets remain bound to their encounter, session, generation and content revision", () => {
  const store = new PrivacyTickets();
  const preview = store.prepare("BS: Họng đỏ.", "dictation", [], a);
  store.approve(preview.ticket, preview.preview, [], true, a);
  assert.deepEqual(store.approved(preview.ticket, a).binding, a);
  for (const mismatch of [
    { ...a, encounter_id: "encounter-b" }, { ...a, recording_session_id: "session-b" },
    { ...a, generation: 2 }, { ...a, content_revision: 2 },
  ]) {
    assert.throws(() => store.approved(preview.ticket, mismatch), conflict);
    assert.throws(() => store.approve(preview.ticket, preview.preview, [], true, mismatch), conflict);
  }
  assert.throws(() => store.approved(preview.ticket), conflict);
});

test("legacy tickets cannot be promoted to a bound recording ticket", () => {
  const store = new PrivacyTickets();
  const preview = store.prepare("BS: Họng đỏ.", "dictation");
  store.approve(preview.ticket, preview.preview, [], true);
  assert.throws(() => store.approved(preview.ticket, a), conflict);
});

test("binding is copied, redaction rotation retains it and digest comes from reviewed text", () => {
  const store = new PrivacyTickets();
  const binding = { ...a };
  const preview = store.prepare("BS: Họng đỏ.", "dictation", ["Nguyễn Văn Mẫu"], binding);
  binding.encounter_id = "tampered";
  const rotated = store.approve(preview.ticket, "BS: Họng đỏ. Nguyễn Văn Mẫu", ["Nguyễn Văn Mẫu"], true, a);
  assert.equal(rotated.status, "pending");
  assert.throws(() => store.approved(preview.ticket, a));
  store.approve(rotated.ticket, rotated.preview, [], true, a);
  const first = store.reviewed(rotated.ticket, a);
  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(first.transcript.binding, a);
  assert.equal(store.reviewed(rotated.ticket, a).digest, first.digest);
  first.transcript.segments[0].text = "tampered";
  assert.notEqual(store.reviewed(rotated.ticket, a).transcript.segments[0].text, "tampered");
});

test("binding is rechecked before revealing ticket content, including after expiration", () => {
  let time = 1_000;
  const store = new PrivacyTickets(() => time);
  const preview = store.prepare("BS: Họng đỏ.", "dictation", [], a);
  store.approve(preview.ticket, preview.preview, [], true, a);
  time += 600_000;
  assert.throws(() => store.reviewed(preview.ticket, a), /hết hạn/);
});
