"use client";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type {
  PilotControlHealthResponse,
  PilotControlOverview,
} from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlResponseMetadata } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { formatDateTime } from "@/src/lib/pilotControl/ui/pilotControlFormatters";
import { READINESS_DISTRIBUTION_DISCLAIMER } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

export function PilotJourneySummary({ overview }: { overview: PilotControlOverview }) {
  const r = overview.readiness.overall;
  const canonical = overview.readiness.source === "canonical_batch_readiness";
  return (
    <section className="space-y-3" aria-labelledby="pilot-journey-summary-heading">
      <SectionHeader
        id="pilot-journey-summary-heading"
        title="Journey and readiness summary"
        description={
          canonical
            ? "Canonical cohort readiness from the 1A.2 engine. Partial evaluations are never Ready."
            : READINESS_DISTRIBUTION_DISCLAIMER
        }
      />
      <p className="text-xs text-slate-500">
        Evaluated {overview.readiness.evaluatedPatients} · Partial{" "}
        {overview.readiness.partialEvaluations} · Failed {overview.readiness.failedEvaluations}
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(
          [
            ["Not started", r.notStarted],
            ["In progress", r.inProgress],
            ["Attention", r.attentionRequired],
            ["Blocked", r.blocked],
            ["Ready", r.ready],
            ["Completed", r.completed],
          ] as const
        ).map(([label, count]) => (
          <div
            key={label}
            className="rounded-lg border border-white/[0.06] bg-[#141C33]/45 px-3 py-2"
          >
            <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
            <div className="text-lg font-semibold tabular-nums text-slate-100">{count}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs">
          <div className="text-slate-500">Blocked by severity (register)</div>
          <p className="mt-1 text-slate-200">
            Critical {overview.blockers.openBySeverity.critical} · High{" "}
            {overview.blockers.openBySeverity.high} · Attention{" "}
            {overview.blockers.openBySeverity.attention}
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] px-3 py-2 text-xs">
          <div className="text-slate-500">Staff / patient actions</div>
          <p className="mt-1 text-slate-200">
            Patient-owned open {overview.actions.patientOwnedOpen} · Clinic-owned open{" "}
            {overview.actions.clinicOwnedOpen} · Inactive patients{" "}
            {overview.app.inactivePatients}
          </p>
        </div>
      </div>
    </section>
  );
}

export function PilotTechnicalHealth({
  health,
  meta,
}: {
  health: PilotControlHealthResponse | null;
  meta?: PilotControlResponseMetadata | null;
}) {
  const dims = health?.dimensions;
  return (
    <section className="space-y-3" aria-labelledby="pilot-technical-heading">
      <SectionHeader
        id="pilot-technical-heading"
        title="Technical health"
        description="Technical issues do not expose clinical detail. Distinguish pending, failed, recovered, and unavailable."
      />
      {!dims ? (
        <p className="text-sm text-slate-400">Technical health dimensions unavailable.</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {Object.entries(dims).map(([key, val]) => (
            <li
              key={key}
              className="rounded-lg border border-white/[0.06] bg-[#141C33]/40 px-3 py-2 text-xs"
            >
              <div className="font-medium text-slate-200">{key}</div>
              <div className="text-slate-400">
                Status: {val.status} · {val.evidence}
              </div>
            </li>
          ))}
        </ul>
      )}
      {meta?.evaluation?.staleSources?.length ? (
        <p className="text-xs text-amber-200">
          Stale sources: {meta.evaluation.staleSources.join(", ")} (last source update{" "}
          {formatDateTime(meta.evaluation.oldestSourceUpdatedAt)})
        </p>
      ) : null}
      {meta?.partial ? (
        <p className="text-xs text-amber-200">Partial evaluations present in this response.</p>
      ) : null}
      <p className="text-xs text-slate-500">
        Last successful evaluation: {formatDateTime(health?.evaluatedAt ?? meta?.generatedAt)}
      </p>
    </section>
  );
}

export function PilotEvidenceMetadata({
  meta,
  lastRefreshedAt,
}: {
  meta?: PilotControlResponseMetadata | null;
  lastRefreshedAt?: Date | null;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-white/[0.06] bg-[#0F1629]/50 px-4 py-3 text-xs text-slate-400">
      <SectionHeader title="Evidence freshness and limitations" />
      <ul className="space-y-1">
        <li>Generated: {formatDateTime(meta?.generatedAt)}</li>
        <li>Last refreshed (UI): {lastRefreshedAt ? formatDateTime(lastRefreshedAt.toISOString()) : "—"}</li>
        <li>Partial: {meta?.partial ? "Yes" : "No"}</li>
        <li>Correlation: {meta?.correlationId ?? "—"}</li>
        <li>{READINESS_DISTRIBUTION_DISCLAIMER}</li>
      </ul>
    </section>
  );
}
