import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import ca from "../../../data/eform/ca-gia.json";
import type { PrivacyPreview, SpeakerMode } from "@/shared/clinical/api";
import type { Transcript } from "@/shared/clinical/types";
import { parseTranscript } from "@/shared/clinical/schema";
import { PRIVACY_POLICY_VERSION, redactTranscript } from "@/shared/clinical/privacy";
import { ClinicalError } from "./repository";

import { hasRestrictedContent } from "@/shared/clinical/data-policy";

export interface PrivacyBinding {
  encounter_id: string;
  recording_session_id: string;
  generation: number;
  content_revision: number;
}

function sameBinding(left: PrivacyBinding | undefined, right: PrivacyBinding | undefined) {
  return left === undefined && right === undefined || Boolean(left && right
    && left.encounter_id === right.encounter_id && left.recording_session_id === right.recording_session_id
    && left.generation === right.generation && left.content_revision === right.content_revision);
}

function checkBinding(entry: Entry, expected: PrivacyBinding | undefined) {
  if (!sameBinding(entry.binding, expected)) throw new ClinicalError("Nội dung thuộc lượt khám hoặc phiên bản khác. Hãy kiểm tra lại.", 409);
}

const TTL_MS = 10 * 60_000;
const syntheticIdentifiers = [ca.ho_ten, ca.dang_nhap, ca.pid, ca.ma_luot_kham, ca.bac_si_kham, ca.bac_si_chinh,
  ...ca.lich_su.tien_su_ban_than.map(item => item.bac_si), ...ca.lich_su.di_ung.map(item => item.nguoi)];

type Entry = {
  preview: string;
  mode: SpeakerMode;
  status: "pending" | "passed";
  expires: number;
  changes: number;
  transcriptId: string;
  requestId: string;
  revision: number;
  processedAt: string | null;
  consentAt: string | null;
  binding?: PrivacyBinding;
};

