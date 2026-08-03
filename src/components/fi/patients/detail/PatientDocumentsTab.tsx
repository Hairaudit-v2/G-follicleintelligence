import { PatientActivityCard } from "../PatientActivityCard";
import { PatientAdminNotesCard } from "../PatientAdminNotesCard";
import { PatientConsentVaultCard } from "../PatientConsentVaultCard";
import { PatientRequiredConsentsPanel } from "../PatientRequiredConsentsPanel";
import type { PatientRequiredConsentsPanelData } from "@/src/lib/consents/consentTypes";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientDocumentsTab({
  tenantId,
  data,
  requiredConsents,
}: {
  tenantId: string;
  data: PatientProfileFoundationData;
  requiredConsents?: PatientRequiredConsentsPanelData | null;
}) {
  return (
    <div className="space-y-4">
      {requiredConsents ? (
        <PatientRequiredConsentsPanel
          tenantId={tenantId}
          patientId={data.foundationPatientId}
          data={requiredConsents}
        />
      ) : null}
      <PatientConsentVaultCard
        tenantId={tenantId}
        patientId={data.foundationPatientId}
        trialConsentGate={data.trialConsentGate}
      />
      <PatientAdminNotesCard tenantId={tenantId} data={data} />
      <PatientActivityCard tenantId={tenantId} data={data} />
    </div>
  );
}
