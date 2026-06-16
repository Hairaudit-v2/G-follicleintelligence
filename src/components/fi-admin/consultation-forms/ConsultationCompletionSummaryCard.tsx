import type { ReactNode } from "react";
import type { ConsultationCompletionSummary } from "@/src/lib/consultationForms/completion/consultationCompletionTypes";
import {
  FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
} from "@/src/lib/consultationForms/consultationFormConstants";
import { labelDisplayForBodyAreaMap } from "@/src/lib/consultationForms/bodyAreaMapModel";
import { cn } from "@/lib/utils";
import { FiCard } from "@/src/components/fi-design/FiCard";
import { fiOsLightFormSurfaceClassNames } from "@/src/components/fi-design/fiDesignTokens";

function fmt(s: string): string {
  return s.replace(/_/g, " ");
}

function ListOrDash({ items }: { items: string[] }) {
  if (!items.length) return <span className={fiOsLightFormSurfaceClassNames.meta}>—</span>;
  return (
    <ul className={cn("list-inside list-disc text-sm", fiOsLightFormSurfaceClassNames.body)}>
      {items.map((x) => (
        <li key={x}>{fmt(x)}</li>
      ))}
    </ul>
  );
}

function SectionBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h4>
      <div className={cn("mt-1.5 text-sm leading-relaxed text-slate-800", fiOsLightFormSurfaceClassNames.body)}>{children}</div>
    </section>
  );
}

