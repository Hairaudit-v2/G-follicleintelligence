"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { PatientTwinConsultationChecklistRow } from "@/src/lib/patientTwin/patientTwinTypes";
import type { ConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay,
  showCrmNav,
  clinicalStaffOptions = [],
  initialConsultationChecklistPreview = null,
  pathwayLauncher,
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay: ConsultationWorkspaceDisplay;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  initialConsultationChecklistPreview?: PatientTwinConsultationChecklistRow | null;
  pathwayLauncher: ConsultationPathwayLauncherViewModel;
}) {
  return (
    <ConsultationOsWorkspace
      key={`${consultationId}-${initialRow.updated_at}`}
      tenantId={tenantId}
      consultationId={consultationId}
      initialRow={initialRow}
      initialWorkspaceDisplay={initialWorkspaceDisplay}
      showCrmNav={showCrmNav}
      clinicalStaffOptions={clinicalStaffOptions}
      initialConsultationChecklistPreview={initialConsultationChecklistPreview}
      pathwayLauncher={pathwayLauncher}
    />
  );
}
