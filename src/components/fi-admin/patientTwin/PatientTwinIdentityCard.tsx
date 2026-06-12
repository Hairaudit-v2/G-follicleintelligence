import { FiSection } from "@/src/components/fi-design/FiSection";
import { fiBadgeIntentClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function row(label: string, value: string | null | undefined) {
  const v = value?.trim();
  return (
    <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] py-1.5 last:border-b-0">
      <dt className="text-[#94A3B8]">{label}</dt>
      <dd className="max-w-[min(100%,20rem)] text-right text-[#E2E8F0]">{v && v.length > 0 ? v : "—"}</dd>
    </div>
  );
}

export function PatientTwinIdentityCard({ twin }: { twin: PatientTwinV1 }) {
  const { identity_resolution: idn, person } = twin;
  const hasSources = idn.source_ids.length > 0;
  const hasResWarnings = idn.resolution_warnings.length > 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-identity-heading"
      title="Identity & resolution"
      description="Foundation mapping, global bridge, external source identifiers, and resolved contact profile."
    >
      <dl className="space-y-3 text-sm text-[#E2E8F0]">
        <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
          <dt className="text-[#94A3B8]">Person</dt>
          <dd className="font-mono text-xs text-[#CBD5E1]">{person.person_id ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
          <dt className="text-[#94A3B8]">Foundation patient</dt>
          <dd className="break-all font-mono text-xs text-[#CBD5E1]">{idn.foundation_patient_id ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-b border-white/[0.06] pb-2">
          <dt className="text-[#94A3B8]">Global patient</dt>
          <dd className="break-all font-mono text-xs text-[#CBD5E1]">{idn.global_patient_id ?? "—"}</dd>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[#94A3B8]">Duplicate risk</span>
          <span
            className={cn(
              "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
              idn.duplicate_risk ? fiBadgeIntentClassNames.warning : fiBadgeIntentClassNames.complete
            )}
          >
            {idn.duplicate_risk ? "Elevated" : "Low"}
          </span>
        </div>
      </dl>

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Contact & profile</h3>
        <dl className="mt-2 text-sm">
          {row("Display name", person.display_name)}
          {row("Email", person.email)}
          {row("Phone", person.phone)}
          {row("Date of birth", person.date_of_birth)}
          {row("Address", person.address)}
          {row("Preferred contact", person.preferred_contact_method)}
          {row(
            "Reminder consent",
            person.reminder_consent === true ? "Yes" : person.reminder_consent === false ? "No" : null
          )}
          {row("HubSpot record ID", person.hubspot_record_id)}
          {row("Lifecycle stage", person.lifecycle_stage)}
          {row("Lead status", person.lead_status)}
          {row("Stage of journey", person.stage_of_journey)}
          {row("Import batch", person.import_batch_id)}
        </dl>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Source IDs</h3>
        {!hasSources ? (
          <p className="mt-2 text-sm text-[#94A3B8]">No mapped patient-level source identifiers for this patient.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {idn.source_ids.map((s) => (
              <li
                key={`${s.source_system}:${s.source_patient_id}`}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-[#E2E8F0]"
              >
                <span className="font-medium text-cyan-200/90">{s.source_system}</span>
                <span className="text-[#64748B]"> · </span>
                <span className="font-mono text-[#CBD5E1]">{s.source_patient_id}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasResWarnings ? (
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-100/90">Resolution notes</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-50/90">
            {idn.resolution_warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </FiSection>
  );
}
