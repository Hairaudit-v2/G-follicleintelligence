import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FinancialOsCommandCentreDashboard } from "@/src/components/fi-admin/financial-os/FinancialOsCommandCentreDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadFinancialOsCommandCentrePayload } from "@/src/lib/financialOs/financialOsCommandCentreLoader.server";
import type { SurgeryEconomicsDashboardFilters } from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import { loadSurgeryEconomicsFilterOptions } from "@/src/lib/financialOs/financialSurgeryEconomics.server";
import type { RevenueAttributionDashboardFilters } from "@/src/lib/financialOs/financialRevenueAttribution.server";
import { loadRevenueAttributionFilterOptions } from "@/src/lib/financialOs/financialRevenueAttribution.server";

export const metadata = {
  title: "Finances",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseSurgeryEconomicsFilters(
  sp: Record<string, string | string[] | undefined>
): SurgeryEconomicsDashboardFilters {
  const one = (key: string) => {
    const v = sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  const status = one("se_status");
  const snapshotStatus =
    status === "paid_in_full" || status === "outstanding" || status === "needs_configuration"
      ? status
      : "all";
  return {
    dateFrom: one("se_from"),
    dateTo: one("se_to"),
    procedureType: one("se_procedure"),
    surgeonUserId: one("se_surgeon"),
    clinicId: one("se_clinic"),
    snapshotStatus,
  };
}

function parseRevenueAttributionFilters(
  sp: Record<string, string | string[] | undefined>
): RevenueAttributionDashboardFilters {
  const one = (key: string) => {
    const v = sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  return {
    dateFrom: one("ra_from"),
    dateTo: one("ra_to"),
    source: one("ra_source"),
    campaign: one("ra_campaign"),
    consultantFiUserId: one("ra_consultant"),
    clinicId: one("ra_clinic"),
    procedureType: one("ra_procedure"),
  };
}

export default async function FiAdminFinancialOsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const tid = tenantId?.trim();
  if (!tid) notFound();

  await assertFiTenantPortalAccess(tid);

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  ) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">
          Supabase environment variables are missing. Check deployment configuration.
        </p>
      </InfoNotice>
    );
  }

  const filters = parseSurgeryEconomicsFilters(sp);
  const attributionFilters = parseRevenueAttributionFilters(sp);

  let data: Awaited<ReturnType<typeof loadFinancialOsCommandCentrePayload>>;
  let filterOptions: Awaited<ReturnType<typeof loadSurgeryEconomicsFilterOptions>>;
  let attributionFilterOptions: Awaited<ReturnType<typeof loadRevenueAttributionFilterOptions>>;
  let showDiagnosticsExpanded: boolean;
  try {
    [data, filterOptions, attributionFilterOptions, showDiagnosticsExpanded] = await Promise.all([
      loadFinancialOsCommandCentrePayload(tid, new Date(), filters, attributionFilters),
      loadSurgeryEconomicsFilterOptions(tid),
      loadRevenueAttributionFilterOptions(tid),
      canViewDashboardSystemDiagnostics(tid),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    console.error("[FiAdminFinancialOsPage]", msg || "load failed");
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Finances could not load">
          <p className="text-sm">
            The command centre failed to load. Apply migration{" "}
            <code className="rounded bg-white/10 px-1 text-xs">
              20260920120001_fi_financial_os_core_infrastructure.sql
            </code>{" "}
            and check server logs.
          </p>
          {msg ? <p className="mt-2 text-xs text-slate-500">{msg}</p> : null}
        </InfoNotice>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <Suspense fallback={null}>
        <FinancialOsCommandCentreDashboard
          data={data}
          surgeryEconomicsFilterOptions={filterOptions}
          revenueAttributionFilterOptions={attributionFilterOptions}
          showDiagnosticsExpanded={showDiagnosticsExpanded}
        />
      </Suspense>
    </div>
  );
}
