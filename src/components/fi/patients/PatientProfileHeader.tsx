import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { displayFromPersonMetadata } from "@/src/lib/patients/patientLabels";
import { PatientStatusBadge } from "./PatientStatusBadge";

export function PatientProfileHeader({ data }: { data: PatientProfileFoundationData }) {
  const { name, email, phone } = displayFromPersonMetadata(data.person.metadata);
  return (
    <header className="space-y-2 border-b border-gray-200 pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{name}</h1>
          <p className="text-sm text-gray-600">
            {email ?? "—"} · {phone ?? "—"}
          </p>
        </div>
        <PatientStatusBadge status={data.patient.patient_status} />
      </div>
      <p className="text-xs text-gray-500">
        Patient since <time dateTime={data.patient.created_at}>{data.patient.created_at.slice(0, 10)}</time> · ID{" "}
        <code className="rounded bg-gray-100 px-1">{data.foundationPatientId}</code>
      </p>
    </header>
  );
}
