import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffDirectoryClient } from "@/src/components/fi/staff/StaffDirectoryClient";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { parseStaffDirectoryFiltersFromSearchParams } from "@/src/lib/staff/staffDirectoryFilters";
import { loadStaffDirectoryPage } from "@/src/lib/staff/staffDirectoryLoader.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";

export const metadata = {
  title: "Workforce Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffDirectoryRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ staff_role?: string; payroll?: string; active?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const sp = await searchParams;
  if (!tenantId?.trim()) notFound();
  await assertStaffModuleAccess(tenantId, "workforce_os", "read");

  const initialFilters = parseStaffDirectoryFiltersFromSearchParams(sp);

  const [data, showCrmNav] = await Promise.all([
    loadStaffDirectoryPage(tenantId.trim()),
    getCrmShellNavAllowed(tenantId),
  ]);

  return (
    <StaffDirectoryClient
      tenantId={tenantId.trim()}
      data={data}
      showCrmNav={showCrmNav}
      initialFilters={initialFilters}
    />
  );
}
