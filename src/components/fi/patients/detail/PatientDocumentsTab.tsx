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
        <h2 className="text-sm font-semibold text-slate-100">Documents</h2>
        <p className="mt-2 text-sm text-slate-400">
          Consent PDFs and a full document vault are not connected yet.{" "}
          <strong>Blood test request PDFs</strong> generated in DoctorOS are stored privately
          (patient storage) when you download or email them from a saved request, and appear on the
          patient&apos;s treatment timeline.
        </p>
      </section>
      <PatientAdminNotesCard tenantId={tenantId} data={data} />
      <PatientActivityCard tenantId={tenantId} data={data} />
    </div>
  );
}
