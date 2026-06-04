import { SystemStatusPage } from "@/src/components/fi/system-status/SystemStatusPage";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";
import { loadSystemStatus } from "@/src/lib/systemStatus/systemStatusLoader";

export const metadata = {
  title: "System Status",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TenantSystemStatusPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  await assertCrmShellPageAccess(tenantId);
  const data = await loadSystemStatus(tenantId);
  return <SystemStatusPage data={data} />;
}
