"use client";

import type { CaseReadinessReport } from "@/src/lib/cases/caseReadinessTypes";
import {
  CASE_DETAIL_SECTION_IDS,
  caseDetailSectionHeadingId,
} from "@/src/lib/cases/caseDetailNavConstants";
import { CaseReadinessChecklist } from "./CaseReadinessChecklist";

export function CaseReadinessSummaryCard({ report }: { report: CaseReadinessReport }) {
  const {
    overallPercent,
    requiredSatisfied,
    requiredTotal,
    nextRecommendedStep,
    warnings,
    sections,
  } = report;
  const warnShow = warnings.slice(0, 8);
  const warnMore = warnings.length - warnShow.length;

  return (
    <div className="rounded border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-4 shadow-lg shadow-black/40">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id={caseDetailSectionHeadingId(CASE_DETAIL_SECTION_IDS.readiness)}
            className="text-sm font-semibold text-slate-100"
          >
            SurgeryOS readiness
          </h2>
          <p className="mt-1 max-w-3xl text-xs text-gray-500">
            Stage 5F: read-only checklist from data already on this page — no new writes, no
            HairAudit or audit scoring, no AI or certification scores, no graft survival math.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold tabular-nums text-slate-100">{overallPercent}%</p>
          <p className="text-[11px] text-gray-500">
            {requiredSatisfied} / {requiredTotal} required checks
          </p>
        </div>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full bg-gray-900 transition-[width]"
          style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
        />
      </div>

      <div className="mt-4 rounded border border-blue-100 bg-blue-500/10 p-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-blue-300">
          Next recommended step
        </p>
        <p className="mt-1 text-sm text-blue-200">{nextRecommendedStep}</p>
      </div>

      {warnings.length > 0 ? (
        <div className="mt-4 rounded border border-amber-100 bg-amber-400/10 p-3">
          <p className="text-[11px] font-medium text-amber-200">Missing information</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-amber-200">
            {warnShow.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {warnMore > 0 ? (
            <p className="mt-2 text-[11px] text-amber-200">+ {warnMore} more</p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 border-t border-white/[0.06] pt-4">
        <p className="mb-3 text-xs font-medium text-slate-200">Section health</p>
        <CaseReadinessChecklist sections={sections} />
      </div>
    </div>
  );
}
