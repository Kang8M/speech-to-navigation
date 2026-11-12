import { proxySttSession } from "@/lib/stt/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxySttSession(request);
}
