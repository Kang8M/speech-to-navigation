import type { Metadata } from "next";
import { TrinhDienScreen } from "@/client/trinh-dien/TrinhDienScreen";
import { loadTrinhDienData } from "@/server/du-lieu/trinh-dien";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Trình diễn – 4 cách làm việc với máy",
  description: "Cùng một ca giả, bốn cách bác sĩ làm việc với Trợ lý AI. Chỉ dùng dữ liệu giả, không ghi gì khi Lưu.",
};

export default async function Page() {
  return <TrinhDienScreen data={await loadTrinhDienData()} />;
}
