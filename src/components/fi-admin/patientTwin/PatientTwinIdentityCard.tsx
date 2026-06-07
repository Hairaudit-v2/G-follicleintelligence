import { FiSection } from "@/src/components/fi-design/FiSection";
import { fiBadgeIntentClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

export function PatientTwinIdentityCard({ twin }: { twin: PatientTwinV1 }) {
  const { identity_resolution: idn, person } = twin;
  const hasSources = idn.source_ids.length > 0;
  const hasResWarnings = idn.resolution_warnings.length > 0;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-identity-heading"
      title="Identity & resolution"
      description="Foundation mapping, global bridge, and external source identifiers."
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

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Source IDs</h3>
        {!hasSources ? (
          <p className="mt-2 text-sm text-[#94A3B8]">No mapped source identifiers for this patient.</p>
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
