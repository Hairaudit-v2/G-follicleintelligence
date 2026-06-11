import { FiSection } from "@/src/components/fi-design/FiSection";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export function PatientTwinClinicalCard({ twin }: { twin: PatientTwinV1 }) {
  const p = twin.clinical.structured_profile;
  const hasAny =
    p != null &&
    (p.norwood_scale ||
      p.ludwig_scale ||
      p.hairline_pattern ||
      p.primary_concern ||
      p.treatment_interest);

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-clinical-heading"
      title="Clinical (bounded)"
      description="Structured scales and interest fields only — no narrative or imaging URLs. MedicationOS therapy appears on the MedicationOS card."
    >
      {twin.person.date_of_birth ? (
        <p className="mb-3 text-sm text-[#CBD5E1]">
          <span className="text-[#64748B]">Date of birth </span>
          {twin.person.date_of_birth}
        </p>
      ) : null}

      {!hasAny ? (
        <p className="text-sm text-[#94A3B8]">No structured clinical profile row for this patient.</p>
      ) : (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["Norwood", p?.norwood_scale],
            ["Ludwig", p?.ludwig_scale],
            ["Hairline pattern", p?.hairline_pattern],
            ["Primary concern", p?.primary_concern],
            ["Treatment interest", p?.treatment_interest],
          ].map(([label, val]) => (
            <div key={String(label)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-[#64748B]">{label}</dt>
              <dd className="mt-0.5 text-[#E2E8F0]">{val && String(val).trim() ? String(val) : "—"}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="mt-4 text-xs leading-relaxed text-[#64748B]">
        Free-text history and blood markers stay off Twin V1; MedicationOS therapy read model is on the adjacent card.
      </p>
    </FiSection>
  );
}
