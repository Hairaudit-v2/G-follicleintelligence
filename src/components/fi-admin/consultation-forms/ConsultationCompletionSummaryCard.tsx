import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import { FiCard } from "@/src/components/fi-design/FiCard";

function fmt(s: string): string {
  return s.replace(/_/g, " ");
}

function ListOrDash({ items }: { items: string[] }) {
  if (!items.length) return <span className="text-slate-500">—</span>;
  return (
    <ul className="list-inside list-disc text-sm text-slate-700 dark:text-slate-300">
      {items.map((x) => (
        <li key={x}>{fmt(x)}</li>
      ))}
    </ul>
  );
}

export function ConsultationCompletionSummaryCard({
  summary,
  isPreview,
}: {
  summary: ConsultationCompletionSummary;
  /** When true, banner indicates values are not yet persisted as completion. */
  isPreview?: boolean;
}) {
  return (
    <div className="space-y-4">
      {isPreview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          Preview — rules-based summary from current form answers. Click “Complete consultation” to save to the chart
          and lock this form.
        </p>
      ) : null}
      <FiCard className="space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">Consultation completion summary</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Source: {summary.source} · Completed {summary.completedAt ? new Date(summary.completedAt).toLocaleString() : "—"}
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outcome</dt>
            <dd className="mt-0.5 text-sm font-medium text-slate-900 dark:text-slate-100">{fmt(summary.outcomeType)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surgical / medical suitability</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
              {fmt(summary.surgicalSuitability)} · {fmt(summary.medicalSuitability)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary concern</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">{summary.primaryConcern.trim() || "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnosis impression</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
              {summary.diagnosisImpression.trim() || "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended procedure / plan</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
              {summary.recommendedProcedure.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated grafts</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
              {summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null
                ? `${summary.estimatedGraftsMin} – ${summary.estimatedGraftsMax}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pathology / screening</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
              {summary.pathologyRecommended ? "Recommended" : "Not flagged"}
              {summary.pathologyReason.trim() ? ` — ${summary.pathologyReason}` : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up</dt>
            <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-200">
              {summary.followUpRequired ? "Required" : "Not required"}
              {summary.followUpReason.trim() ? ` — ${summary.followUpReason}` : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
              {summary.quoteNotes.trim() || "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Risk flags</dt>
            <dd className="mt-1">
              <ListOrDash items={summary.riskFlags} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended zones</dt>
            <dd className="mt-1">
              <ListOrDash items={summary.recommendedZones} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended treatments</dt>
            <dd className="mt-1">
              <ListOrDash items={summary.recommendedTreatments} />
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Area map highlights</dt>
            <dd className="mt-1">
              {summary.areaMapHighlights.length === 0 ? (
                <span className="text-sm text-slate-500">—</span>
              ) : (
                <ul className="space-y-1 text-sm text-slate-700 dark:text-slate-300">
                  {summary.areaMapHighlights.map((h, i) => (
                    <li key={`${h.view}-${h.label}-${i}`}>
                      <span className="font-medium">{fmt(h.view)}</span>: {fmt(h.label)} ({fmt(h.severity)})
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinician notes preview</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">
              {summary.clinicianNotesPreview.trim() || "—"}
            </dd>
          </div>
        </dl>
      </FiCard>
    </div>
  );
}
