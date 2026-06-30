import { PatientActivityCard } from "../PatientActivityCard";
import { PatientAdminNotesCard } from "../PatientAdminNotesCard";
import { PatientConsentVaultCard } from "../PatientConsentVaultCard";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";

export function PatientDocumentsTab({
  tenantId,
  data,
}: {
  tenantId: string;
  data: PatientProfileFoundationData;
}) {
  return (
    <div className="space-y-4">
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