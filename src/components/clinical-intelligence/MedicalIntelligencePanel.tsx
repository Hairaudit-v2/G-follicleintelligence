import Link from "next/link";
import type {
  FiMedicalIntelligenceClinicalFlag,
  FiMedicalIntelligenceDisplay,
  FiMedicalIntelligenceInterpretationStatus,
  FiMedicalIntelligenceTwinSummary,
} from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";

const CLINICAL_FLAG_LABELS: Record<Exclude<FiMedicalIntelligenceClinicalFlag, null>, string> = {
  Fe: "Iron (Fe)",
  T: "Thyroid (T)",
  A: "Nutrition (A)",
  "⊕": "Supplement / nutrition (⊕)",
  "!": "Attention (!)",
};

const STATUS_STYLES: Record<FiMedicalIntelligenceInterpretationStatus, string> = {
  optimal: "bg-emerald-500/15 text-emerald-200",
  normal: "bg-white/[0.06] text-slate-200",
  low: "bg-amber-500/15 text-amber-200",
  high: "bg-amber-500/15 text-amber-200",
  critical: "bg-rose-500/15 text-rose-200",
  unknown: "bg-white/[0.04] text-slate-400",
};

function StatusBadge({ status }: { status: FiMedicalIntelligenceInterpretationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

function ClinicalFlagBadge({ flag }: { flag: Exclude<FiMedicalIntelligenceClinicalFlag, null> }) {
  return (
    <span className="inline-flex rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-medium text-violet-200">
      {CLINICAL_FLAG_LABELS[flag]}
    </span>
  );
}

function InsightList({ items, empty }: { items: string[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-gray-500">{empty}</p>;
  }
  return (
    <ul className="list-disc space-y-1 pl-4 text-sm text-slate-200">
      {items.map((item, idx) => (
        <li key={`${item.slice(0, 24)}-${idx}`}>{item}</li>
      ))}
    </ul>
  );
}

export function MedicalIntelligencePanel({
  intelligence,
  compact = false,
}: {
  intelligence: FiMedicalIntelligenceDisplay;
  compact?: boolean;
}) {
  const { interpretedMarkers, clinicalFlags, activeDrivers, clinicianInsights } = intelligence;

  return (
    <section className="rounded border border-violet-500/25 bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Medical Intelligence</h2>
          <p className="mt-1 text-xs text-slate-400">
            Source: {intelligence.source} · read-only shared interpretation
          </p>
        </div>
        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
          Clinician review required
        </span>
      </div>

      <p className="rounded border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-xs text-amber-100/90">
        Shared HLI medical intelligence is decision support only. It does not change surgery
        readiness, create treatment recommendations, or replace clinician review.
      </p>

      {clinicalFlags.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Clinical flags
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {clinicalFlags.map((flag) => (
              <li key={flag}>
                <ClinicalFlagBadge flag={flag} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {activeDrivers.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Active drivers
          </h3>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-violet-100">
            {activeDrivers.map((driver) => (
              <li
                key={driver}
                className="rounded-full bg-violet-500/10 px-2 py-1 font-medium"
              >
                {driver}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!compact ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Clinician insights
          </h3>
          <div className="mt-2">
            <InsightList items={clinicianInsights} empty="No shared insights for these markers." />
          </div>
        </div>
      ) : null}

      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Interpreted markers
          </h3>
          <span className="text-[10px] text-gray-500">
            {interpretedMarkers.length} interpreted
            {intelligence.skippedMarkerCount > 0
              ? ` · ${intelligence.skippedMarkerCount} skipped (non-numeric / unlabeled)`
              : ""}
            {intelligence.fromSnapshot ? " · snapshot" : ""}
          </span>
        </div>
        {interpretedMarkers.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">No markers could be interpreted.</p>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/[0.08] text-slate-400">
                  <th className="py-1 pr-2 font-medium">Marker</th>
                  <th className="py-1 pr-2 font-medium">Value</th>
                  <th className="py-1 pr-2 font-medium">Status</th>
                  <th className="py-1 pr-2 font-medium">Flag</th>
                  {!compact ? (
                    <th className="py-1 pr-2 font-medium">Explanation</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {interpretedMarkers.map((m) => (
                  <tr key={`${m.marker}-${m.value}`} className="border-b border-white/[0.06] align-top">
                    <td className="py-1 pr-2 font-medium text-slate-100">{m.marker}</td>
                    <td className="py-1 pr-2 text-slate-200">
                      {m.value}
                      {m.unit ? ` ${m.unit}` : ""}
                    </td>
                    <td className="py-1 pr-2">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="py-1 pr-2">
                      {m.clinical_flag ? <ClinicalFlagBadge flag={m.clinical_flag} /> : "—"}
                    </td>
                    {!compact ? (
                      <td className="py-1 pr-2 text-slate-400">{m.explanation}</td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function MedicalIntelligenceTwinSummary({
  summary,
  tenantId,
  patientId,
}: {
  summary: FiMedicalIntelligenceTwinSummary;
  tenantId: string;
  patientId: string;
}) {
  return (
    <div className="mt-4 rounded border border-violet-500/20 bg-violet-500/5 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200">
            Medical Intelligence
          </h3>
          <p className="mt-1 text-xs text-violet-100/80">
            {summary.result_date} · {summary.status} · {summary.interpreted_marker_count} marker(s)
            · Clinician review required
          </p>
        </div>
        <Link
          href={`/fi-admin/${tenantId}/patients/${patientId}/blood-results/${summary.pathology_result_id}`}
          className="text-xs font-medium text-cyan-300 hover:underline"
        >
          Open result
        </Link>
      </div>
      {summary.clinical_flags.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {summary.clinical_flags.map((flag) => (
            <li key={flag}>
              <ClinicalFlagBadge flag={flag} />
            </li>
          ))}
        </ul>
      ) : null}
      {summary.active_drivers.length > 0 ? (
        <p className="mt-2 text-sm text-violet-100">
          Drivers: {summary.active_drivers.join(", ")}
        </p>
      ) : null}
      {summary.insight_preview ? (
        <p className="mt-2 text-sm text-violet-100/90">{summary.insight_preview}</p>
      ) : null}
    </div>
  );
}
