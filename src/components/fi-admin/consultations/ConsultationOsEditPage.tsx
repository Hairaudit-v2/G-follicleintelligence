"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay,
  showCrmNav,
  clinicalStaffOptions = [],
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay: ConsultationWorkspaceDisplay;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
}) {
  return (
    <ConsultationOsWorkspace
      key={consultationId}
      tenantId={tenantId}
      mode="edit"
      consultationId={consultationId}
      initialRow={initialRow}
      initialWorkspaceDisplay={initialWorkspaceDisplay}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
    />
  );
}
