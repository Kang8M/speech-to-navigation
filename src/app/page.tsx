import type { Metadata } from "next";
import { EformScreen } from "@/client/eform/EformScreen";
import { loadEformData } from "@/server/du-lieu/eform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "eForm ngoại trú",
  description: "Mô phỏng phiếu khám ngoại trú có điểm AI hỗ trợ. Chỉ dùng dữ liệu giả.",
};

/**
 * ?bs=user_bs02 đổi tài khoản bác sĩ, để nhiều bác sĩ thử chung một máy mà gợi ý theo thói quen không lẫn nhau.
 * Người điều phối đo so sánh: ?giao-dien=cu mở cột Trợ lý AI như trước, ?goi-y=tat tắt gợi ý chữ mờ.
 */
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const { bs } = params;
  return (
    <EformScreen
      data={loadEformData(typeof bs === "string" ? bs : undefined)}
      giaoDien={params["giao-dien"] === "cu" ? "cu" : "gon"}
      goiYTab={params["goi-y"] !== "tat"}
    />
  );
}
