import { Workspace } from "@/components/Workspace";
import { loadAppConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Workspace config={loadAppConfig()} />;
}
