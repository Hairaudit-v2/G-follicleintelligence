import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

export function PatientPersonDetailsCard({ data }: { data: PatientProfileFoundationData }) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <h2 className="text-sm font-semibold text-slate-100">Person record</h2>
      <p className="mt-1 text-xs text-gray-500">
        Same identity resolution as the Contact details card; useful when comparing to the raw person row.
      </p>
      <dl className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-gray-500">Name</dt>
          <dd>{idc.fullName}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Preferred / display name</dt>
          <dd>{idc.preferredDisplayName ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Email</dt>
          <dd>{idc.primaryEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Phone</dt>
          <dd>{idc.primaryPhone ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Date of birth</dt>
          <dd>{idc.dateOfBirth ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Age</dt>
          <dd>{idc.ageYears != null ? `${idc.ageYears} years` : "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-gray-500">Address</dt>
          <dd>{idc.address ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
