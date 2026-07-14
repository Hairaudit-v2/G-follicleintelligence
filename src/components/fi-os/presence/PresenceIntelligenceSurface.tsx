"use client";

import { DashboardCard, InfoNotice, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PresenceSummary } from "@/src/lib/fiOs/presence/presenceTypes";
import {
  getImplementedPresenceSources,
  getPresenceSourcesByStatus,
} from "@/src/lib/fiOs/presence/presenceSourceMap";

function toneClass(tone: PresenceSummary["operationalStatus"]["tone"]): string {
  switch (tone) {
    case "active":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-100";
    case "attention":
      return "border-amber-500/25 bg-amber-500/10 text-amber-100";
    case "watch":
      return "border-cyan-500/25 bg-cyan-500/10 text-cyan-100";
    default:
      return "border-slate-500/25 bg-slate-500/10 text-slate-300";
  }
}

export function PresenceIntelligenceSurface(props: { summary: PresenceSummary }) {
  const { summary } = props;
  const roleSnapshots = summary.snapshots.filter(
    (s) => s.actorKind === "role" || s.actorKind === "clinic"
  );
  const arrivalWatch = summary.snapshots.filter(
    (s) =>
      s.signalKind === "patient_arrival_intent" ||
      s.signalKind === "reception_missing" ||
      s.signalKind === "clinic_unattended"
  );
  const surgeryWatch = summary.snapshots.filter((s) => s.signalKind === "surgery_team_incomplete");

  const implemented = getImplementedPresenceSources();
  const future = getPresenceSourcesByStatus("future");
  const excluded = getPresenceSourcesByStatus("excluded");

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
          Presence intelligence
        </h1>
        <p className="text-sm text-slate-400">
          Operational role coverage derived from existing signals — not payroll or staff
          surveillance.
        </p>
      </header>

      <div className={`rounded-xl border px-4 py-3 ${toneClass(summary.operationalStatus.tone)}`}>
        <p className="text-sm font-medium">{summary.operationalStatus.headline}</p>
        {summary.operationalStatus.subline ? (
          <p className="mt-1 text-sm opacity-80">{summary.operationalStatus.subline}</p>
        ) : null}
        {summary.operationalStatus.chips.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.operationalStatus.chips.map((chip) => (
              <span
                key={chip.id}
                className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-xs"
              >
                {chip.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Role coverage" />
          {roleSnapshots.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No role coverage signals right now.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {roleSnapshots.map((s, i) => (
                <li key={`${s.signalKind}-${i}`}>
                  <span className="font-medium text-slate-200">{s.safeLabel}</span>
                  <span className="text-slate-500"> — {s.reasonLabel}</span>
                  <span className="ml-1 text-xs text-slate-600">({s.confidence} confidence)</span>
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Arrival / reception watch" />
          {arrivalWatch.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No active arrival watch signals.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {arrivalWatch.map((s, i) => (
                <li key={`${s.signalKind}-${i}`}>{s.safeLabel}</li>
              ))}
            </ul>
          )}
        </DashboardCard>

        <DashboardCard className="p-5" elevated>
          <SectionHeader title="Surgery team watch" />
          {surgeryWatch.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No surgery team watch signals.</p>
          ) : (
            <ul className="mt-4 space-y-2 text-sm text-slate-300">
              {surgeryWatch.map((s, i) => (
                <li key={`${s.signalKind}-${i}`}>{s.reasonLabel}</li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <InfoNotice variant="info" title="Source disclaimer">
        <p className="text-sm text-slate-400">
          Presence is inferred from operational signals only. Unknown sources return safe unknown
          states. No individual staff tracking, last-active timestamps, or productivity scoring.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          <li>Active sources: {implemented.length}</li>
          <li>Future sources: {future.length}</li>
          <li>Excluded (payroll/timesheet): {excluded.length}</li>
        </ul>
      </InfoNotice>
    </div>
  );
}
