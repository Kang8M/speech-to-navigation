import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { foldVietnamese } from "@/shared/clinical/pii";
import type { DemoEvent, DemoSource } from "@/shared/demo-luong/types";
import { ClinicalError } from "@/server/clinical/repository";
import { loadKichBan } from "./kich-ban";
import { approveDemoPhieu, createDemoPhieu, demoStore, readDemoPhieu, saveDoctorEdit, type DemoStore } from "./store";
import { runDemoFlow, type DemoFlowInput } from "./flow";

const parent = fs.mkdtempSync(path.join(os.tmpdir(), "demo-luong-flow-"));
let storeCount = 0;
const newStore = () => demoStore(path.join(parent, `s${++storeCount}`));

after(() => fs.rmSync(parent, { recursive: true, force: true }));

async function run(store: DemoStore, input: DemoFlowInput): Promise<DemoEvent[]> {
  const out: DemoEvent[] = [];
  for await (const e of runDemoFlow(store, input)) out.push(e);
  return out;
}
const kb = (id: string, phien?: number): DemoSource => ({ kind: "kich_ban", id, ...(phien ? { phien } : {}) });
const pick = <B extends DemoEvent["buoc"]>(events: DemoEvent[], buoc: B) => events.find((e) => e.buoc === buoc) as Exclude<Extract<DemoEvent, { buoc: B }>, { buoc: "stt"; trang_thai: "loi" }>;

test("ca chuẩn phiên 1: đủ 5 bước, lưu một phiên, nhật ký một dòng", async () => {
  const store = newStore(); const root = store.root; const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  const events = await run(store, { encounterId: p.encounter_id, source: kb("ca-chuan", 1) });
  assert.deepEqual(events.map((e) => e.buoc), ["stt", "ban_tho", "che", "ai", "luu"]);
  assert.ok(events.every((e) => e.trang_thai === "xong"), JSON.stringify(events.map((e) => [e.buoc, e.trang_thai, "loi" in e.du_lieu ? e.du_lieu.loi : null])));
  assert.equal(pick(events, "stt").du_lieu.engine, "kich-ban");
  assert.equal(pick(events, "ban_tho").du_lieu.mode, "conversation");
  const che = pick(events, "che");
  assert.equal(che.trang_thai, "xong");
  assert.equal(che.du_lieu.ai_route, "external_allowed");
  assert.match(che.du_lieu.clean, /\[BỆNH_NHÂN\]/);
  const ai = pick(events, "ai");
  assert.equal(ai.du_lieu.provider, "mock");
  assert.ok(ai.du_lieu.extraction);
  assert.equal(ai.du_lieu.payload_preview.includes("nguyễn thị giả"), false);
  const luu = pick(events, "luu");
  assert.equal(luu.du_lieu.phieu.sessions.length, 1);
  assert.equal(luu.du_lieu.phieu.sessions[0].sequence, 1);
  assert.equal(luu.du_lieu.phieu.revision, p.revision + 1);
  assert.deepEqual(luu.du_lieu.phieu, readDemoPhieu(store, p.encounter_id));
  assert.match(luu.du_lieu.sha256, /^[a-f0-9]{64}$/);
  assert.equal(luu.du_lieu.phieu.sources.ly_do?.nguon, "ai");
  assert.equal(luu.du_lieu.phieu.sources.ly_do?.phien, 1);
  const lyDo = luu.du_lieu.phieu.snapshot.fields.ly_do.value;
  assert.match(lyDo, /đau|chảy dịch/);
  assert.equal(lyDo.includes("["), false, lyDo);
  const record = store.repo.read(p.encounter_id);
  assert.equal(record.recording_sessions.length, 1);
  assert.equal(record.recording_sessions[0].content_state, "reviewed");
  assert.equal(record.recording_sessions[0].device_id, "demo-luong");
  const audit = fs.readFileSync(path.join(root, "audit", `${p.encounter_id}.ndjson`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].gate, true);
  assert.equal(audit[0].session_sequence, 1);
  assert.deepEqual(audit[0], luu.du_lieu.audit);
});

