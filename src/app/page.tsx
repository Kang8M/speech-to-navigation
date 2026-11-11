import { Workspace } from "@/client/workspace/Workspace";
import { loadAppConfig } from "@/server/du-lieu/config";

export const dynamic = "force-dynamic";

export default function Page() {
  return <Workspace config={loadAppConfig()} />;
}
