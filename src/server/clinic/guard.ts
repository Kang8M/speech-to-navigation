import "server-only";
import { ClinicHttpError } from "./errors";

// Guard tối thiểu cho prototype chạy local. Sẽ thay bằng `assertLocalDemoRequest` của lớp clinical (ưu tiên 1)
// khi gộp nhánh. Không phải xác thực: chỉ chặn truy cập từ máy khác và gọi chéo origin.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function hostnameOf(hostWithPort: string): string | null {
  try {
    return new URL(`http://${hostWithPort}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function deny(): never {
  throw new ClinicHttpError(403, "Chỉ cho phép truy cập từ máy đang chạy ứng dụng.");
}

export function assertLocalDemoRequest(request: Request): void {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return deny();
  }
  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) deny();

  const host = request.headers.get("host");
  if (host !== null) {
    const h = hostnameOf(host);
    if (h === null || !LOCAL_HOSTS.has(h)) deny();
  }

  const origin = request.headers.get("origin");
  if (origin !== null) {
    let o: URL;
    try {
      o = new URL(origin);
    } catch {
      return deny();
    }
    if (!LOCAL_HOSTS.has(o.hostname.toLowerCase()) || o.host !== url.host) deny();
  }

  if (request.headers.get("sec-fetch-site") === "cross-site") deny();
}
