import Link from "next/link";
import type { CasePatientLink } from "@/src/lib/cases/caseLoaders";

export function CaseLinkedPatientCard({ tenantId, patient }: { tenantId: string; patient: CasePatientLink | null }) {
  return (
    <section className="rounded border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">Linked patient / person</h2>
      {!patient ? (
        <p className="mt-2 text-sm text-gray-500">No foundation patient is linked to this case yet.</p>
      ) : (
        <dl className="mt-3 space-y-2 text-sm">
          <div>
            <dt className="text-xs font-medium text-gray-500">Person</dt>
            <dd className="text-gray-900">{patient.person_label}</dd>
          </div>
          {patient.person_email ? (
            <div>
              <dt className="text-xs font-medium text-gray-500">Email</dt>
              <dd className="text-gray-800">{patient.person_email}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs font-medium text-gray-500">Patient record</dt>
            <dd>
              <Link
                href={`/fi-admin/${tenantId}/patients/${patient.foundation_patient_id}`}
                className="text-blue-600 hover:underline"
              >
                Open patient profile
              </Link>
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
