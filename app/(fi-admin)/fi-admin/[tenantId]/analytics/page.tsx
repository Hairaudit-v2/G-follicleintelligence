import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { AnalyticsOsDashboard } from "@/src/components/fi-admin/analytics/AnalyticsOsDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadAnalyticsOsDashboard } from "@/src/lib/fiAdmin/analyticsOsDashboardRead.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "AnalyticsOS",
  description: "Executive intelligence across leads, patients, surgery, audit, foundation health, and clinic operations.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AnalyticsOsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const [showCrmNav, showBookingsBoard] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
  ]);

  const model = await loadAnalyticsOsDashboard(tenantId.trim(), { showCrmNav, showBookingsBoard });

  return <AnalyticsOsDashboard model={model} />;
}
