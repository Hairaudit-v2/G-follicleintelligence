import Link from "next/link";

import { CASE_DETAIL_SECTION_IDS } from "@/src/lib/cases/caseDetailNavConstants";
import type { PatientIntelligenceOverviewModel } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import {
  formatGraftCount,
  OVERVIEW_SECTION_HEADINGS,
} from "@/src/lib/patientTwin/patientTwinOverviewCopy";
import { OVERVIEW_SECTION_IDS } from "@/src/lib/patientTwin/patientTwinOverviewTypes";
import { isDemonstrationOrFutureMilestone } from "@/src/lib/patientTwin/patientTwinOutcomesCore";
import { OverviewAvailabilityBadge } from "./OverviewAvailabilityBadge";
import { PatientTwinEconomicsStrip } from "./PatientTwinEconomicsStrip";
import { PatientTwinWorkforceStrip } from "./PatientTwinWorkforceStrip";
import { PatientTwinSurgicalStoryStrips } from "./PatientTwinSurgicalStoryStrips";
import { DemoDayPresenterCues } from "./DemoDayPresenterCues";

function SummarySection({ overview }: { overview: PatientIntelligenceOverviewModel }) {
  const s = overview.summary;
  return (
    <section
      id={OVERVIEW_SECTION_IDS.summary}
      className="scroll-mt-4 rounded-xl border border-white/[0.1] bg-gradient-to-br from-[#102a45]/80 via-[#0c1629]/90 to-[#050a14]/95 p-5"
      aria-labelledby="overview-summary-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-cyan-300/90">
            Health record · Overview
          </p>
          <h2
            id="overview-summary-heading"
            className="text-xl font-semibold tracking-tight text-white sm:text-2xl"
          >
            {s.displayName}
            {s.ageYears != null ? (
              <span className="font-normal text-slate-300">, {s.ageYears}</span>
            ) : null}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs">
            {s.stagingLabel ? (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                {s.stagingLabel}
              </span>
            ) : null}
            {s.lifecycleStage ? (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-200">
                Stage · {s.lifecycleStage}
              </span>
            ) : null}
            {s.showcase.isShowcase ? (
              <span className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-1 text-cyan-100">
                Demo showcase
              </span>
            ) : null}
            {s.packageContextLabel ? (
              <span className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-slate-300">
                {s.packageContextLabel}
              </span>
            ) : null}
          </div>
          <p className="text-sm text-slate-300">{s.clinicalStatusLabel}</p>
          {s.fixtureReadinessLabel ? (
            <p className="text-xs text-slate-400">{s.fixtureReadinessLabel}</p>
          ) : null}
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-right">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">
            Completeness
          </p>
          <p className="text-lg font-semibold text-white">
            {s.completenessScore}
            <span className="ml-1 text-sm font-normal text-slate-400">{s.completenessBand}</span>
          </p>
        </div>
      </div>

      <nav
        className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-3"
        aria-label="Overview sections"
      >
        {(
          [
            ["baseline", OVERVIEW_SECTION_IDS.baseline, OVERVIEW_SECTION_HEADINGS.baseline],
            [
              "surgicalPlan",
              OVERVIEW_SECTION_IDS.surgicalPlan,
              OVERVIEW_SECTION_HEADINGS.surgicalPlan,
            ],
            ["procedure", OVERVIEW_SECTION_IDS.procedure, OVERVIEW_SECTION_HEADINGS.procedure],
            ["outcomes", OVERVIEW_SECTION_IDS.outcomes, OVERVIEW_SECTION_HEADINGS.outcomes],
            ["workforce", OVERVIEW_SECTION_IDS.workforce, OVERVIEW_SECTION_HEADINGS.workforce],
            ["economics", OVERVIEW_SECTION_IDS.economics, OVERVIEW_SECTION_HEADINGS.economics],
            ["governance", OVERVIEW_SECTION_IDS.governance, OVERVIEW_SECTION_HEADINGS.governance],
          ] as const
        ).map(([key, id, label]) => (
          <a
            key={key}
            href={`#${id}`}
            className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300 hover:border-cyan-500/40 hover:text-cyan-100"
          >
            {label}
          </a>
        ))}
      </nav>
    </section>
  );
}