function HairTransplantCompletionBrief({
  summary,
  isPreview,
}: {
  summary: ConsultationCompletionSummary;
  isPreview?: boolean;
}) {
  const graftLine =
    summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null
      ? `${summary.estimatedGraftsMin}–${summary.estimatedGraftsMax} grafts discussed`
      : null;

  const zonesTreats = [summary.recommendedZones.join(", "), summary.recommendedTreatments.join(", ")].filter(Boolean).join(" · ");

  const mapLine =
    summary.areaMapHighlights.length === 0
      ? null
      : summary.areaMapHighlights
          .map((h) => `${labelDisplayForBodyAreaMap(h.label)} (${fmt(h.severity)}) — ${h.view}`)
          .join(" · ");

  const risksLine = summary.riskFlags.length ? summary.riskFlags.map((x) => fmt(x)).join(", ") : "None recorded on checklist.";

  const nextParts: string[] = [];
  if (summary.pathologyRecommended) {
    nextParts.push(`Screening / labs: recommended${summary.pathologyReason.trim() ? ` — ${summary.pathologyReason.trim()}` : ""}.`);
  } else {
    nextParts.push("Screening / labs: not flagged from this encounter.");
  }
  if (summary.followUpRequired) {
    nextParts.push(`Follow-up: yes${summary.followUpReason.trim() ? ` — ${summary.followUpReason.trim()}` : ""}.`);
  } else {
    nextParts.push("Follow-up: not explicitly required.");
  }
  if (summary.quoteNotes.trim() && summary.quoteNotes.trim().length <= 200) {
    nextParts.push(`Quote / consent context: ${summary.quoteNotes.trim()}`);
  }

  return (
    <div className="space-y-4">
      {isPreview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
          Review mode — summary reflects current answers. Complete consultation to persist to the chart and lock the form.
        </p>
      ) : null}
      <FiCard className="space-y-5 p-4 sm:p-5">
        <header>
          <h3 className="text-base font-semibold text-slate-900">Clinical decision snapshot</h3>
          <p className={cn("mt-1 text-xs", fiOsLightFormSurfaceClassNames.meta)}>
            {summary.completedAt ? new Date(summary.completedAt).toLocaleString() : "—"}
          </p>
        </header>

        <div className="space-y-5">
          <SectionBlock title="Patient concern">
            <p>{summary.primaryConcern.trim() || "—"}</p>
          </SectionBlock>

          <SectionBlock title="Diagnosis">
            <p className="whitespace-pre-wrap">{summary.diagnosisImpression.trim() || "—"}</p>
          </SectionBlock>

          <SectionBlock title="Recommendation">
            <p className="whitespace-pre-wrap font-medium">
              {summary.recommendedProcedure.trim() || "—"}
              {summary.outcomeType && summary.outcomeType !== "undecided" ? (
                <span className="mt-1 block text-xs font-normal text-slate-600">Outcome: {fmt(summary.outcomeType)}</span>
              ) : null}
            </p>
          </SectionBlock>

          <SectionBlock title="Surgical assessment">
            <p>
              Surgical suitability: <span className="font-medium">{fmt(summary.surgicalSuitability)}</span>
              {" · "}
              Medical suitability: <span className="font-medium">{fmt(summary.medicalSuitability)}</span>
            </p>
            {graftLine ? <p className="mt-2">{graftLine}</p> : null}
            {zonesTreats ? <p className="mt-2 text-xs text-slate-600">Zones / therapies: {zonesTreats}</p> : null}
            {mapLine ? <p className="mt-2 text-xs text-slate-600">Concern map: {mapLine}</p> : null}
          </SectionBlock>

          <SectionBlock title="Risks / considerations">
            <p>{risksLine}</p>
          </SectionBlock>

          <SectionBlock title="Next step">
            {nextParts.map((p) => (
              <p key={p} className="mb-2 last:mb-0">
                {p}
              </p>
            ))}
          </SectionBlock>
        </div>
      </FiCard>
    </div>
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
  if (summary.templateSlug.trim() === HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG) {
    return <HairTransplantCompletionBrief summary={summary} isPreview={isPreview} />;
  }

  return (
    <div className="space-y-4">
      {isPreview ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-950">
          Preview — rules-based summary from current form answers. Click “Complete consultation” to save to the chart
          and lock this form.
        </p>
      ) : null}
      <FiCard className="space-y-4 p-4 sm:p-5">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Consultation completion summary</h3>
          <p className={cn("mt-1", fiOsLightFormSurfaceClassNames.meta)}>
            Source: {summary.source} · Completed {summary.completedAt ? new Date(summary.completedAt).toLocaleString() : "—"}
          </p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Outcome</dt>
            <dd className={cn("mt-0.5 text-sm font-medium", fiOsLightFormSurfaceClassNames.body)}>{fmt(summary.outcomeType)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Surgical / medical suitability</dt>
            <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {fmt(summary.surgicalSuitability)} · {fmt(summary.medicalSuitability)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primary concern</dt>
            <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>{summary.primaryConcern.trim() || "—"}</dd>
          </div>
          {summary.templateSlug === HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG ||
          summary.templateSlug === FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG ? (
            <>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hair loss pattern</dt>
                <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.hairLossPatternTypeLabel?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Blood analysis</dt>
                <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.bloodAnalysisRecommended ? "Recommended" : "Not flagged"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Treatment priority</dt>
                <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.treatmentPriorityLabel?.trim() || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Treatment timeline</dt>
                <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.treatmentTimelineLabel?.trim() || "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">HLI / Patient Twin pathway</dt>
                <dd className={cn("mt-0.5 text-sm font-medium text-violet-900", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.hliPathwayRecommendedLabel?.trim() || "—"}
                </dd>
              </div>
            </>
          ) : null}
          {summary.templateSlug === FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG && summary.femaleHairLossCompletionSnapshot ? (
            <>
              <div className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Female pathway snapshot</dt>
                <dd className={cn("mt-0.5 space-y-1 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  <p>
                    <span className="font-medium">Duration: </span>
                    {summary.femaleHairLossCompletionSnapshot.durationLabel}
                  </p>
                  <p>
                    <span className="font-medium">Shedding: </span>
                    {summary.femaleHairLossCompletionSnapshot.sheddingLabel}
                  </p>
                  <p>
                    <span className="font-medium">Ludwig / Sinclair: </span>
                    {summary.femaleHairLossCompletionSnapshot.femaleScaleSummary}
                  </p>
                  <p>
                    <span className="font-medium">Hormonal / systemic: </span>
                    {summary.femaleHairLossCompletionSnapshot.hormonalSystemicSummary}
                  </p>
                  <p>
                    <span className="font-medium">Ferritin history: </span>
                    {summary.femaleHairLossCompletionSnapshot.ferritinLabel}
                  </p>
                  <p>
                    <span className="font-medium">Thyroid history: </span>
                    {summary.femaleHairLossCompletionSnapshot.thyroidLabel}
                  </p>
                  <p>
                    <span className="font-medium">Blood / pathology: </span>
                    {summary.femaleHairLossCompletionSnapshot.bloodPathologySummary}
                  </p>
                  <p>
                    <span className="font-medium">Follow-up urgency: </span>
                    {summary.femaleHairLossCompletionSnapshot.followUpUrgencyLabel}
                  </p>
                </dd>
              </div>
            </>
          ) : null}
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Diagnosis impression</dt>
            <dd className={cn("mt-0.5 whitespace-pre-wrap text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.diagnosisImpression.trim() || "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recommended procedure / plan</dt>
            <dd className={cn("mt-0.5 whitespace-pre-wrap text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.recommendedProcedure.trim() || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estimated grafts</dt>
            <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.estimatedGraftsMin != null && summary.estimatedGraftsMax != null
                ? `${summary.estimatedGraftsMin} – ${summary.estimatedGraftsMax}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pathology / screening</dt>
            <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.pathologyRecommended ? "Recommended" : "Not flagged"}
              {summary.pathologyReason.trim() ? ` — ${summary.pathologyReason}` : null}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-up</dt>
            <dd className={cn("mt-0.5 text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.followUpRequired ? "Required" : "Not required"}
              {summary.followUpReason.trim() ? ` — ${summary.followUpReason}` : null}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote notes</dt>
            <dd className={cn("mt-0.5 whitespace-pre-wrap text-sm", fiOsLightFormSurfaceClassNames.body)}>
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
                <span className={fiOsLightFormSurfaceClassNames.meta}>—</span>
              ) : (
                <ul className={cn("space-y-1 text-sm", fiOsLightFormSurfaceClassNames.body)}>
                  {summary.areaMapHighlights.map((h, i) => (
                    <li key={`${h.view}-${h.label}-${i}`}>
                      <span className="font-medium">{h.view}</span>: {labelDisplayForBodyAreaMap(h.label)} ({fmt(h.severity)})
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clinician notes preview</dt>
            <dd className={cn("mt-0.5 whitespace-pre-wrap text-sm", fiOsLightFormSurfaceClassNames.body)}>
              {summary.clinicianNotesPreview.trim() || "—"}
            </dd>
          </div>
        </dl>
      </FiCard>
    </div>
  );
}
