import { AuditOsDashboard } from "@/src/components/fi-admin/audit/AuditOsDashboard";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";

export const metadata = {
  title: "Audit Intelligence",
  description:
    "Clinical quality, outcome review, patient evidence, and audit readiness across surgical cases.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AuditOsDashboardPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const showDiagnosticsExpanded = tenantId?.trim()
    ? await canViewDashboardSystemDiagnostics(tenantId.trim())
    : false;

  return <AuditOsDashboard showDiagnosticsExpanded={showDiagnosticsExpanded} />;
}
