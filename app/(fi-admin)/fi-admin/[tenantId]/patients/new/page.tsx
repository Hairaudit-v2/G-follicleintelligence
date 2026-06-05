import { notFound } from "next/navigation";

import { NewPatientEntryPage } from "@/src/components/fi-admin/patients/NewPatientEntryPage";
import { getBookingsBoardNavAllowed, getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Add new patient",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewPatientEntryRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  const [showCrmNav, showBookingsBoard] = await Promise.all([
    getCrmShellNavAllowed(tenantId),
    getBookingsBoardNavAllowed(tenantId),
  ]);

  return <NewPatientEntryPage tenantId={tenantId} showCrmNav={showCrmNav} showBookingsBoard={showBookingsBoard} />;
}
