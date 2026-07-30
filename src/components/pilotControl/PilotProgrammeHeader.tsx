"use client";

import { FiStatusBadge } from "@/src/components/fi-design/FiStatusBadge";
import type { PilotControlOverview } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlResponseMetadata } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import {
  coerceDisplayedHealthVerdict,
  formatDateTime,
  formatExpansionRecommendation,
  formatProgrammeStatus,
} from "@/src/lib/pilotControl/ui/pilotControlFormatters";

export function PilotProgrammeHeader({
  overview,
  meta,
  tenantLabel,
}: {
  overview: PilotControlOverview;
  meta?: PilotControlResponseMetadata | null;
  tenantLabel?: string;
}) {
  const { verdict, forceInsufficientEvidence } = coerceDisplayedHealthVerdict({
    verdict: overview.health.verdict,
    expansionRecommendation: overview.health.expansionRecommendation,
    totalApproved: overview.cohort.totalApproved,
    realPatientInvitesEnabled: overview.programme.realPatientInvitesEnabled,
  });

  const evalMeta = meta?.evaluation;

  return (
    <header className="space-y-3 rounded-xl border border-white/[0.08] bg-[#0F1629]/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-cyan-400/85">
            Controlled Pilot · Pilot Control Centre
          </p>
          <h1 className="mt-1 text-lg font-semibold tracking-tight text-[#F8FAFC] sm:text-xl">
            {overview.programme.name}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Status: {formatProgrammeStatus(overview.programme.status)}
            {tenantLabel ? ` · ${tenantLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiStatusBadge
            tone={
              forceInsufficientEvidence
                ? "warning"
                : verdict === "GREEN"
                  ? "success"
                  : verdict === "RED"
                    ? "danger"
                    : "warning"
            }
          >
            {forceInsufficientEvidence ? "AMBER · Insufficient live evidence" : verdict}
          </FiStatusBadge>
          <FiStatusBadge tone="neutral">
            Expansion: {formatExpansionRecommendation(overview.health.expansionRecommendation)}
          </FiStatusBadge>
        </div>
      </div>

      <dl className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="text-slate-500">Real patient invitations</dt>
          <dd className="font-medium text-slate-100">
            {overview.programme.realPatientInvitesEnabled ? "Enabled" : "Disabled"}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Pilot cohort</dt>
          <dd className="font-medium text-slate-100">
            {overview.cohort.totalApproved} approved · {overview.cohort.active} active
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Last evaluated</dt>
          <dd className="font-medium text-slate-100">
            {formatDateTime(evalMeta?.evaluatedAt ?? overview.generatedAt)}
          </dd>
        </div>
        {(meta?.partial || (evalMeta?.staleSources?.length ?? 0) > 0) && (
          <div className="sm:col-span-2 lg:col-span-3">
            <dt className="text-amber-300/90">Evidence warnings</dt>
            <dd className="font-medium text-amber-100">
              {meta?.partial ? "Partial result. " : ""}
              {(evalMeta?.staleSources?.length ?? 0) > 0
                ? `Stale sources: ${evalMeta!.staleSources.join(", ")}.`
                : forceInsufficientEvidence
                  ? "Insufficient live cohort evidence."
                  : null}
            </dd>
          </div>
        )}
      </dl>

      <details className="text-xs text-slate-400">
        <summary className="cursor-pointer text-slate-300 hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400">
          Engine versions and evidence metadata
        </summary>
        <ul className="mt-2 space-y-1 pl-1 font-mono text-[11px]">
          <li>Readiness: {evalMeta?.readinessVersion ?? meta?.evaluationVersion ?? "—"}</li>
          <li>Blocker: {evalMeta?.blockerVersion ?? "—"}</li>
          <li>Health rules: {evalMeta?.healthVersion ?? overview.health.ruleVersion}</li>
          <li>API: {meta?.apiVersion ?? "—"}</li>
          <li>Correlation: {meta?.correlationId ?? "—"}</li>
        </ul>
      </details>
    </header>
  );
}
