import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { ReportLibraryClient } from "@/src/components/fi-admin/reports/ReportLibraryClient";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { REPORT_CATALOG } from "@/src/lib/reports/reportCatalog";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";

export const metadata = {
  title: "Reports library",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminReportsLibraryPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();
  const tid = tenantId.trim();

  await assertFiTenantPortalAccess(tid);
  try {
    await assertStaffModuleAccess(tid, "analytics_os", "read");
  } catch {
    // Allow portal members who can reach Reports; generate re-checks access.
  }

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

  const sp = (await searchParams) ?? {};
  const one = (key: string) => {
    const v = sp[key];
    if (typeof v === "string") return v.trim() || null;
    return null;
  };
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: one("from"),
    periodEnd: one("to"),
  });

  return (
    <div className={financialOsClasses.pageShell}>
      <ReportLibraryClient
        tenantId={tid}
        periodStart={period_start}
        periodEnd={period_end}
        catalog={REPORT_CATALOG}
      />
    </div>
  );
}
