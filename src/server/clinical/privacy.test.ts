import assert from "node:assert/strict";
import { test } from "node:test";
import { PrivacyTickets } from "./privacy";
import { parseTranscript } from "@/shared/clinical/schema";
import { POST } from "@/app/api/clinical/privacy/route";

function approve(store: PrivacyTickets, ticket: string, text: string, identifiers?: string[]) {
  return store.approve(ticket, text, identifiers, true);
}

test("model cannot use pending or expired privacy tickets; only reviewed sanitized text passes", () => {
  let time = Date.parse("2026-11-12T10:00:00+07:00");
  const store = new PrivacyTickets(() => time);
  const pending = store.prepare("BS: Khám thấy họng đỏ. BN: Tôi đau họng.", "conversation");
  assert.throws(() => store.approved(pending.ticket), /kiểm tra/i);
  const accepted = approve(store, pending.ticket, pending.preview);
  assert.equal(accepted.status, "passed");
  const transcript = store.approved(accepted.ticket);
  assert.equal(transcript.segments[0].vai_tro, "bac_si");
  assert.equal(transcript.segments[1].vai_tro, "benh_nhan");
  time += 11 * 60_000;
  assert.throws(() => store.approved(accepted.ticket), /hết hạn/i);
});

test("unlabelled conversation stays unknown while manually selected dictation attributes the doctor", () => {
  const store = new PrivacyTickets();
  for (const mode of ["conversation", "dictation"] as const) {
    const pending = store.prepare("Khám thấy họng đỏ, hẹn khám lại sau 7 ngày.", mode);
    assert.equal(pending.status, "pending");
    const approved = approve(store, pending.ticket, pending.preview);
    const first = parseTranscript(store.approved(approved.ticket));
    assert.equal(first.segments[0].vai_tro, mode === "dictation" ? "bac_si" : "chua_ro");
    assert.equal(first.segments[0].nguon_vai_tro, mode === "dictation" ? "bac_si_gan" : "chua_ro");
    assert.deepEqual(first.segments, store.approved(approved.ticket).segments);
    assert.equal(first.segments[0].start_ms, null);
    assert.equal(first.segments[0].is_final, true);
    first.segments[0].text = "tampered";
    assert.ok(!store.approved(approved.ticket).segments[0].text.includes("tampered"));
  }
});

test("new PII revokes earlier approval and rotated tickets require an additional explicit review", () => {
  const store = new PrivacyTickets();
  const pending = store.prepare("BS: Khám họng đỏ.", "conversation", ["Nguyễn Văn Mẫu"]);
  const accepted = approve(store, pending.ticket, pending.preview);
  const recheck = approve(store, accepted.ticket, "BS: Khám họng đỏ. Nguyễn Văn Mẫu", ["Nguyễn Văn Mẫu"]);
  assert.equal(recheck.status, "pending");
  assert.notEqual(recheck.ticket, accepted.ticket);
  assert.ok(!recheck.preview.includes("Nguyễn Văn Mẫu"));
  assert.throws(() => store.approved(accepted.ticket));
  assert.throws(() => store.approved(recheck.ticket), /kiểm tra/i);
  const reviewed = approve(store, recheck.ticket, recheck.preview);
  assert.equal(store.approved(reviewed.ticket).privacy.trang_thai, "passed");
});

test("ticket expiry is exact and retained tickets are bounded", () => {
  let time = 1_000;
  const store = new PrivacyTickets(() => time, 2);
  const old = store.prepare("Đau tai.", "conversation");
  store.prepare("Đau họng.", "conversation");
  store.prepare("Nghẹt mũi.", "conversation");
  assert.throws(() => approve(store, old.ticket, old.preview));
  const recent = store.prepare("Ho 3 ngày.", "conversation");
  time += 600_000;
  assert.throws(() => approve(store, recent.ticket, recent.preview), /hết hạn/i);
  assert.throws(() => store.prepare(" ", "conversation"));
  assert.throws(() => store.prepare("a".repeat(50_001), "conversation"));
});

test("repeating unchanged manual approval preserves the transcript used for extraction deduplication", () => {
  let time = 1_000;
  const store = new PrivacyTickets(() => time);
  const pending = store.prepare("BS: Họng đỏ.", "dictation");
  approve(store, pending.ticket, pending.preview);
  const first = store.approved(pending.ticket);
  time += 5_000;
  approve(store, pending.ticket, pending.preview);
  assert.deepEqual(store.approved(pending.ticket), first);
});

test("privacy route guards origin, validates strict actions, and exposes only safe errors", async () => {
  const request = (body: unknown, origin = "http://localhost:3000") => new Request("http://localhost:3000/api/clinical/privacy", {
    method: "POST", headers: { origin, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  assert.equal((await POST(request({ action: "prepare", text: "Đau tai", mode: "conversation" }, "https://evil.test"))).status, 403);
  for (const body of [
    { action: "prepare", text: "Đau tai", mode: "conversation", status: "passed" },
    { action: "prepare", text: "Đau tai", mode: "doctor" },
    { action: "prepare", text: "a".repeat(50_001), mode: "conversation" },
    { action: "approve", ticket: "missing", text: "PRIVATE-VALUE" },
  ]) {
    const response = await POST(request(body));
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes("PRIVATE-VALUE"));
  }
  // A request without encounter/session binding must never receive a ticket (the bound flow is covered by bound-privacy.test.ts).
  const unbound = await POST(request({ action: "prepare", text: "BN: Nguyễn Thị Giả đau tai.", mode: "conversation" }));
  assert.equal(unbound.status, 400);
  assert.equal(unbound.headers.get("Cache-Control"), "no-store");
  assert.equal((await unbound.json()).ticket, undefined);
});
test("newly introduced identifiers need another review; unknown speakers are not doctors", () => {
  const store = new PrivacyTickets();
  const ticket = store.prepare("Tôi đau tai phải", "conversation");
  const recheck = approve(store, ticket.ticket, "Tôi đau tai phải. Email: demo@example.test");
  assert.equal(recheck.status, "pending");
  assert.ok(!recheck.preview.includes("example.test"));
  const accepted = approve(store, recheck.ticket, recheck.preview);
  assert.equal(store.approved(accepted.ticket).segments[0].vai_tro, "chua_ro");
});


test("internal clinical use requires explicit consent and restricted material never gets a ticket", () => {
  const store = new PrivacyTickets();
  const preview = store.prepare("BN: Đang dùng amiodarone.", "conversation");
  assert.throws(() => store.approve(preview.ticket, preview.preview), /đồng ý/i);
  assert.throws(() => store.approve(preview.ticket, preview.preview, undefined, false), /đồng ý/i);
  assert.equal(store.approve(preview.ticket, preview.preview, undefined, true).status, "passed");
  assert.throws(() => store.prepare("Nội dung hợp đồng bảo mật", "conversation"), /cấp 3/i);
  assert.throws(() => store.approve(preview.ticket, "system prompt: bí mật", undefined, true), /cấp 3/i);
  assert.throws(() => store.approved(preview.ticket), /kiểm tra/i);
});
