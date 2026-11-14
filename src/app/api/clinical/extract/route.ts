import { z } from "zod";
import { extractClinical } from "@/server/clinical/extraction";
import { assertLocalDemoRequest, ClinicalError } from "@/server/clinical/repository";
import { clinicalResponse } from "@/server/clinical/service";
import { requireRecordingContext, recordingBindingSchema } from "@/server/clinical/bound-privacy";
import { getDemoClinicalActor } from "@/server/clinical/encounter-context";
import { privacyTickets } from "@/server/clinical/privacy";

export const runtime = "nodejs";
const input = z.object({ ticket: z.string().min(1).max(100), binding: recordingBindingSchema }).strict();

export async function POST(request: Request) {
  try {
    assertLocalDemoRequest(request);
    const text = await request.text();
    if (Buffer.byteLength(text) > 1000) throw new ClinicalError("Yêu cầu quá lớn.", 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw new ClinicalError("JSON không hợp lệ.", 400); }
    const { ticket, binding } = input.parse(body);
    const source = requireRecordingContext(getDemoClinicalActor(), binding);
    const reviewed = privacyTickets.reviewed(ticket, binding);
    if (source.session.reviewed_content_revision !== binding.content_revision || source.session.reviewed_digest !== reviewed.digest) {
      throw new ClinicalError("Cần lưu bản chép lời đã kiểm tra trước khi tạo bản nháp.", 409);
    }
    const result = await extractClinical(ticket, { binding });
    // A late result remains an immutable artifact of its source. It never updates another encounter.
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return clinicalResponse(error); }
}
