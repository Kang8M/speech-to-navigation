import assert from "node:assert/strict";
import { test } from "node:test";
import { proxyStt, proxySttSession, MAX_AUDIO_BYTES } from "./proxy";

test("proxy reports unavailable backend and preserves upstream errors", async () => {
  const failed = await proxyStt(new Request("http://localhost/api/stt"), async () => { throw new Error("offline"); });
  assert.equal(failed.status, 503);
  assert.equal((await failed.json()).detail, "STT_BACKEND_UNAVAILABLE");
  const upstream = await proxyStt(new Request("http://localhost/api/stt", {
    method: "POST", body: "wav", headers: { "Content-Type": "audio/wav" },
  }), async (_url, init) => {
    assert.equal(init?.method, "POST");
    return Response.json({ detail: "AUDIO_SILENT" }, { status: 400 });
  });
  assert.equal(upstream.status, 400);
  assert.equal((await upstream.json()).detail, "AUDIO_SILENT");
});

test("proxy rejects oversized streamed input before contacting backend", async () => {
  let contacted = false;
  const response = await proxyStt(new Request("http://localhost/api/stt", {
    method: "POST", body: new Uint8Array(MAX_AUDIO_BYTES + 1), headers: { "Content-Type": "audio/wav" },
  }), async () => { contacted = true; return Response.json({}); });
  assert.equal(response.status, 413);
  assert.equal(contacted, false);
});

test("speaker session metadata survives proxy and session paths cannot escape", async () => {
  await proxyStt(new Request("http://localhost/api/stt", { method: "POST", body: "wav", headers: {
    "Content-Type": "audio/wav", "X-STT-Session": "id", "X-STT-Sequence": "2", "X-STT-Start-Frame": "80000",
  } }), async (_url, init) => {
    const headers = new Headers(init?.headers);
    assert.equal(headers.get("X-STT-Sequence"), "2");
    assert.equal(headers.get("X-STT-Start-Frame"), "80000");
    return Response.json({});
  });
  const response = await proxySttSession(new Request("http://localhost/api/stt/session/x", { method: "DELETE" }), "../health");
  assert.equal(response.status, 400);
});
