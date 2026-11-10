import type { Metadata } from "next";
import { EformScreen } from "@/components/eform/EformScreen";
import { loadEformData } from "@/lib/eform/load";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mô phỏng eForm ngoại trú – Prototype",
  description: "Mô phỏng phiếu khám ngoại trú có điểm AI hỗ trợ. Chỉ dùng dữ liệu giả.",
};

export default function Page() {
  return <EformScreen data={loadEformData()} />;
}
