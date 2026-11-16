import type { AiRoute, GateReason, GateResult } from "./gate";
import type { PII_POLICY_VERSION, PiiRule } from "./types";

/** R13: nhật ký mỗi lượt gửi AI. Không chứa bản thô hay bản sạch, chỉ số đếm và dấu băm. */
export interface PiiAuditEntry {
  at: string;
  encounter_id: string;
  session_sequence: number;
  policy_version: typeof PII_POLICY_VERSION;
  counts: Record<PiiRule, number>;
  gate: GateResult["passed"];
  gate_reasons: GateReason[];
  ai_route: AiRoute;
  provider: string;
  model: string;
  /** Máy chủ băm sẵn bản sạch (node:crypto), module này không băm. */
  clean_sha256: string;
}

export function buildAuditEntry(input: Omit<PiiAuditEntry, "at"> & { now: string }): PiiAuditEntry {
  const { now, ...rest } = input;
  return { at: now, ...rest, counts: { ...rest.counts }, gate_reasons: [...rest.gate_reasons] };
}
