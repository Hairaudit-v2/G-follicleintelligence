import { PatientActivityCard } from "../PatientActivityCard";
import { PatientAdminNotesCard } from "../PatientAdminNotesCard";
import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { crmLeadCardClass } from "@/src/components/fi/crm/shared/crmSharedStyles";

export function PatientDocumentsTab({
  tenantId,
  data,
}: {
  tenantId: string;
  data: PatientProfileFoundationData;
}) {
  return (
    <div className="space-y-4">
      <section className={crmLeadCardClass}>
        <h2 className="text-sm font-semibold text-gray-900">Documents</h2>
        <p className="mt-2 text-sm text-gray-600">
          Consent PDFs, signed treatment plans, and external document storage are not connected yet. Use admin notes and
          CRM activity below until a patient document vault ships.
        </p>
      </section>
      <PatientAdminNotesCard tenantId={tenantId} data={data} />
      <PatientActivityCard tenantId={tenantId} data={data} />
    </div>
  );
}
