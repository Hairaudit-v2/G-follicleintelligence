import { notFound } from "next/navigation";

import { NewBookingEntryPage } from "@/src/components/fi-admin/bookings/NewBookingEntryPage";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Book appointment",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewBookingEntryRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  const showCrmNav = await getCrmShellNavAllowed(tenantId);

  return <NewBookingEntryPage tenantId={tenantId} showCrmNav={showCrmNav} />;
}
