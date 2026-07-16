import type { HubspotBackupHealthDerived } from "@/src/lib/onboarding-os/hubspotBackupHealthCore";

export type HubspotBackupHealthSectionModel = HubspotBackupHealthDerived & {
  primaryEvidence: { label: string; detail: string };
  secondaryEvidence: { label: string; detail: string };
};

const STATUS_STYLES: Record<
  HubspotBackupHealthDerived["status"],
  { border: string; bg: string; label: string }
> = {
  healthy: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/10",
    label: "Healthy",
  },
  needs_review: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/10",
    label: "Needs review",
  },
  failed: {
    border: "border-rose-500/40",
    bg: "bg-rose-500/10",
    label: "Failed",
  },
};

function formatDisplayTime(iso: string | null | undefined, timeZone?: string): string {
  if (!iso) return "Not recorded";
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return "Not recorded";
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timeZone || undefined,
      timeZoneName: "short",
    }).format(new Date(ms));
  } catch {
    return new Date(ms).toLocaleString();
  }
}

/**
 * Privacy-safe incremental notes backup health for HubSpot Backup & Sync.
 * Read-only presentation — no execution controls.
 */
export function HubspotBackupHealthSection({
  health,
  showTechnicalDetail,
}: {
  health: HubspotBackupHealthSectionModel;
  showTechnicalDetail: boolean;
}) {
  const style = STATUS_STYLES[health.status];
  const run = health.latestRun;
  const tz = health.scheduler.timezone;

  return (
    <section
      className="space-y-4"
      data-testid="hubspot-backup-health"
      data-health-status={health.status}
      aria-label="Incremental notes backup health"
    >
      <div className={`rounded-xl border ${style.border} ${style.bg} p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Incremental notes backup health
            </p>
            <h2
              className="mt-1 text-xl font-semibold text-slate-50"
              data-testid="hubspot-backup-health-status"
            >
              {style.label}
            </h2>
            <p className="mt-2 text-sm text-slate-200">{health.summary}</p>
          </div>
          <p className="text-xs text-slate-400">
            Operator action required:{" "}
            <span className="font-medium text-slate-100">
              {health.operatorActionRequired ? "Yes" : "No"}
            </span>
          </p>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 text-sm text-slate-300">
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Last verified backup</dt>
            <dd data-testid="hubspot-backup-health-last-verified">
              {formatDisplayTime(health.verification.verifiedAt, tz)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-slate-500">Next expected backup</dt>
            <dd data-testid="hubspot-backup-health-next-expected">
              {formatDisplayTime(health.scheduler.nextExpectedAt, tz)}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-slate-400">{health.operatorGuidance}</p>
        {showTechnicalDetail ? (
          <p className="mt-2 text-xs text-slate-500" data-testid="hubspot-backup-health-reason">
            Reason code: {health.reasonCode}
          </p>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
          <h3 className="font-medium text-slate-100">Latest run</h3>
          {run ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              <li>Dataset: {health.dataset}</li>
              <li data-testid="hubspot-backup-health-outcome">
                Outcome: {run.outcome ?? run.status}
              </li>
              <li>
                Started: {formatDisplayTime(run.startedAt, tz)}
              </li>
              <li>
                Completed: {formatDisplayTime(run.completedAt, tz)}
              </li>
              {showTechnicalDetail ? (
                <>
                  <li>Protected range: {run.cutoffFrom ?? "—"} → {run.cutoffTo ?? "—"}</li>
                  {run.runId ? <li>Run ID: {run.runId}</li> : null}
                  {run.counters ? (
                    <>
                      <li>Discovered: {run.counters.discovered ?? 0}</li>
                      <li>Inserted: {run.counters.inserted ?? 0}</li>
                      <li>Updated: {run.counters.updated ?? 0}</li>
                      <li>Unchanged: {run.counters.unchanged ?? 0}</li>
                      <li>Failed: {run.counters.failed ?? 0}</li>
                    </>
                  ) : null}
                </>
              ) : null}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-500">No incremental notes run recorded yet.</p>
          )}
        </article>

        <article className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300">
          <h3 className="font-medium text-slate-100">Protection</h3>
          <ul className="mt-2 space-y-1 text-xs text-slate-400">
            <li>
              Schedule: daily at {health.scheduler.localTime} ({health.scheduler.timezone})
            </li>
            <li>
              Scheduler:{" "}
              {health.scheduler.enabled === true
                ? "enabled"
                : health.scheduler.enabled === false
                  ? "disabled"
                  : "unknown"}
            </li>
            {showTechnicalDetail ? (
              <>
                <li data-testid="hubspot-backup-health-watermark">
                  Watermark: {health.watermark.value ?? "missing"}
                </li>
                <li>
                  Matches latest verified cutoff:{" "}
                  {health.watermark.matchesLatestVerifiedCutoff == null
                    ? "n/a"
                    : health.watermark.matchesLatestVerifiedCutoff
                      ? "yes"
                      : "no"}
                </li>
                <li>Cadence (UTC cron): {health.scheduler.cronUtc}</li>
                {health.status !== "healthy" ? (
                  <li>
                    Runbook: docs/runbooks/hubspot-incremental-backup.md
                  </li>
                ) : null}
              </>
            ) : (
              <li>Technical watermark and cutoff detail is available to administrators.</li>
            )}
          </ul>
        </article>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article
          className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"
          data-testid="hubspot-backup-health-primary-evidence"
        >
          <h3 className="font-medium text-slate-100">Primary evidence</h3>
          <p className="mt-1 text-xs text-slate-500">{health.primaryEvidence.label}</p>
          <p className="mt-2 text-xs text-slate-400">{health.primaryEvidence.detail}</p>
        </article>
        <article
          className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-300"
          data-testid="hubspot-backup-health-secondary-evidence"
        >
          <h3 className="font-medium text-slate-100">Secondary evidence</h3>
          <p className="mt-1 text-xs text-slate-500">{health.secondaryEvidence.label}</p>
          <p className="mt-2 text-xs text-slate-400">{health.secondaryEvidence.detail}</p>
        </article>
      </div>
    </section>
  );
}

export function HubspotBackupHealthLoading() {
  return (
    <div
      className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-sm text-slate-400"
      data-testid="hubspot-backup-health-loading"
    >
      Loading backup health…
    </div>
  );
}

export function HubspotBackupHealthError({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100"
      data-testid="hubspot-backup-health-error"
    >
      <p className="font-medium">Backup health unavailable</p>
      <p className="mt-1 text-xs text-rose-200/90">{message}</p>
      <p className="mt-2 text-xs text-rose-200/70">
        Status is not treated as Healthy while sources cannot be loaded.
      </p>
    </div>
  );
}
