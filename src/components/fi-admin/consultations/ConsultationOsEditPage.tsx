"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { PatientTwinConsultationChecklistRow } from "@/src/lib/patientTwin/patientTwinTypes";
import type { ConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";
import type { ConsultationTrichoscopyHubInitial } from "@/src/lib/integrations/hliTrichoscopy/consultation/hubInitial";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay,
  showCrmNav,
  clinicalStaffOptions = [],
  initialConsultationChecklistPreview = null,
  pathwayLauncher,
  trichoscopyInitial = null,
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay: ConsultationWorkspaceDisplay;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  initialConsultationChecklistPreview?: PatientTwinConsultationChecklistRow | null;
  pathwayLauncher: ConsultationPathwayLauncherViewModel;
  trichoscopyInitial?: ConsultationTrichoscopyHubInitial | null;
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
      trichoscopyInitial={trichoscopyInitial}
    />
  );
}
