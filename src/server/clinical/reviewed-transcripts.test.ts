import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PrivacyTickets } from "./privacy";
import { createRecordingTicketValidator, readReviewedTranscript } from "./reviewed-transcripts";

test("reviewed transcript persists without extraction and retry does not overwrite its artifact", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reviewed-transcript-"));
  const tickets = new PrivacyTickets();
  const binding = { encounter_id: "enc-a", recording_session_id: "session-a", generation: 1, content_revision: 1 };
  const preview = tickets.prepare("BS: Khám họng đỏ.", "dictation", [], binding);
  const validator = createRecordingTicketValidator(tickets, directory);
  assert.throws(() => validator.validate(preview.ticket, binding));
  assert.equal(fs.readdirSync(directory).length, 0);
  tickets.approve(preview.ticket, preview.preview, [], true, binding);
  const receipt = validator.validate(preview.ticket, binding);
  assert.equal(receipt.binding.encounter_id, "enc-a");
  assert.deepEqual(validator.validate(preview.ticket, binding), receipt);
  const transcript = readReviewedTranscript(receipt.artifact_id, binding, directory);
  assert.equal(transcript.segments[0].text, "Khám họng đỏ.");
  assert.throws(() => readReviewedTranscript(receipt.artifact_id, { ...binding, encounter_id: "enc-b" }, directory));
  assert.throws(() => readReviewedTranscript("../../escape", binding, directory));
  assert.equal(fs.readdirSync(directory).length, 1);
});

test("tampered reviewed artifact cannot be read or silently overwritten", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "reviewed-integrity-"));
  const tickets = new PrivacyTickets();
  const binding = { encounter_id: "enc-a", recording_session_id: "session-a", generation: 1, content_revision: 1 };
  const preview = tickets.prepare("BS: Họng đỏ.", "dictation", [], binding);
  tickets.approve(preview.ticket, preview.preview, [], true, binding);
  const validator = createRecordingTicketValidator(tickets, directory);
  const receipt = validator.validate(preview.ticket, binding);
  const file = path.join(directory, `${receipt.artifact_id}.json`);
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.transcript.segments[0].text = "changed";
  fs.writeFileSync(file, JSON.stringify(data));
  assert.throws(() => readReviewedTranscript(receipt.artifact_id, binding, directory));
  assert.throws(() => validator.validate(preview.ticket, binding));
});
