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

function severityTone(sev: PatientTwinV1["completeness"]["missing"][number]["severity"]): keyof typeof fiBadgeIntentClassNames {
  if (sev === "important") return "danger";
  if (sev === "warning") return "warning";
  return "info";
}

function priorityTone(p: PatientTwinV1["completeness"]["recommended_actions"][number]["priority"]): string {
  if (p === "high") return "border-rose-500/25 bg-rose-500/10 text-rose-50";
  if (p === "medium") return "border-amber-500/25 bg-amber-500/10 text-amber-50";
  return "border-slate-600/50 bg-white/[0.04] text-slate-200";
}

function bandLabel(band: PatientTwinV1["completeness"]["band"]): string {
  return band.charAt(0).toUpperCase() + band.slice(1);
}

export function PatientTwinWarningsCard({ twin }: { twin: PatientTwinV1 }) {
  const prov = twin.provenance;
  const list = twin.warnings;
  const c = twin.completeness;

  return (
    <FiSection
      surfaceVariant="darkGlass"
      headingId="patient-twin-warnings-heading"
      title="Warnings, completeness & provenance"
      description="Operational flags, record coverage (read-only score), and data lineage for this twin snapshot."
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

      <div
        id="patient-twin-completeness"
        className="mt-8 border-t border-white/[0.08] pt-8"
        aria-labelledby="patient-twin-completeness-subheading"
      >
        <h3 id="patient-twin-completeness-subheading" className="text-sm font-semibold text-[#F8FAFC]">
          Record completeness
        </h3>
        <p className="mt-1 text-xs text-[#64748B]">
          Coverage and AI-readiness (no inference). Bands: 0–39 poor · 40–64 partial · 65–84 good · 85–100 excellent.
        </p>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-4xl font-semibold tabular-nums tracking-tight text-white">{c.score}</p>
            <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">of 100</p>
          </div>
          <p
            className={cn(
              "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
              c.band === "excellent" || c.band === "good"
                ? fiBadgeIntentClassNames.complete
                : c.band === "partial"
                  ? fiBadgeIntentClassNames.warning
                  : fiBadgeIntentClassNames.danger
            )}
          >
            {bandLabel(c.band)}
          </p>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-sky-500"
            style={{ width: `${c.score}%` }}
            role="progressbar"
            aria-valuenow={c.score}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Completeness score"
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Gaps</h4>
            {c.missing.length === 0 ? (
              <p className="mt-2 text-sm text-[#94A3B8]">No structured gaps flagged.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {c.missing.map((m, i) => (
                  <li
                    key={`${m.area}-${i}`}
                    className="flex flex-wrap items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2"
                  >
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ring-1 ring-inset",
                        fiBadgeIntentClassNames[severityTone(m.severity)]
                      )}
                    >
                      {m.area}
                    </span>
                    <p className="min-w-0 flex-1 text-sm text-[#CBD5E1]">{m.label}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Strengths</h4>
            {c.strengths.length === 0 ? (
              <p className="mt-2 text-sm text-[#94A3B8]">No strengths listed — enrich linked data to raise the score.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {c.strengths.map((s, i) => (
                  <li
                    key={`${s.area}-${i}`}
                    className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2 text-sm text-[#D1FAE5]"
                  >
                    <span className="text-xs font-semibold text-emerald-200/90">{s.area}</span>
                    <p className="mt-0.5 text-[#ECFDF5]/90">{s.label}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-[#64748B]">Recommended actions</h4>
          {c.recommended_actions.length === 0 ? (
            <p className="mt-2 text-sm text-[#94A3B8]">No automated recommendations.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {c.recommended_actions.map((a, i) => (
                <li key={`${a.label}-${i}`} className={cn("rounded-xl border px-3 py-2.5", priorityTone(a.priority))}>
                  <p className="text-sm font-semibold text-white">{a.label}</p>
                  <p className="mt-1 text-xs text-[#E2E8F0]/85">{a.reason}</p>
                  <p className="mt-1 text-[0.65rem] font-medium uppercase tracking-wide text-[#94A3B8]">
                    Priority · {a.priority}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-white/[0.06] bg-gradient-to-br from-white/[0.04] to-transparent p-4">
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
            <dt className="text-[#64748B]">Completeness score (provenance)</dt>
            <dd className="tabular-nums text-[#E2E8F0]">
              {prov.completeness_score} · {bandLabel(c.band)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-[0.65rem] leading-relaxed text-[#64748B]">
          Twin V1 does not run AI inference. Intelligence fields on the payload are placeholders only.
        </p>
      </div>
    </FiSection>
  );
}
