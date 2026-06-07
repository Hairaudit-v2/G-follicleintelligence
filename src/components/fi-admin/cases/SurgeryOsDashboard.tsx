import Link from "next/link";
import type { ReactNode } from "react";

import { FiCard } from "@/src/components/fi-design/FiCard";
import { FiEmptyState } from "@/src/components/fi-design/FiEmptyState";
import { FiKpiTile } from "@/src/components/fi-design/FiKpiTile";
import { FiPageHeader } from "@/src/components/fi-design/FiPageHeader";
import { FiQuickActionCard } from "@/src/components/fi-design/FiQuickActionCard";
import { CaseSectionHealthBadge } from "@/src/components/fi-admin/cases/CaseSectionHealthBadge";
import { caseDetailPageHref, caseSummaryDocumentPageHref } from "@/src/lib/cases/caseDetailFromCasesParam";
import { casesWorklistHref, parseCasesIndexQuery } from "@/src/lib/cases/casesIndexFilters";
import type { CaseReadinessHealth } from "@/src/lib/cases/caseReadinessTypes";
import {
  CASES_INDEX_DEFAULT_PAGE_SIZE,
  CASES_INDEX_NONE_VALUE,
  type CaseWorklistRow,
  type CasesIndexQuery,
  type CasesWorklistReadinessBucket,
} from "@/src/lib/cases/casesIndexTypes";
import {
  deriveSurgeryOsDashboardModel,
  type SurgeryOsDashboardRef,
  type SurgeryOsReadinessAlertRef,
} from "@/src/lib/cases/surgeryOsDashboardDerive";

function bucketToHealth(bucket: CasesWorklistReadinessBucket): CaseReadinessHealth {
  if (bucket === "ready") return "complete";
  return bucket;
}

function defaultCasesQuery(): CasesIndexQuery {
  return {
    ...parseCasesIndexQuery({}),
    page: 1,
    pageSize: CASES_INDEX_DEFAULT_PAGE_SIZE,
  };
}

function CaseDashRow({
  tenantId,
  worklistQueryString,
  entry,
  extra,
}: {
  tenantId: string;
  worklistQueryString?: string;
  entry: SurgeryOsDashboardRef;
  extra?: ReactNode;
}) {
  const href = caseDetailPageHref(tenantId, entry.caseId, worklistQueryString);
  return (
    <li className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link href={href} className="font-medium text-sky-700 hover:underline">
          {entry.personLabel}
        </Link>
        <p className="text-xs text-slate-500">
          {entry.caseStatusLabel}
          {entry.procedureDate ? ` · ${entry.procedureDate}` : ""}
          {entry.procedureStatusLabel ? ` · ${entry.procedureStatusLabel}` : ""}
        </p>
        {entry.zonesLabel ? <p className="mt-0.5 text-xs text-slate-600">Zones: {entry.zonesLabel}</p> : null}
        {extra}
      </div>
      <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
        <CaseSectionHealthBadge health={bucketToHealth(entry.readinessBucket)} compact />
        <div className="flex flex-wrap gap-2 text-xs font-medium">
          <Link href={href} className="text-sky-700 hover:underline">
            Case
          </Link>
          <Link href={caseSummaryDocumentPageHref(tenantId, entry.caseId, worklistQueryString)} className="text-slate-600 hover:underline">
            Summary
          </Link>
        </div>
      </div>
    </li>
  );
}

function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <FiCard>
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </FiCard>
  );
}