function BaselineSection({ overview }: { overview: PatientIntelligenceOverviewModel }) {
  const b = overview.baseline;
  return (
    <section
      id={OVERVIEW_SECTION_IDS.baseline}
      className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
      aria-labelledby="overview-baseline-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="overview-baseline-heading"
          className="text-sm font-semibold tracking-tight text-slate-100"
        >
          {OVERVIEW_SECTION_HEADINGS.baseline}
        </h2>
        <OverviewAvailabilityBadge availability={b.availability} />
      </div>

      {b.availability === "not_recorded" ? (
        <p className="mt-3 text-sm text-slate-400">Baseline clinical intelligence is not recorded.</p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Consultation and assessment
            </h3>
            <p className="text-slate-200">
              {b.consultationSummary ?? "Consultation summary not recorded"}
            </p>
            {b.norwoodLabel ? (
              <p className="text-slate-400">Staging · {b.norwoodLabel}</p>
            ) : (
              <p className="text-slate-500">Staging not recorded</p>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              History and risk
            </h3>
            {b.clinicalHistorySignals.length === 0 && b.riskSignals.length === 0 ? (
              <p className="text-slate-500">History and risk signals not recorded</p>
            ) : (
              <ul className="list-disc space-y-1 pl-4 text-slate-300">
                {b.clinicalHistorySignals.map((x) => (
                  <li key={x}>{x}</li>
                ))}
                {b.riskSignals.map((x) => (
                  <li key={`risk-${x}`}>{x}</li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Photographs and evidence
            </h3>
            <p className="text-slate-200">
              {b.photographCount > 0
                ? `${b.photographCount} imaging asset${b.photographCount === 1 ? "" : "s"}`
                : "Photographs not recorded"}
            </p>
            <Link
              href={overview.deepLinks.imagingHref}
              className="inline-block text-sm font-medium text-cyan-300 hover:underline"
            >
              Open imaging
            </Link>
          </div>
          <div className="space-y-2 text-sm">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              HLI / trichoscopy
            </h3>
            <OverviewAvailabilityBadge availability={b.hliTrichoscopyStatus} />
            <p className="text-slate-400">
              {b.hliTrichoscopyNote ?? "HLI / trichoscopy signals not recorded on this record."}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function OutcomesSection({ overview }: { overview: PatientIntelligenceOverviewModel }) {
  const o = overview.outcomes;
  return (
    <section
      id={OVERVIEW_SECTION_IDS.outcomes}
      className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
      aria-labelledby="overview-outcomes-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="overview-outcomes-heading"
          className="text-sm font-semibold tracking-tight text-slate-100"
        >
          {OVERVIEW_SECTION_HEADINGS.outcomes}
        </h2>
        <OverviewAvailabilityBadge availability={o.availability} />
      </div>

      <div className="mt-3 rounded-lg border border-violet-500/25 bg-violet-950/20 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-violet-200">
            Projected outcome
          </h3>
          <OverviewAvailabilityBadge availability={o.projectedOutcome.availability} />
        </div>
        <p className="mt-2 text-sm text-slate-200">{o.projectedOutcome.label}</p>
        {o.projectedOutcome.graftTarget != null ? (
          <p className="mt-1 text-xs text-slate-400">
            Target {formatGraftCount(o.projectedOutcome.graftTarget)} grafts
            {o.projectedOutcome.status ? ` · ${o.projectedOutcome.status}` : null}
          </p>
        ) : null}
      </div>

      {o.milestones.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Outcome milestones are not recorded.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {o.milestones.map((m) => {
            const demo = isDemonstrationOrFutureMilestone(m);
            return (
              <li
                key={`${m.checkpointKey}-${m.measurementDate ?? "na"}`}
                className={`rounded-lg border px-3 py-2 ${
                  demo
                    ? "border-sky-500/35 bg-sky-950/30"
                    : "border-white/[0.06] bg-black/20"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-100">{m.label}</p>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${
                      demo
                        ? "border-sky-400/40 bg-sky-500/15 text-sky-100"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                    }`}
                  >
                    {m.evidenceBadge}
                  </span>
                </div>
                {m.measurementDate ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Milestone date <time dateTime={m.measurementDate}>{m.measurementDate}</time>
                    {demo ? " · not a completed patient follow-up" : null}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">
                  {m.densityPercentOfTarget != null
                    ? `Density ${m.densityPercentOfTarget}% of target`
                    : "Density not recorded"}
                  {" · "}
                  {m.satisfactionOutOf10 != null
                    ? `Satisfaction ${m.satisfactionOutOf10}/10`
                    : "Satisfaction not recorded"}
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {overview.deepLinks.caseHref ? (
        <Link
          href={`${overview.deepLinks.caseHref}#${CASE_DETAIL_SECTION_IDS.outcomeIntelligence}`}
          className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
        >
          Open outcome intelligence on case
        </Link>
      ) : null}
    </section>
  );
}

function GovernanceSection({ overview }: { overview: PatientIntelligenceOverviewModel }) {
  const g = overview.governance;
  return (
    <section
      id={OVERVIEW_SECTION_IDS.governance}
      className="scroll-mt-4 rounded-xl border border-white/[0.08] bg-[#0b1220]/90 p-4"
      aria-labelledby="overview-governance-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="overview-governance-heading"
          className="text-sm font-semibold tracking-tight text-slate-100"
        >
          {OVERVIEW_SECTION_HEADINGS.governance}
        </h2>
        <OverviewAvailabilityBadge availability={g.availability} />
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-2 text-sm">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Consent
          </h3>
          {g.consentEvents.length === 0 ? (
            <p className="mt-2 text-slate-500">Consent events not recorded</p>
          ) : (
            <ul className="mt-2 space-y-1 text-slate-300">
              {g.consentEvents.map((e, i) => (
                <li key={`${e.kind}-${i}`}>
                  {e.label}
                  {e.occurredAt ? (
                    <span className="text-slate-500"> · {e.occurredAt}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Approvals and audit
          </h3>
          {g.approvalEvents.length === 0 && !g.auditSummary ? (
            <p className="mt-2 text-slate-500">Approvals not recorded</p>
          ) : (
            <ul className="mt-2 space-y-1 text-slate-300">
              {g.approvalEvents.map((e, i) => (
                <li key={`${e.kind}-a-${i}`}>
                  {e.label}
                  {e.occurredAt ? (
                    <span className="text-slate-500"> · {e.occurredAt}</span>
                  ) : null}
                </li>
              ))}
              {g.auditSummary ? <li>{g.auditSummary}</li> : null}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Source systems on this record
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Listed only when evidence on this health record indicates a contribution.
        </p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {g.sourceSystemsPresent.map((src) => (
            <li
              key={src}
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-300"
            >
              {src}
            </li>
          ))}
        </ul>
      </div>

      {g.auditHref ? (
        <Link
          href={g.auditHref}
          className="mt-3 inline-block text-sm font-medium text-cyan-300 hover:underline"
        >
          Open quality review
        </Link>
      ) : null}
    </section>
  );
}

/**
 * Read-only Patient Intelligence Overview for the existing Health record route.
 * One component for Package A and Package B; useful for ordinary patients via empty states.
 */
export function PatientIntelligenceOverview({
  overview,
}: {
  overview: PatientIntelligenceOverviewModel;
}) {
  return (
    <div
      className={`space-y-4 ${overview.presentationMode ? "presentation-overview" : ""}`}
      data-testid="patient-intelligence-overview"
      data-demo-package={overview.demoPackage ?? "none"}
      data-showcase={overview.summary.showcase.isShowcase ? "true" : "false"}
    >
      {overview.presentationMode ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div className="space-y-4">
            <SummarySection overview={overview} />
            <BaselineSection overview={overview} />
            <PatientTwinSurgicalStoryStrips
              surgicalPlan={overview.surgicalPlan}
              procedure={overview.procedure}
            />
            <OutcomesSection overview={overview} />
            <PatientTwinWorkforceStrip workforce={overview.workforce} />
            <PatientTwinEconomicsStrip economics={overview.economics} />
            <GovernanceSection overview={overview} />
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start">
            <DemoDayPresenterCues />
          </div>
        </div>
      ) : (
        <>
          <SummarySection overview={overview} />
          <BaselineSection overview={overview} />
          <PatientTwinSurgicalStoryStrips
            surgicalPlan={overview.surgicalPlan}
            procedure={overview.procedure}
          />
          <OutcomesSection overview={overview} />
          <div className="grid gap-4 lg:grid-cols-2">
            <PatientTwinWorkforceStrip workforce={overview.workforce} />
            <PatientTwinEconomicsStrip economics={overview.economics} />
          </div>
          <GovernanceSection overview={overview} />
        </>
      )}
    </div>
  );
}