/** Process-local, bounded bearer tickets. Only redacted text is retained; no disk or cloud I/O. */
export class PrivacyTickets {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now = Date.now, private readonly capacity = 100) {
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) throw new Error("Giới hạn bộ nhớ không hợp lệ.");
  }

  private checkText(text: string) {
    if (typeof text !== "string" || !text.trim() || text.length > 50_000) throw new ClinicalError("Nội dung kiểm tra không hợp lệ.", 400);
  }

  private read(ticket: string) {
    const entry = this.entries.get(ticket);
    if (!entry || entry.expires <= this.now()) {
      this.entries.delete(ticket);
      throw new ClinicalError("Phiên kiểm tra không hợp lệ hoặc đã hết hạn. Hãy kiểm tra lại nội dung.", 400);
    }
    return entry;
  }

  private view(ticket: string, entry: Entry): PrivacyPreview {
    return { ticket, preview: entry.preview, status: entry.status, expires_at: new Date(entry.expires).toISOString(), changes: entry.changes };
  }

  private add(entry: Entry): PrivacyPreview {
    for (const [key, item] of this.entries) if (item.expires <= this.now()) this.entries.delete(key);
    while (this.entries.size >= this.capacity) this.entries.delete(this.entries.keys().next().value!);
    const ticket = randomBytes(32).toString("base64url");
    this.entries.set(ticket, entry);
    return this.view(ticket, entry);
  }

  prepare(text: string, mode: SpeakerMode, knownIdentifiers: string[] = syntheticIdentifiers, binding?: PrivacyBinding): PrivacyPreview {
    this.checkText(text);
    if (mode !== "conversation" && mode !== "dictation") throw new ClinicalError("Chế độ người nói không hợp lệ.", 400);
    if (hasRestrictedContent(text)) throw new ClinicalError("Dữ liệu cấp 3 không được đưa vào AI.", 403);
    const sanitized = redactTranscript(text, knownIdentifiers);
    this.checkText(sanitized.text);
    return this.add({ preview: sanitized.text, mode, status: "pending", expires: this.now() + TTL_MS,
      changes: sanitized.changes, transcriptId: randomUUID(), requestId: randomUUID(), revision: 1, processedAt: null, consentAt: null,
      ...(binding ? { binding: structuredClone(binding) } : {}) });
  }

  approve(ticket: string, reviewedText: string, knownIdentifiers: string[] = syntheticIdentifiers, consent = false, binding?: PrivacyBinding): PrivacyPreview {
    const entry = this.read(ticket);
    checkBinding(entry, binding);
    this.checkText(reviewedText);
    if (hasRestrictedContent(reviewedText)) {
      entry.status = "pending"; entry.consentAt = null;
      throw new ClinicalError("Dữ liệu cấp 3 không được đưa vào AI.", 403);
    }
    if (consent !== true) {
      entry.status = "pending"; entry.consentAt = null;
      throw new ClinicalError("Cần sự đồng ý xử lý dữ liệu cấp 2 trong nội bộ.", 403);
    }
    const sanitized = redactTranscript(reviewedText, knownIdentifiers);
    this.checkText(sanitized.text);
    const changed = sanitized.text !== entry.preview;
    if (sanitized.changes > 0) {
      // A fresh redaction has not yet been seen by the reviewer. Revoke the old bearer.
      this.entries.delete(ticket);
      return this.add({ ...entry, preview: sanitized.text, status: "pending", processedAt: null, consentAt: null,
        changes: sanitized.changes, revision: entry.revision + 1 });
    }
    const needsApprovalTime = entry.status !== "passed" || changed;
    entry.preview = sanitized.text;
    entry.status = "passed";
    if (changed || !entry.consentAt) entry.consentAt = new Date(this.now()).toISOString();
    entry.changes = 0;
    if (changed) { entry.revision++; entry.requestId = randomUUID(); }
    if (needsApprovalTime) entry.processedAt = new Date(this.now()).toISOString();
    return this.view(ticket, entry);
  }

  approved(ticket: string, binding?: PrivacyBinding): Transcript {
    const entry = this.read(ticket);
    checkBinding(entry, binding);
    if (entry.status !== "passed" || !entry.consentAt) throw new ClinicalError("Cần kiểm tra thủ công và xác nhận nội dung trước khi dùng AI.", 400);
    if (hasRestrictedContent(entry.preview)) throw new ClinicalError("Dữ liệu cấp 3 không được đưa vào AI.", 403);
    // Labels are trusted only after manual review. Unlabelled conversation never implies a doctor.
    const chunks = entry.preview.split(/\n+|(?<=[.!?])\s+(?=(?:BS|BN)\s*[:：])/iu).map(text => text.trim()).filter(Boolean);
    const segments = chunks.map((text, index): Transcript["segments"][number] => {
      const label = /^(BS|BN)\s*[:：]\s*/iu.exec(text);
      const role = label ? (label[1].toUpperCase() === "BS" ? "bac_si" : "benh_nhan") : entry.mode === "dictation" ? "bac_si" : "chua_ro";
      return { id: `${entry.transcriptId}-segment-${index + 1}`, sequence: index, utterance_ref: null, speaker_id: null,
        vai_tro: role, nguon_vai_tro: role === "chua_ro" ? "chua_ro" : "bac_si_gan", start_ms: null, end_ms: null,
        text: text.slice(label?.[0].length ?? 0).trim(), is_final: true };
    }).filter(item => item.text.length > 0);
    return parseTranscript({ schema_version: "1.1.0", request_id: entry.requestId, transcript_id: entry.transcriptId,
      revision: entry.revision, language: "vi", privacy: { trang_thai: "passed", policy_version: PRIVACY_POLICY_VERSION, processed_at: entry.processedAt },
      context: { tuoi_thang: null, gioi_tinh: null, can_nang_kg: null }, segments,
      ...(entry.binding ? { binding: entry.binding } : {}) });
  }

  /** The digest is computed from the reviewed transcript, never accepted from a client. */
  reviewed(ticket: string, binding: PrivacyBinding): { transcript: Transcript; digest: string } {
    const transcript = this.approved(ticket, binding);
    const digest = createHash("sha256").update(JSON.stringify(transcript)).digest("hex");
    return { transcript, digest };
  }
}

const state = globalThis as typeof globalThis & { clinicalPrivacyTickets?: PrivacyTickets };
export const privacyTickets = state.clinicalPrivacyTickets ??= new PrivacyTickets();
