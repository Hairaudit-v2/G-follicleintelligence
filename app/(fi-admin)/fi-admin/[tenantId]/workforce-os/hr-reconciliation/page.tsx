import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { HrReconciliationClient } from "@/src/components/fi/workforce/HrReconciliationClient";
import { loadWorkforceOsHrReconciliationPage } from "@/src/lib/workforce-os/workforceOsDirectoryLoader.server";

export const metadata = {
  title: "HR Reconciliation · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function WorkforceOsHrReconciliationPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const data = await loadWorkforceOsHrReconciliationPage(tenantId.trim());
  if (!data) notFound();

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <HrReconciliationClient
        tenantId={tenantId.trim()}
        initialMetrics={data.metrics}
        initialSuggestions={data.suggestions}
        initialArchivedHistorical={data.archivedHistorical}
        initialDiagnostics={data.diagnostics}
      />
    </div>
  );
}
