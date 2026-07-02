import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { FinancialOsExecutiveDetailDashboard } from "@/src/components/fi-admin/financial-os/FinancialOsExecutiveDetailDashboard";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import type { ExecutiveFinanceDashboardFilters } from "@/src/lib/financialOs/financialExecutiveIntelligence.server";
import {
  loadExecutiveFinanceDetailPayload,
  loadExecutiveFinanceFilterOptions,
} from "@/src/lib/financialOs/financialExecutiveIntelligence.server";

export const metadata: Metadata = {
  title: "Finances · Executive finance",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function parseExecutiveFilters(
  sp: Record<string, string | string[] | undefined>
): ExecutiveFinanceDashboardFilters {
  const one = (key: string) => {
    const v = sp[`ex_${key}`] ?? sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  return {
    dateFrom: one("from"),
    dateTo: one("to"),
    clinicId: one("clinic"),
    procedureType: one("procedure"),
    source: one("source"),
    consultantFiUserId: one("consultant"),
  };
}

export default async function FinancialOsExecutivePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  const sp = (await searchParams) ?? {};
  const tid = tenantId?.trim();
  if (!tid) notFound();
  await assertFiTenantPortalAccess(tid);

  const filters = parseExecutiveFilters(sp);

  let data: Awaited<ReturnType<typeof loadExecutiveFinanceDetailPayload>>;
  let filterOptions: Awaited<ReturnType<typeof loadExecutiveFinanceFilterOptions>>;
  try {
    [data, filterOptions] = await Promise.all([
      loadExecutiveFinanceDetailPayload(tid, filters),
      loadExecutiveFinanceFilterOptions(tid),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    return (
      <div className="p-4 sm:p-6">
        <InfoNotice variant="danger" title="Executive finance could not load">
          <p className="text-sm">
            Apply migration{" "}
            <code className="rounded bg-white/10 px-1 text-xs">
              20260921120005_fi_financial_os_phase5_executive_finance_intelligence.sql
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
        <FinancialOsExecutiveDetailDashboard data={data} filterOptions={filterOptions} />
      </Suspense>
    </div>
  );
}
