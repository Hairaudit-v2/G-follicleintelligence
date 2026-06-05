import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { ClinicOsPatientsHome } from "@/src/components/fi-admin/patients/ClinicOsPatientsHome";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Patients",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PatientsHomeRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);
  const showCrmNav = await getCrmShellNavAllowed(tenantId);
  const clinicOsShellEnabled = process.env.NEXT_PUBLIC_FI_CLINIC_OS_SHELL === "true";

  return (
    <ClinicOsPatientsHome tenantId={tenantId.trim()} showCrmNav={showCrmNav} clinicOsShellEnabled={clinicOsShellEnabled} />
  );
}
