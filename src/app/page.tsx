import type { Metadata } from "next";
import { EformScreen } from "@/client/eform/EformScreen";
import { loadEformData } from "@/server/du-lieu/eform";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "eForm ngoại trú",
  description: "Mô phỏng phiếu khám ngoại trú có điểm AI hỗ trợ. Chỉ dùng dữ liệu giả.",
};

export default function Page() {
  return <EformScreen data={loadEformData()} />;
}
