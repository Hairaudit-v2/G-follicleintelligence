import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { AnalyticsOsDashboard } from "@/src/components/fi-admin/analytics/AnalyticsOsDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { loadAnalyticsExecutiveDashboard } from "@/src/lib/analytics-os/analyticsExecutive.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isFiOsPlatformAdminFullSessionBypass, resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadAnalyticsOsDashboard } from "@/src/lib/fiAdmin/analyticsOsDashboardRead.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { normalizeFiOsRole } from "@/src/lib/fiOs/fiOsRoles";

export const metadata = {
  title: "Insights",
  description:
    "Executive intelligence across revenue, consultations, surgery, patients, workforce, and clinic performance.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

async function resolveAnalyticsDiagnosticsExpanded(
  tenantId: string,
  authUserId: string | null
): Promise<boolean> {
  if (!authUserId) return false;
  if (await isFiOsPlatformAdminFullSessionBypass(authUserId)) return true;

  const os = await loadFiOsIdentity(authUserId);
  if (os?.osRole === "fi_admin" || os?.osRole === "fi_platform_admin") return true;

  const { data } = await supabaseAdmin()
    .from("fi_users")
    .select("role")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  const role = normalizeFiOsRole((data as { role?: string | null } | null)?.role);
  return role === "fi_admin" || role === "admin";
}

export default async function AnalyticsOsPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  await assertStaffModuleAccess(tenantId, "analytics_os", "read");

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const tid = tenantId.trim();

  const [showCrmNav, showBookingsBoard, authUserId] = await Promise.all([
    getCrmShellNavAllowed(tid),
    getBookingsBoardNavAllowed(tid),
    resolveAuthUserId(),
  ]);

  const showDiagnosticsExpanded = await resolveAnalyticsDiagnosticsExpanded(tid, authUserId);

  const [model, executive] = await Promise.all([
    loadAnalyticsOsDashboard(tid, { showCrmNav, showBookingsBoard }),
    loadAnalyticsExecutiveDashboard(tid),
  ]);

  return (
    <AnalyticsOsDashboard
      model={model}
      executive={executive}
      showDiagnosticsExpanded={showDiagnosticsExpanded}
    />
  );
}
