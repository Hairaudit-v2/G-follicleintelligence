import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";
import { PatientTwinNavLink } from "@/src/components/fi-admin/patientTwin/PatientTwinNavLink";
import { PatientStatusBadge } from "./PatientStatusBadge";

export function PatientProfileHeader({
  tenantId,
  data,
}: {
  tenantId: string;
  data: PatientProfileFoundationData;
}) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  return (
    <header className="space-y-2 border-b border-white/[0.08] pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">{idc.fullName}</h1>
          <p className="text-sm text-slate-400">
            {idc.primaryEmail ?? "—"} · {idc.primaryPhone ?? "—"}
          </p>
          {idc.dateOfBirth ? (
            <p className="text-sm text-slate-400">
              <span className="text-gray-500">DOB </span>
              <time dateTime={idc.dateOfBirth}>{idc.dateOfBirth}</time>
              {idc.ageYears != null ? ` · ${idc.ageYears} years` : null}
            </p>
          ) : null}
        </div>
        <div className="flex max-w-full flex-shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <PatientTwinNavLink tenantId={tenantId} patientId={data.foundationPatientId} />
          <PatientStatusBadge status={data.patient.patient_status} />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Patient since <time dateTime={data.patient.created_at}>{data.patient.created_at.slice(0, 10)}</time> · ID{" "}
        <code className="rounded bg-white/[0.06] px-1">{data.foundationPatientId}</code>
      </p>
    </header>
  );
}
