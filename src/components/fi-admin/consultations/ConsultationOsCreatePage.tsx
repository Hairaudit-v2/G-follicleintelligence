"use client";

import { ConsultationOsPathwayCreateWizard } from "@/src/components/fi-admin/consultations/ConsultationOsPathwayCreateWizard";
import type { ClinicalStaffPickerOption } from "@/src/lib/team/directory";

export function ConsultationOsCreatePage({
  tenantId,
  showCrmNav,
  clinicalStaffOptions = [],
  operationalTodayYmd,
}: {
  tenantId: string;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  operationalTodayYmd: string;
}) {
  return (
    <ConsultationOsPathwayCreateWizard
      tenantId={tenantId}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
      operationalTodayYmd={operationalTodayYmd}
    />
  );
}
