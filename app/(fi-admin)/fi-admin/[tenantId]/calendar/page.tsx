import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ClinicOsCalendarHome } from "@/src/components/fi-admin/calendar/ClinicOsCalendarHome";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TenantCalendarPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  const showCrmNav = await getCrmShellNavAllowed(tenantId);

  return <ClinicOsCalendarHome tenantId={tenantId.trim()} showCrmNav={showCrmNav} />;
}