test("phiên 2 sau khi bác sĩ sửa và duyệt: ô bác sĩ giữ nguyên, phiếu về nháp, 2 phiên", async () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  const first = pick(await run(store, { encounterId: p.encounter_id, source: kb("ca-chuan", 1) }), "luu").du_lieu.phieu;
  const edited = saveDoctorEdit(store, p.encounter_id, first.revision, { ly_do: "BS sửa" });
  const approved = approveDemoPhieu(store, p.encounter_id, edited.revision);
  assert.ok(approved.duyet);
  const events = await run(store, { encounterId: p.encounter_id, source: kb("ca-chuan", 2) });
  assert.deepEqual(events.map((e) => e.buoc), ["stt", "ban_tho", "che", "ai", "luu"]);
  const phieu = pick(events, "luu").du_lieu.phieu;
  assert.equal(phieu.snapshot.fields.ly_do.value, "BS sửa");
  assert.equal(phieu.sources.ly_do.nguon, "bac_si");
  assert.equal(phieu.sessions.length, 2);
  assert.deepEqual(phieu.sessions.map((s) => s.sequence), [1, 2]);
  assert.equal(phieu.duyet, null);
  assert.equal(store.repo.read(p.encounter_id).audit.approved_at, null);
  // Phiên 2 (khám, chỉ định) phải thêm được dữ liệu vào phiếu.
  assert.ok(Object.values(phieu.sources).some((s) => s.phien === 2), JSON.stringify(phieu.sources));
  assert.equal(phieu.sources.kham_chuyen_khoa?.phien, 2);
  assert.ok(phieu.snapshot.chiDinh.length >= 1);
  // Phiên 2 của ca chuẩn không nói lý do khám: không có cờ xung đột.
  if (phieu.sources.ly_do.xung_dot) assert.equal(phieu.sources.ly_do.xung_dot.phien, 2);
});

test("phiên mới nói lý do khám khác ô bác sĩ đã sửa: giữ giá trị bác sĩ, cờ xung đột đúng phiên", async () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  const edited = saveDoctorEdit(store, p.encounter_id, p.revision, { ly_do: "BS sửa" });
  const phieu = pick(await run(store, { encounterId: p.encounter_id, source: kb("ca-chuan", 1) }), "luu").du_lieu.phieu;
  assert.equal(phieu.revision, edited.revision + 1);
  assert.equal(phieu.snapshot.fields.ly_do.value, "BS sửa");
  assert.equal(store.repo.read(p.encounter_id).phieu_kham.ly_do_kham, "BS sửa");
  assert.equal(phieu.sources.ly_do.nguon, "bac_si");
  assert.equal(phieu.sources.ly_do.xung_dot?.phien, 1);
  const aiValue = phieu.sources.ly_do.xung_dot?.gia_tri_ai ?? "";
  assert.ok(aiValue && aiValue !== "BS sửa");
  assert.equal(foldVietnamese(aiValue).includes(foldVietnamese("nguyễn thị giả")), false);
  // Ô không bị bác sĩ sửa vẫn nhận giá trị AI.
  assert.equal(phieu.sources.benh_su?.nguon, "ai");
  assert.notEqual(phieu.snapshot.fields.benh_su.value, "");
});

test("ca bị chặn: dừng ở che/bi_chan, không gọi AI, revision không đổi, nhật ký gate:false", async () => {
  const store = newStore(); const root = store.root; const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000789");
  const events = await run(store, { encounterId: p.encounter_id, source: kb("ca-bi-chan") });
  assert.deepEqual(events.map((e) => e.buoc), ["stt", "ban_tho", "che"]);
  const che = pick(events, "che");
  assert.equal(che.trang_thai, "bi_chan");
  assert.equal(che.du_lieu.gate.passed, false);
  const now = readDemoPhieu(store, p.encounter_id);
  assert.equal(now.revision, p.revision);
  assert.equal(now.sessions.length, 0);
  const audit = fs.readFileSync(path.join(root, "audit", `${p.encounter_id}.ndjson`), "utf8").trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].gate, false);
  assert.ok(audit[0].gate_reasons.includes("R11c_ten_rieng_con_sot"));
  assert.equal(JSON.stringify(audit[0]).includes("excerpt"), false);
});

