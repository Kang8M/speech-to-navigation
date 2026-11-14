import "server-only";
import { z } from "zod";
import type { ClinicalActor, PrivacyPreview, TranscriptBinding } from "@/shared/clinical/api";
import { ClinicalError, ClinicalRepository } from "./repository";
import { resolveEncounterContextForRecord } from "./encounter-context";
import { PrivacyTickets, privacyTickets } from "./privacy";

export const recordingBindingSchema = z.object({ encounter_id: z.uuid(), recording_session_id: z.uuid(),
  generation: z.number().int().positive(), content_revision: z.number().int().positive() }).strict();
const textSchema = z.string().trim().min(1).max(50_000);
const prepareSchema = z.object({ binding: recordingBindingSchema, text: textSchema, mode: z.enum(["conversation", "dictation"]) }).strict();
const approveSchema = z.object({ binding: recordingBindingSchema, ticket: z.string().min(1).max(128), text: textSchema, consent: z.literal(true) }).strict();
const repository = new ClinicalRepository();
interface Options { store?: ClinicalRepository; tickets?: PrivacyTickets }

/** Recheck server-owned identity and current text revision before every ticket operation. */
export function requireRecordingContext(actor: ClinicalActor, value: TranscriptBinding, store = repository) {
  const binding = recordingBindingSchema.parse(value);
  const record = store.read(binding.encounter_id);
  const context = resolveEncounterContextForRecord(actor, record);
  const session = record.recording_sessions.find(item => item.id === binding.recording_session_id);
  if (!session || session.generation !== binding.generation || session.content_revision !== binding.content_revision) {
    throw new ClinicalError("Phiên hoặc phiên bản nội dung đã thay đổi. Hãy kiểm tra lại lời nói.", 409);
  }
  if (!["dang_kham", "cho_kq_cls"].includes(record.status)) throw new ClinicalError("Lượt khám đã kết thúc, không nhận nội dung mới.", 409);
  if (session.content_state === "discarded") throw new ClinicalError("Nội dung đã được bỏ. Hãy mở phiên bản nội dung mới trước khi kiểm tra.", 409);
  const ca = context.data.ca;
  const identifiers = [ca.ho_ten, ca.pid, ca.ma_luot_kham, ca.dang_nhap, ca.bac_si_kham, ca.bac_si_chinh,
    ...ca.lich_su.tien_su_ban_than.map(item => item.bac_si), ...ca.lich_su.di_ung.map(item => item.nguoi)];
  return { binding, record, session, context, identifiers };
}

export function prepareRecordingPrivacy(actor: ClinicalActor, value: unknown, options: Options = {}): PrivacyPreview {
  const request = prepareSchema.parse(value);
  const source = requireRecordingContext(actor, request.binding, options.store);
  const result = (options.tickets ?? privacyTickets).prepare(request.text, request.mode, source.identifiers, source.binding);
  return { ...result, binding: source.binding };
}

export function approveRecordingPrivacy(actor: ClinicalActor, value: unknown, options: Options = {}): PrivacyPreview {
  const request = approveSchema.parse(value);
  const source = requireRecordingContext(actor, request.binding, options.store);
  const tickets = options.tickets ?? privacyTickets;
  const result = tickets.approve(request.ticket, request.text, source.identifiers, request.consent, source.binding);
  return { ...result, binding: source.binding, ...(result.status === "passed" ? { digest: tickets.reviewed(result.ticket, source.binding).digest } : {}) };
}
