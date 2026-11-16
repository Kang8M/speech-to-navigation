import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import {
  aiRouteFor, buildAuditEntry, checkResidualPii, PII_POLICY_VERSION, redactPii,
  type PiiAuditEntry, type PiiRule, type PiiSpan,
} from "@/shared/clinical/pii";
import { applyAiDraft } from "@/shared/clinical/apply-ai";
import { projectEform } from "@/shared/clinical/eform";
import { parseTranscript } from "@/shared/clinical/schema";
import type { ClinicalExtraction } from "@/shared/clinical/api";
import type { RecordingSession, Transcript } from "@/shared/clinical/types";
import type { DemoEvent, DemoPhieu, DemoSource, KichBan } from "@/shared/demo-luong/types";
import { extractClinical } from "@/server/clinical/extraction";
import { ClinicalError } from "@/server/clinical/repository";
import { getDemoClinicalActor } from "@/server/clinical/encounter-context";
import { demoAllowlist, doanForPhien, loadKichBan } from "./kich-ban";
import { knownIdentifiersFor } from "./known-identifiers";
import { mergeSession } from "./merge";
import {
  applyDoctorFields, auditFile, demoCatalog, encounterFile, fileSha256, readDemoPhieu, readSidecar, writeSidecar,
  type DemoStore,
} from "./store";

export interface DemoFlowInput {
  encounterId: string;
  source: DemoSource;
  audio?: Uint8Array;
  transcribe?: (wav: Uint8Array) => Promise<{ text: string; engine: string; audio_ms: number | null }>;
}

type Doan = Pick<KichBan["doan"][number], "vai_tro" | "text">;
const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const NOT_CALLED = "khong_goi";