test("ca chưa đồng ý: route local_only, AI mock chạy cục bộ", async () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000456");
  const events = await run(store, { encounterId: p.encounter_id, source: kb("ca-chua-dong-y") });
  assert.deepEqual(events.map((e) => e.buoc), ["stt", "ban_tho", "che", "ai", "luu"]);
  const che = pick(events, "che");
  assert.equal(che.du_lieu.ai_route, "local_only");
  assert.equal(che.du_lieu.dong_y.trang_thai, false);
  assert.equal(pick(events, "ai").du_lieu.provider, "mock");
  assert.equal(pick(events, "ban_tho").du_lieu.mode, "dictation");
  assert.equal(pick(events, "luu").du_lieu.audit.ai_route, "local_only");
});

test("kịch bản của bệnh nhân khác phiếu đang mở thì 409", async () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  await assert.rejects(run(store, { encounterId: p.encounter_id, source: kb("ca-bi-chan") }), (e: unknown) => e instanceof ClinicalError && e.status === 409);
});

test("audio: chế độ dictation, gọi transcribe, bản sạch che tên bệnh nhân", async () => {
  const store = newStore(); const create = (id: string) => createDemoPhieu(store, id);
  const p = create("GIA-000123");
  let called = 0;
  const events = await run(store, {
    encounterId: p.encounter_id, source: { kind: "audio" }, audio: new Uint8Array([82, 73, 70, 70]),
    transcribe: async () => { called++; return { text: "chị nguyễn thị giả đau tai phải ba ngày", engine: "zipformer-gia", audio_ms: 3200 }; },
  });
  assert.equal(called, 1);
  assert.deepEqual(events.map((e) => e.buoc), ["stt", "ban_tho", "che", "ai", "luu"]);
  assert.equal(pick(events, "stt").du_lieu.engine, "zipformer-gia");
  assert.equal(pick(events, "stt").du_lieu.audio_ms, 3200);
  assert.equal(pick(events, "ban_tho").du_lieu.mode, "dictation");
  assert.match(pick(events, "che").du_lieu.clean, /\[BỆNH_NHÂN\]/);
  await assert.rejects(run(store, { encounterId: p.encounter_id, source: { kind: "audio" } }), (e: unknown) => e instanceof ClinicalError && e.status === 400);
});

test("người đọc dừng ngay ở sự kiện bị chặn: dòng nhật ký đã được ghi", async () => {
  const store = newStore(); const p = createDemoPhieu(store, "GIA-000789");
  for await (const e of runDemoFlow(store, { encounterId: p.encounter_id, source: kb("ca-bi-chan") })) if (e.buoc === "che") break;
  const lines = fs.readFileSync(path.join(store.root, "audit", `${p.encounter_id}.ndjson`), "utf8").trim().split(/\r?\n/);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).gate, false);
});

test("phiếu đổi revision giữa bước AI và lưu: phát luu/loi, không ném lỗi, không ghi phiên", async () => {
  const store = newStore(); const p = createDemoPhieu(store, "GIA-000123");
  const events: DemoEvent[] = [];
  for await (const e of runDemoFlow(store, { encounterId: p.encounter_id, source: kb("ca-chuan", 1) })) {
    events.push(e);
    if (e.buoc === "ai") saveDoctorEdit(store, p.encounter_id, p.revision, { benh_su: "BS chen giữa" });
  }
  const luu = pick(events, "luu");
  assert.equal(luu.trang_thai, "loi");
  assert.ok(luu.du_lieu.loi);
  assert.equal(luu.du_lieu.phieu.sessions.length, 0);
  assert.equal(luu.du_lieu.phieu.revision, p.revision + 1);
  assert.equal(fs.existsSync(path.join(store.root, "audit", `${p.encounter_id}.ndjson`)), false);
});

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "kich-ban" ? [] : walk(full);
    return [full];
  });
}

test("không rò bản thô: không file nào trong kho chứa chuỗi phải che, không có file âm thanh", () => {
  const files = walk(parent);
  assert.ok(files.length > 0);
  const secrets = ["ca-chuan", "ca-bi-chan", "ca-chua-dong-y"].flatMap((id) => loadKichBan(id).expected.phai_che).map(foldVietnamese);
  for (const file of files) {
    assert.equal(/\.(wav|mp3|ogg|webm|m4a|flac)$/i.test(file), false, file);
    const content = foldVietnamese(fs.readFileSync(file, "utf8"));
    for (const s of secrets) assert.equal(content.includes(s), false, `${path.relative(parent, file)} chứa "${s}"`);
  }
});
