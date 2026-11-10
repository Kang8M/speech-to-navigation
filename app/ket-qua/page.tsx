import { ResultsView } from "@/components/ResultsView";
import { listSessions } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ResultsView sessions={listSessions()} />;
}
