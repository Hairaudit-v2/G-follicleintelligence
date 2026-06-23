import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ConsultationOsDashboard } from "@/src/components/fi-admin/consultations/ConsultationOsDashboard";
import { ConsultationOsListView } from "@/src/components/fi-admin/consultations/ConsultationOsListView";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { listConsultationsForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { CONSULTATION_STATUSES, type ConsultationStatus } from "@/src/lib/consultations/consultationTypes";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadConsultationDashboardPayload } from "@/src/lib/fiAdmin/consultationDashboardLoader.server";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Consultations",
  description:
    "Clinical assessment, treatment planning, quote readiness, and patient follow-up across every consultation.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseStatusFilter(sp: Record<string, string | string[] | undefined>): ConsultationStatus | null {
  const raw = sp.status;
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (!s?.trim()) return null;
  const v = s.trim() as ConsultationStatus;
  return (CONSULTATION_STATUSES as readonly string[]).includes(v) ? v : null;
}

function parseViewMode(sp: Record<string, string | string[] | undefined>): "workspace" | "list" {
  const raw = sp.view;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v?.trim().toLowerCase() === "list" ? "list" : "workspace";
}

export default async function ConsultationsIndexRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const tid = tenantId.trim();
  const sp = (await searchParams) ?? {};
  const statusFilter = parseStatusFilter(sp);
  const viewMode = parseViewMode(sp);

  if (viewMode === "list" || statusFilter != null) {
    const rows = await listConsultationsForTenant(tid, statusFilter ? { status: statusFilter } : { limit: 200 });
    return <ConsultationOsListView tenantId={tid} rows={rows} activeStatus={statusFilter} />;
  }

  const [payload, showDiagnosticsExpanded, authId] = await Promise.all([
    loadConsultationDashboardPayload(tid),
    canViewDashboardSystemDiagnostics(tid),
    resolveAuthUserId(null),
  ]);

  const os = authId ? await loadFiOsIdentity(authId) : null;
  const sessionLabel = os?.osRole ?? undefined;

  return (
    <ConsultationOsDashboard
      tenantId={tid}
      payload={payload}
      showDiagnosticsExpanded={showDiagnosticsExpanded}
      sessionLabel={sessionLabel}
    />
  );
}
