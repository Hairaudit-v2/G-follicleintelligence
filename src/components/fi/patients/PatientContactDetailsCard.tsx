import type { PatientProfileFoundationData } from "@/src/lib/patients/patientProfileLoader";
import { derivePatientIdentityContact } from "@/src/lib/patients/patientIdentityContact";

function fmtConsent(v: boolean | null): string {
  if (v === true) return "Yes";
  if (v === false) return "No";
  return "—";
}

function fmtPreferred(m: string | null): string {
  if (!m) return "—";
  if (m === "both") return "Email & SMS";
  return m.charAt(0).toUpperCase() + m.slice(1);
}

export function PatientContactDetailsCard({ data }: { data: PatientProfileFoundationData }) {
  const idc = derivePatientIdentityContact({
    personMetadata: data.person.metadata,
    patientMetadata: data.patient.metadata,
    preferredContactMethod: data.patient.preferred_contact_method,
    reminderConsent: data.patient.reminder_consent,
  });

  const rows: { label: string; value: string }[] = [
    { label: "Full name", value: idc.fullName },
    { label: "Preferred / display name", value: idc.preferredDisplayName ?? "—" },
    { label: "Date of birth", value: idc.dateOfBirth ?? "—" },
    { label: "Age", value: idc.ageYears != null ? `${idc.ageYears} years` : "—" },
    { label: "Email", value: idc.primaryEmail ?? "—" },
    { label: "Phone", value: idc.primaryPhone ?? "—" },
    { label: "Address", value: idc.address ?? "—" },
    { label: "Preferred contact", value: fmtPreferred(idc.preferredContactMethod) },
    { label: "Reminder consent", value: fmtConsent(idc.reminderConsent) },
  ];

  return (
    <section className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40" aria-labelledby="patient-contact-details-heading">
      <h2 id="patient-contact-details-heading" className="text-sm font-semibold text-slate-100">
        Contact details
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Combined from the person record, patient record, and import metadata (for example HubSpot) when first-class
        columns are empty.
      </p>
      <dl className="mt-3 grid gap-2 text-sm text-slate-200 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="min-w-0">
            <dt className="text-xs font-medium text-gray-500">{r.label}</dt>
            <dd className="break-words">{r.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
