import { notFound } from "next/navigation";

import { ConsultationOsCreatePage } from "@/src/components/fi-admin/consultations/ConsultationOsCreatePage";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { loadClinicalStaffPickerOptions } from "@/src/lib/staff/clinicalStaffPickerLoader.server";

export const metadata = {
  title: "New consultation",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ConsultationOsNewRoutePage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  const [showCrmNav, clinicalStaffOptions] = await Promise.all([
    getCrmShellNavAllowed(tenantId.trim()),
    loadClinicalStaffPickerOptions(tenantId.trim()),
  ]);

  return (
    <ConsultationOsCreatePage
      tenantId={tenantId.trim()}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
    />
  );
}
