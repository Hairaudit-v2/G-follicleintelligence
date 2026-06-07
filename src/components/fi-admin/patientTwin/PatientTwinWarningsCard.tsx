import { FiSection } from "@/src/components/fi-design/FiSection";
import { fiBadgeIntentClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";
import type { PatientTwinV1 } from "@/src/lib/patientTwin/patientTwinTypes";

function formatGenerated(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function warningTone(code: PatientTwinV1["warnings"][number]["code"]): keyof typeof fiBadgeIntentClassNames {
  if (code === "missing_case_linkage" || code === "missing_audit_linkage") return "info";
  if (code === "duplicate_media_risk" || code === "resolution_anomaly") return "warning";
  if (code === "missing_foundation_patient" || code === "unresolved_global_patient") return "warning";
  return "neutral";
}

export function PatientTwinWarningsCard({ twin }: { twin: PatientTwinV1 }) {
  const prov = twin.provenance;
  const list = twin.warnings;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-warnings-heading"
      title="Warnings & provenance"
      description="Operational signals and data lineage for this twin snapshot."
    >
      {list.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">No warnings for this snapshot.</p>
      ) : (
        <ul className="space-y-2">
          {list.map((w, i) => (
            <li
              key={`${w.code}:${i}`}
              className="flex flex-wrap items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5"
            >
              <span
                className={cn(
                  "shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
                  fiBadgeIntentClassNames[warningTone(w.code)]
                )}
              >
                {w.code.replace(/_/g, " ")}
              </span>
              <p className="min-w-0 flex-1 text-sm text-[#CBD5E1]">{w.message}</p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Provenance</h3>
        <dl className="mt-3 space-y-2 text-xs text-[#94A3B8]">
          <div className="flex flex-wrap gap-2">
            <dt className="text-[#64748B]">Generated</dt>
            <dd>{formatGenerated(prov.generated_at)}</dd>
          </div>
          <div className="flex flex-wrap gap-2">
            <dt className="text-[#64748B]">Loader</dt>
            <dd className="font-mono text-[#CBD5E1]">{prov.loader_version}</dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Views</dt>
            <dd className="mt-1 font-mono text-[0.65rem] leading-relaxed text-[#CBD5E1]">
              {prov.source_views_used.join(" · ")}
            </dd>
          </div>
          <div>
            <dt className="text-[#64748B]">Tables</dt>
            <dd className="mt-1 max-h-24 overflow-y-auto font-mono text-[0.65rem] leading-relaxed text-[#94A3B8]">
              {prov.source_tables_used.join(", ")}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-2">
            <dt className="text-[#64748B]">Completeness</dt>
            <dd>{prov.completeness_score === null ? "Not scored (V1)" : String(prov.completeness_score)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-[0.65rem] leading-relaxed text-[#64748B]">
          Twin V1 does not run AI inference. Intelligence fields on the payload are placeholders only.
        </p>
      </div>
    </FiSection>
  );
}