function appendAudit(store: DemoStore, encounterId: string, entry: PiiAuditEntry) {
  const file = auditFile(store, encounterId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf8");
}

/** Che từng đoạn riêng, cộng dồn vị trí span theo bản thô ghép bằng "\n". */
function redactParts(parts: Doan[], known: ReturnType<typeof knownIdentifiersFor>["known"]) {
  const spans: PiiSpan[] = [];
  const counts = {} as Record<PiiRule, number>;
  const clean: string[] = [];
  let offset = 0;
  for (const part of parts) {
    const r = redactPii(part.text, known);
    for (const span of r.spans) spans.push({ ...span, start: span.start + offset, end: span.end + offset });
    for (const [rule, n] of Object.entries(r.counts) as [PiiRule, number][]) counts[rule] = (counts[rule] ?? 0) + n;
    clean.push(r.clean);
    offset += part.text.length + 1;
  }
  return { raw: parts.map(p => p.text).join("\n"), clean, spans, counts };
}

/**
 * Luồng 5 bước của /demo-luong: stt → ban_tho → che (+ chốt chặn) → ai (mock) → luu (phiên ghi âm mới).
 * Bản thô chỉ đi trong sự kiện phát ra, không bao giờ ghi file. Bị chặn: phát `che/bi_chan`, ghi nhật ký `gate:false`, dừng.
 */
export async function* runDemoFlow(store: DemoStore, input: DemoFlowInput, now: () => number = Date.now): AsyncGenerator<DemoEvent> {
  const iso = () => new Date(now()).toISOString();
  const record = store.repo.read(input.encounterId);
  const startedAt = iso();

  // 1. STT (kịch bản: chữ có sẵn; audio: gọi STT, không lưu audio).
  let t = now();
  let parts: Doan[];
  let mode: "conversation" | "dictation";
  let stt: { engine: string; audio_ms: number | null };
  let consentOverride: boolean | undefined;
  if (input.source.kind === "kich_ban") {
    const kb = loadKichBan(input.source.id);
    if (kb.benh_nhan_id !== record.patient_id) throw new ClinicalError("Kịch bản thuộc bệnh nhân khác với phiếu đang mở.", 409);
    parts = doanForPhien(kb, input.source.phien).map(d => ({ vai_tro: d.vai_tro, text: d.text }));
    if (!parts.length) throw new ClinicalError("Kịch bản không có phiên này.", 404);
    mode = kb.mode;
    stt = { engine: "kich-ban", audio_ms: null };
    consentOverride = kb.dong_y_override;
  } else {
    if (!input.audio?.length || !input.transcribe) throw new ClinicalError("Thiếu âm thanh hoặc bộ nhận dạng giọng nói.", 400);
    const result = await input.transcribe(input.audio);
    const text = result.text.trim();
    if (!text) throw new ClinicalError("Không nhận được lời nói trong âm thanh.", 422);
    parts = [{ vai_tro: "bac_si", text }];
    mode = "dictation";
    stt = { engine: result.engine, audio_ms: result.audio_ms };
  }
  yield { buoc: "stt", trang_thai: "xong", ms: now() - t, du_lieu: { ...stt, text: parts.map(p => p.text).join("\n") } };

  // 2. Bản thô + vị trí đoạn nhạy cảm (chỉ trong stream).
  t = now();
  const { known, consent } = knownIdentifiersFor(record.patient_id);
  const red = redactParts(parts, known);
  yield { buoc: "ban_tho", trang_thai: "xong", ms: now() - t, du_lieu: { raw: red.raw, spans: red.spans, mode } };

  // 3. Che + chốt chặn R11 + đồng ý R14.
  t = now();
  const clean = red.clean.join("\n");
  const gate = checkResidualPii(clean, known, demoAllowlist());
  const dong_y = { trang_thai: consentOverride ?? consent.trang_thai, luc: consent.luc };
  const ai_route = aiRouteFor(dong_y.trang_thai);
  const sequence = Math.max(0, ...record.recording_sessions.map(s => s.sequence)) + 1;
  const cleanDigest = sha256(clean);
  const audit = (provider: string, model: string) => buildAuditEntry({
    now: iso(), encounter_id: record.id, session_sequence: sequence, policy_version: PII_POLICY_VERSION, counts: red.counts,
    gate: gate.passed, gate_reasons: gate.reasons.map(r => r.reason), ai_route, provider, model, clean_sha256: cleanDigest,
  });
  if (!gate.passed) {
    // `excerpt` có thể chứa PII còn sót: chỉ gửi về màn hình, nhật ký chỉ giữ mã lý do.
    // Ghi nhật ký trước khi phát: người đọc stream dừng sớm cũng không làm mất dòng nhật ký.
    appendAudit(store, record.id, audit(NOT_CALLED, NOT_CALLED));
    yield { buoc: "che", trang_thai: "bi_chan", ms: now() - t, du_lieu: { clean, counts: red.counts, gate, ai_route, dong_y } };
    return;
  }
  yield { buoc: "che", trang_thai: "xong", ms: now() - t, du_lieu: { clean, counts: red.counts, gate, ai_route, dong_y } };

  // 4. AI (mock) trên bản sạch.
  t = now();
  const sessionId = randomUUID();
  const binding = { encounter_id: record.id, recording_session_id: sessionId, generation: 1, content_revision: 1 };
  const transcript: Transcript = parseTranscript({
    schema_version: "1.1.0", request_id: randomUUID(), transcript_id: randomUUID(), revision: 1, language: "vi",
    privacy: { trang_thai: "passed", policy_version: PII_POLICY_VERSION, processed_at: iso() },
    context: { tuoi_thang: null, gioi_tinh: null, can_nang_kg: null },
    segments: parts.map((p, i) => ({
      id: `s${i + 1}`, sequence: i + 1, utterance_ref: null, speaker_id: null, vai_tro: mode === "dictation" ? "bac_si" : p.vai_tro,
      nguon_vai_tro: "he_thong", start_ms: null, end_ms: null, text: red.clean[i], is_final: true,
    })),
    binding,
  });
  const payload_preview = JSON.stringify(transcript.segments, null, 2);
  let run: ClinicalExtraction;
  try {
    run = await extractClinical("demo", {
      approvedTranscript: () => transcript, binding, directory: store.root, noCache: true, provider: "mock",
      deidentification: { policy_version: PII_POLICY_VERSION, gate_passed: true, consent: dong_y.trang_thai },
    });
  } catch (error) {
    yield { buoc: "ai", trang_thai: "loi", ms: now() - t, du_lieu: { provider: "mock", model: "", prompt_version: "", payload_preview, loi: error instanceof Error ? error.message : "AI lỗi." } };
    return;
  }
  yield { buoc: "ai", trang_thai: "xong", ms: now() - t, du_lieu: { provider: run.provider, model: run.model, prompt_version: run.prompt_version, payload_preview, extraction: run } };

  // 5. Lưu: ghép vào phiếu thành phiên ghi âm mới, rồi đọc lại từ kho.
  t = now();
  const entry = audit(run.provider, run.model);
  const file = encounterFile(store, record.id);
  const relative = path.relative(process.cwd(), file).split(path.sep).join("/");
  const fallback: DemoPhieu = readDemoPhieu(store, record.id);
  try {
    const actor = getDemoClinicalActor();
    const savedAt = iso();
    const before = fallback;
    let merged: Pick<DemoPhieu, "snapshot" | "sources"> | undefined;
    store.repo.update(record.id, record.revision, current => {
      const session: RecordingSession = {
        id: sessionId, encounter_id: current.id, sequence, device_id: "demo-luong", generation: 1, started_at: startedAt, ended_at: savedAt,
        state: "stopped", stop_reason: null, content_state: "reviewed", content_revision: 1, reviewed_content_revision: 1, reviewed_digest: cleanDigest,
        reviewed_transcripts: [{ content_revision: 1, digest: cleanDigest, transcript_id: transcript.transcript_id, transcript_revision: transcript.revision, artifact_id: `${run.run_id}.json`, reviewed_at: savedAt, reviewed_by: PII_POLICY_VERSION }],
        requests: [], discarded_at: null, discarded_by: null,
      };
      const drafted = applyAiDraft(current, run, { newId: randomUUID, now: savedAt, services: demoCatalog().services });
      drafted.recording_sessions.push(session);
      const beforeSnap = projectEform(current), afterSnap = projectEform(drafted);
      merged = mergeSession(before, beforeSnap, afterSnap, sequence);
      // Ô bác sĩ đã sửa không bao giờ bị AI ghi đè: đặt lại giá trị bác sĩ ngay trong hồ sơ.
      const restore = Object.fromEntries(Object.entries(merged.snapshot.fields)
        .filter(([key, field]) => merged!.sources[key]?.nguon === "bac_si" && field.value !== afterSnap.fields[key]?.value)
        .map(([key, field]) => [key, field.value]));
      return Object.keys(restore).length ? applyDoctorFields(drafted, restore, savedAt) : drafted;
    }, actor.doctorId, savedAt);
    const meta = readSidecar(store, record.id);
    writeSidecar(store, record.id, {
      sources: merged!.sources,
      sessions: [...meta.sessions, { sequence, at: savedAt, counts: red.counts, clean }],
      duyet: null,
    });
    appendAudit(store, record.id, entry);
    yield { buoc: "luu", trang_thai: "xong", ms: now() - t, du_lieu: { phieu: readDemoPhieu(store, record.id), file: relative, sha256: fileSha256(file), audit: entry } };
  } catch (error) {
    // Nhánh lỗi không được ném tiếp: đọc lại phiếu/băm file có thể lỗi theo, khi đó trả bản đọc trước đó.
    let phieu = fallback, sha = "";
    try { phieu = readDemoPhieu(store, record.id); } catch { /* giữ bản đọc trước khi lưu */ }
    try { sha = fileSha256(file); } catch { /* file hồ sơ không đọc được */ }
    yield { buoc: "luu", trang_thai: "loi", ms: now() - t, du_lieu: { phieu, file: relative, sha256: sha, audit: entry, loi: error instanceof Error ? error.message : "Không lưu được phiếu." } };
  }
}
