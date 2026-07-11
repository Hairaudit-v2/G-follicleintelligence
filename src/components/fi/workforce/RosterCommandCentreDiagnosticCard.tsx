"use client";

import type {
  RosterCommandCentrePageFailure,
  RosterLoadCounts,
} from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.types";

function formatCount(label: string, value: number | undefined): string {
  return `${label}: ${value ?? "—"}`;
}

export type RosterCommandCentreDiagnosticCardProps = {
  failure: RosterCommandCentrePageFailure;
  showTechnicalDetail: boolean;
};

export function RosterCommandCentreDiagnosticCard({
  failure,
  showTechnicalDetail,
}: RosterCommandCentreDiagnosticCardProps) {
  const counts = failure.counts as Partial<RosterLoadCounts>;

  return (
    <section
      className="mx-auto max-w-3xl rounded-xl border border-rose-500/30 bg-rose-950/20 p-5"
      data-testid="roster-load-diagnostic"
    >
      <h1 className="text-lg font-semibold text-rose-100">Roster load failed</h1>
      <p className="mt-2 text-sm text-rose-50/90">
        The roster route failed before render completed. Standard-hours setup is blocked until this
        is resolved.
      </p>

      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Failed step</dt>
          <dd className="font-mono text-slate-100">{failure.failedStep}</dd>
        </div>
        {showTechnicalDetail ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Error</dt>
            <dd className="break-words text-slate-100">{failure.message}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Error</dt>
            <dd className="text-slate-100">
              Roster data could not be loaded. Contact support with the reference below.
            </dd>
          </div>
        )}
        {failure.digest ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-400">Reference</dt>
            <dd className="font-mono text-xs text-slate-300">{failure.digest}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Schema check</dt>
          <dd className="text-slate-100">
            {failure.schemaCheckPassed ? "Passed" : "Failed"}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-400">Loaded counts</dt>
          <dd className="font-mono text-xs text-slate-300">
            {formatCount("staff", counts.staffCount)} ·{" "}
            {formatCount("shifts", counts.shiftsCount)} ·{" "}
            {formatCount("standardHoursStaff", counts.standardHoursStaffCount)} ·{" "}
            {formatCount("availability", counts.availabilityBlockCount)} ·{" "}
            {formatCount("clinicalEvents", counts.clinicalEventCount)}
          </dd>
        </div>
      </dl>
    </section>
  );
}
