import type { AiOutput, Encounter, Transcript } from "./types";
import type { EformData } from "../eform/types";
import type { ClinicalChangeSet } from "./changes";
import type { TranscriptBinding } from "./recording";
import type { EformSnapshot } from "./eform";

export type { TranscriptBinding } from "./recording";
export type { StartRecordingRequest, HeartbeatRecordingRequest, FinalizeRecordingRequest, UpdateRecordingContentRequest } from "./recording";
export type { ApproveClinicalRequest, TransitionClinicalRequest } from "./approvals";
export type { DecideClinicalChangesRequest } from "./changes";
export interface ClinicalActor { doctorId: string; facilityId: string }
export interface EncounterContext { appointmentId: string; patientId: string; facilityId: string; doctorId: string; data: EformData }
export interface EncounterSummary { id: string; appointment_id: string | null; patient_id: string; patient_name: string; facility_id: string; status: Encounter["status"]; revision: number; updated_at: string }
export interface ClinicalRecordResponse { record: Encounter; snapshot: EformSnapshot; latest_ai?: ClinicalExtraction | null; data: EformData; context: EncounterContext; change_sets?: ClinicalChangeSet[] }
export type ClinicalResponse = ClinicalRecordResponse;
export interface RecordingResponse extends ClinicalRecordResponse { recording_session_id: string; replayed: boolean }
export interface OpenEncounterRequest { appointment_id: string }
export interface PrivacyReviewRequest { text: string; mode: SpeakerMode; binding: TranscriptBinding }

export type SpeakerMode = "conversation" | "dictation";
export interface PrivacyPreview {
  ticket: string;
  preview: string;
  status: "pending" | "passed";
  expires_at: string;
  changes: number;
  binding?: TranscriptBinding;
  digest?: string;
}

export interface ClinicalExtraction {
  run_id: string;
  draft: AiOutput;
  transcript: Transcript;
  provider: string;
  model: string;
  prompt_version: string;
  created_at: string;
  input_digest: string;
  duration_ms: number;
  /** Absent only on legacy immutable runs. */
  binding?: TranscriptBinding;
}
