import "server-only";
import { assertLocalDemoRequest } from "./guard";

/**
 * Guard local cho page server (không đi qua route handler): dựng Request tối thiểu từ header Host/Origin/Sec-Fetch-Site
 * rồi dùng lại đúng guard của API. Thiếu Host hoặc Host không phải máy local thì ném ClinicHttpError 403.
 */
export function assertLocalDemoPage(h: Headers, path: string): void {
  const host = h.get("host") ?? "";
  const headers = new Headers();
  for (const name of ["origin", "sec-fetch-site"]) {
    const v = h.get(name);
    if (v !== null) headers.set(name, v);
  }
  let request: Request;
  try {
    request = new Request(`http://${host}${path}`, { headers });
  } catch {
    request = new Request("http://invalid.invalid/", { headers });
  }
  assertLocalDemoRequest(request);
}