export function SurgeryOsDashboard({
  tenantId,
  rows,
  worklistQueryString,
}: {
  tenantId: string;
  rows: CaseWorklistRow[];
  worklistQueryString?: string;
}) {
  const tid = tenantId.trim();
  const base = `/fi-admin/${tid}`;
  const model = deriveSurgeryOsDashboardModel(rows);
  const dq = defaultCasesQuery();

  const readinessHref = casesWorklistHref(tid, dq, { readiness: "needs_attention", sort: "readiness_attention_desc" });
  const planningHref = casesWorklistHref(tid, dq, {
    planning_status: CASES_INDEX_NONE_VALUE,
    sort: "readiness_attention_desc",
  });
  const worklistAnchor = `${base}/cases#surgeryos-case-worklist`;

  return (
    <div className="space-y-6">
      <FiPageHeader
        eyebrow="FI OS"
        title="SurgeryOS"
        description="Surgical planning, procedure day tracking, post-op care, follow-ups, and readiness — all on the existing case worklist and detail routes below."
        titleId="surgeryos-dashboard-heading"
        primaryAction={
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Link
              href={`${base}/patients`}
              className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              View PatientOS
            </Link>
            <Link
              href={`${base}/cases/new`}
              className="inline-flex w-full items-center justify-center rounded-lg bg-sky-600 px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 sm:w-auto"
            >
              Start surgery case
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
        <FiKpiTile label="Active cases" value={String(model.metrics.totalActiveCases)} description="Excludes complete / failed" />
        <FiKpiTile
          label="Upcoming surgeries"
          value={String(model.metrics.upcomingSurgeries)}
          description="Next 30 days (after today)"
          tone="info"
        />
        <FiKpiTile
          label="Readiness review"
          value={String(model.metrics.readinessReviewCases)}
          description="Needs attention bucket"
          tone={model.metrics.readinessReviewCases > 0 ? "warning" : "neutral"}
        />
        <FiKpiTile
          label="Follow-ups due"
          value={String(model.metrics.followUpsDueCases)}
          description="Scheduled date on/before today"
          tone={model.metrics.followUpsDueCases > 0 ? "warning" : "neutral"}
        />
        <FiKpiTile
          label="Planning gaps"
          value={String(model.metrics.incompletePlanningCases)}
          description="Missing plan or incomplete fields"
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <SectionCard title="Today’s surgeries" description="Procedure date is today (local server date); cancelled / aborted excluded.">
            {model.todaySurgeries.length === 0 ? (
              <FiEmptyState title="Nothing on the board today" description="When procedures are dated for today, they will appear here." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {model.todaySurgeries.map((r) => (
                  <CaseDashRow key={r.caseId} tenantId={tid} worklistQueryString={worklistQueryString} entry={r} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Upcoming surgeries"
            description="Procedure dates from tomorrow through the next 30 days, still active on the schedule."
          >
            {model.upcomingSurgeries.length === 0 ? (
              <FiEmptyState
                title="No upcoming procedures in this window"
                description="Add or update procedure dates on cases to populate this list."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {model.upcomingSurgeries.map((r) => (
                  <CaseDashRow key={r.caseId} tenantId={tid} worklistQueryString={worklistQueryString} entry={r} />
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Surgical readiness"
            description="Cases where the readiness engine flagged at least one section as needs attention."
          >
            {model.readinessAlerts.length === 0 ? (
              <FiEmptyState
                title="No cases in the needs-attention bucket"
                description="Uses the same readiness rules as the worklist. When a section needs attention, the case appears here."
              />
            ) : (
              <ul className="divide-y divide-slate-100">
                {model.readinessAlerts.map((r: SurgeryOsReadinessAlertRef) => (
                  <CaseDashRow
                    key={r.caseId}
                    tenantId={tid}
                    worklistQueryString={worklistQueryString}
                    entry={r}
                    extra={<p className="mt-1 text-xs text-amber-800">{r.gapSummary}</p>}
                  />
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              <Link href={readinessHref} className="font-medium text-sky-700 hover:underline">
                Open filtered worklist (needs attention)
              </Link>
            </p>
          </SectionCard>

          <SectionCard
            title="Post-op & follow-up queue"
            description="Follow-ups with a scheduled date on or before today (not completed). Recently completed procedures (last 14 days) for quick charting."
          >
            <div className="space-y-5">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Follow-ups due</h3>
                {model.followUpQueue.length === 0 ? (
                  <FiEmptyState
                    className="mt-2 border-slate-100 bg-white py-6"
                    title="No follow-ups due"
                    description="Follow-ups need a scheduled date on or before today and must not already be completed or skipped."
                  />
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {model.followUpQueue.map((r) => (
                      <CaseDashRow key={r.caseId} tenantId={tid} worklistQueryString={worklistQueryString} entry={r} />
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Recently completed</h3>
                {model.recentCompleted.length === 0 ? (
                  <FiEmptyState
                    className="mt-2 border-slate-100 bg-white py-6"
                    title="No recent completions"
                    description="Completed procedures from the last two weeks appear here."
                  />
                ) : (
                  <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {model.recentCompleted.map((r) => (
                      <li
                        key={r.caseId}
                        className="flex flex-col gap-1 border-b border-slate-100 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <Link
                            href={caseDetailPageHref(tid, r.caseId, worklistQueryString)}
                            className="font-medium text-sky-700 hover:underline"
                          >
                            {r.personLabel}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {r.procedureDate} · {r.procedureStatusLabel ?? "—"}
                            {r.postOpStatusLabel ? ` · Post-op: ${r.postOpStatusLabel}` : ""}
                          </p>
                        </div>
                        <Link
                          href={caseSummaryDocumentPageHref(tid, r.caseId, worklistQueryString)}
                          className="shrink-0 text-xs font-medium text-slate-600 hover:underline"
                        >
                          Summary
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Surgery planning queue"
            description="Cases with no surgery plan row yet, or planning checklist not complete per existing readiness rules."
          >
            {model.planningQueue.length === 0 ? (
              <FiEmptyState title="Planning looks clear" description="No active cases are missing core planning completion." />
            ) : (
              <ul className="divide-y divide-slate-100">
                {model.planningQueue.map((r) => (
                  <CaseDashRow key={r.caseId} tenantId={tid} worklistQueryString={worklistQueryString} entry={r} />
                ))}
              </ul>
            )}
            <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
              <Link href={planningHref} className="font-medium text-sky-700 hover:underline">
                Filter: no surgery plan row
              </Link>
              <span className="hidden sm:inline" aria-hidden>
                ·
              </span>
              <Link href={casesWorklistHref(tid, dq, { sort: "readiness_attention_desc" })} className="font-medium text-sky-700 hover:underline">
                Full worklist (readiness sort)
              </Link>
            </p>
          </SectionCard>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <FiCard>
            <h2 className="text-sm font-semibold text-slate-900">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-600">Shortcuts use existing FI OS routes only.</p>
            <div className="mt-4 grid grid-cols-1 gap-3">
              <FiQuickActionCard
                title="Start surgery case"
                description="Open the first-case / new case flow."
                href={`${base}/cases/new`}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="Open PatientOS"
                description="Patient directory and profiles."
                href={`${base}/patients`}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="View AuditOS"
                description="HairAudit queue for this tenant."
                href={`${base}/audit`}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
              <FiQuickActionCard
                title="Case summary / export"
                description="Jump to the full case worklist — open a case, then use Summary from the case header."
                href={worklistAnchor}
                showOpenAffordance={false}
                className="!min-h-0 sm:!min-h-0"
              />
            </div>
          </FiCard>
        </div>
      </div>
    </div>
  );
}
