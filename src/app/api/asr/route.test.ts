import assert from "node:assert/strict";
import { test } from "node:test";
import { GET, POST } from "./route";

test("ASR defaults to the local provider and external configuration cannot start capture", async () => {
  const previous = process.env.ASR_PROVIDER;
  try {
    delete process.env.ASR_PROVIDER;
    assert.equal((await GET().json()).provider, "zipformer");
    for (const provider of ["web", "external", "unknown"]) {
      process.env.ASR_PROVIDER = provider;
      const status = await GET().json();
      assert.equal(status.sanSang, false);
      assert.deepEqual(status.thieu, []);
      assert.equal(status.thuMucModel, "models/stt/zipformer-vi");
      assert.equal(POST(new Request("http://localhost/api/asr", { method: "POST", headers: { "X-Clinical-Consent": "true" } })).status, 403);
    }
  } finally {
    if (previous === undefined) delete process.env.ASR_PROVIDER;
    else process.env.ASR_PROVIDER = previous;
  }
});


test("local ASR requires explicit consent before allocating a session", async () => {
  const previous = process.env.ASR_PROVIDER;
  process.env.ASR_PROVIDER = "zipformer";
  try {
    for (const consent of [undefined, "false", "yes"]) {
      const response = POST(new Request("http://localhost/api/asr", {
        method: "POST", headers: consent ? { "X-Clinical-Consent": consent } : {},
      }));
      assert.equal(response.status, 403);
      assert.match((await response.json()).error, /đồng ý/);
    }
  } finally {
    if (previous === undefined) delete process.env.ASR_PROVIDER;
    else process.env.ASR_PROVIDER = previous;
  }
});

test("GET báo đúng model đang chọn bằng ASR_MODEL, giá trị lạ về zipformer", async () => {
  const truocModel = process.env.ASR_MODEL;
  const truocProvider = process.env.ASR_PROVIDER;
  const canhBao = console.warn;
  console.warn = () => undefined;
  try {
    delete process.env.ASR_PROVIDER;
    delete process.env.ASR_MODEL;
    let status = await GET().json();
    assert.equal(status.model, "zipformer");
    assert.equal(status.thuMucModel, "models/stt/zipformer-vi");

    process.env.ASR_MODEL = "rumble";
    status = await GET().json();
    assert.equal(status.model, "rumble");
    assert.equal(status.thuMucModel, "models/stt/rumble-2-flash");

    process.env.ASR_MODEL = "abc";
    status = await GET().json();
    assert.equal(status.model, "zipformer");
    assert.equal(status.thuMucModel, "models/stt/zipformer-vi");
  } finally {
    console.warn = canhBao;
    if (truocModel === undefined) delete process.env.ASR_MODEL;
    else process.env.ASR_MODEL = truocModel;
    if (truocProvider === undefined) delete process.env.ASR_PROVIDER;
    else process.env.ASR_PROVIDER = truocProvider;
  }
});
