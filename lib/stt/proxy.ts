export const MAX_AUDIO_BYTES = 30 * 16000 * 2 + 4096;

export async function proxyStt(request: Request, send: typeof fetch = fetch): Promise<Response> {
  const base = process.env.STT_BACKEND_URL || "http://127.0.0.1:8765";
  const init: RequestInit = { method: request.method, cache: "no-store", signal: AbortSignal.timeout(120000) };
  if (request.method === "POST") {
    if (!/^audio\/(x-)?wav(?:;|$)/i.test(request.headers.get("content-type") || "")) {
      return Response.json({ detail: "AUDIO_MIME_UNSUPPORTED" }, { status: 400 });
    }
    const reader = request.body?.getReader();
    if (!reader) return Response.json({ detail: "AUDIO_EMPTY" }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_AUDIO_BYTES) {
          await reader.cancel();
          return Response.json({ detail: "AUDIO_TOO_LARGE" }, { status: 413 });
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    init.body = Buffer.concat(chunks);
    const headers: Record<string, string> = { "Content-Type": "audio/wav" };
    for (const key of ["X-STT-Session", "X-STT-Sequence", "X-STT-Start-Frame", "X-STT-Diarize"]) {
      const value = request.headers.get(key);
      if (value) headers[key] = value;
    }
    init.headers = headers;
  }
  try {
    const response = await send(`${base.replace(/\/$/, "")}/${request.method === "GET" ? "health" : "transcribe"}`, init);
    const data = await response.json();
    return Response.json(data, { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const timeout = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return Response.json({ detail: timeout ? "STT_TIMEOUT" : "STT_BACKEND_UNAVAILABLE" }, { status: timeout ? 504 : 503 });
  }
}

export async function proxySttSession(request: Request, id?: string, send: typeof fetch = fetch): Promise<Response> {
  if (id && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return Response.json({ detail: "STT_SESSION_INVALID" }, { status: 400 });
  }
  const base = process.env.STT_BACKEND_URL || "http://127.0.0.1:8765";
  const path = id ? `/sessions/${id}${request.method === "POST" ? "/finalize" : ""}` : "/sessions";
  try {
    const response = await send(base.replace(/\/$/, "") + path, { method: request.method, cache: "no-store", signal: AbortSignal.timeout(120000) });
    return Response.json(await response.json(), { status: response.status, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ detail: "STT_BACKEND_UNAVAILABLE" }, { status: 503 });
  }
}
