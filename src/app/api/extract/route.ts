import { z } from "zod";
import {
  getProviderName,
  loadCases,
  loadCatalogs,
  loadForms,
  loadRules,
  loadVietTat,
} from "@/server/du-lieu/config";
import { runPipeline } from "@/server/ai/pipeline";
import { docGoTat } from "@/server/du-lieu/go-tat";
import { timMauGoc } from "@/server/du-lieu/phieu-mau";
import { MAU_TAI_KHOAN } from "@/server/du-lieu/thoi-quen";
import { thongBaoLoiAi } from "@/shared/loi-ai";

const requestSchema = z.object({
  text: z.string().trim().min(1).max(10000),
  mau_id: z.string().max(100).optional(),
  tai_khoan: z.string().regex(MAU_TAI_KHOAN).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Chưa có nội dung để AI điền nháp." }, { status: 400 });
  }
  const mau = parsed.data.mau_id ? timMauGoc(parsed.data.mau_id) : undefined;
  if (parsed.data.mau_id && !mau) {
    return Response.json({ error: "Không tìm thấy mẫu này, hãy tải lại trang." }, { status: 400 });
  }
  const context = {
    forms: loadForms(),
    catalogs: loadCatalogs(),
    vietTat: loadVietTat(),
    rules: loadRules(),
    cases: loadCases(),
  };
  try {
    const cauQuen = parsed.data.tai_khoan ? docGoTat(parsed.data.tai_khoan).bo : undefined;
    const result = await runPipeline(parsed.data.text, context, { provider: getProviderName(), mau: mau?.nhap, cauQuen });
    return Response.json(result);
  } catch (error) {
    console.error("Lỗi khi AI điền nháp:", error);
    const detail = error instanceof Error ? error.message : "";
    return Response.json({ error: thongBaoLoiAi(detail) }, { status: 502 });
  }
}
