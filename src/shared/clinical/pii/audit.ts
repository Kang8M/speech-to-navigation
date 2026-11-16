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
  // Sao chép từng trường, không spread: trường lạ (ví dụ `raw`) không bao giờ lọt vào nhật ký.
  return {
    at: input.now,
    encounter_id: input.encounter_id,
    session_sequence: input.session_sequence,
    policy_version: input.policy_version,
    counts: { ...input.counts },
    gate: input.gate,
    gate_reasons: [...input.gate_reasons],
    ai_route: input.ai_route,
    provider: input.provider,
    model: input.model,
    clean_sha256: input.clean_sha256,
  };
}
