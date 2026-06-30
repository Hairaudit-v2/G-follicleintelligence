import { unstable_noStore as noStore } from "next/cache";

import { LeadFlowOperatorDashboard } from "@/src/components/fi-admin/leadflow/LeadFlowOperatorDashboard";
import { getCrmShellPageSession } from "@/src/lib/crm/crmShellAccess";
import { loadLeadFlowOperatorDashboardPayload } from "@/src/lib/fiAdmin/leadFlowOperatorDashboardLoader.server";

export const metadata = {
  title: "LeadFlow",
  description: "HubSpot-first lead intelligence for hair restoration clinics.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function LeadFlowOperatorPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  await getCrmShellPageSession(tenantId);
  const payload = await loadLeadFlowOperatorDashboardPayload(tenantId);

  return <LeadFlowOperatorDashboard payload={payload} />;
}
