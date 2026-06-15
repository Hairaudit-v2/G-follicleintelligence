"use client";

import { ConsultationOsWorkspace } from "@/src/components/fi-admin/consultations/ConsultationOsWorkspace";
import type { ConsultationWorkspaceDisplay } from "@/src/lib/consultations/consultationLoaders.server";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";
import type { ClinicalStaffPickerOption } from "@/src/lib/staff/clinicalStaffPicker";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import type { PatientTwinConsultationChecklistRow } from "@/src/lib/patientTwin/patientTwinTypes";
import type { ConsultationPathwayLauncherViewModel } from "@/src/lib/consultations/consultationPathwayLauncherModel";

export function ConsultationOsEditPage({
  tenantId,
  consultationId,
  initialRow,
  initialWorkspaceDisplay,
  showCrmNav,
  clinicalStaffOptions = [],
  operationalTodayYmd,
  initialPaymentRecords = [],
  canMutatePaymentRecords = false,
  initialConsultationChecklistPreview = null,
  pathwayLauncher,
}: {
  tenantId: string;
  consultationId: string;
  initialRow: ConsultationRow;
  initialWorkspaceDisplay: ConsultationWorkspaceDisplay;
  showCrmNav: boolean;
  clinicalStaffOptions?: ClinicalStaffPickerOption[];
  operationalTodayYmd: string;
  initialPaymentRecords?: PaymentRecordRow[];
  canMutatePaymentRecords?: boolean;
  initialConsultationChecklistPreview?: PatientTwinConsultationChecklistRow | null;
  pathwayLauncher: ConsultationPathwayLauncherViewModel;
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
      operationalTodayYmd={operationalTodayYmd}
      initialPaymentRecords={initialPaymentRecords}
      canMutatePaymentRecords={canMutatePaymentRecords}
      initialConsultationChecklistPreview={initialConsultationChecklistPreview}
      pathwayLauncher={pathwayLauncher}
    />
  );
}
