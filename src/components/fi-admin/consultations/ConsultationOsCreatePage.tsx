"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";

export function ConsultationOsCreatePage({
  tenantId,
  showCrmNav,
  clinicalStaffOptions = [],
}: {
  tenantId: string;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
}) {
  return (
    <ConsultationOsWorkspace
      tenantId={tenantId}
      mode="create"
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
    />
  );
}
