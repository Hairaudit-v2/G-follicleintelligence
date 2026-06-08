import { z } from "zod";

export const DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS = 48;

/** Run row subset used for health + cron banner (no secrets). */
export type StaffSyncRunHealthRef = {
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export type IiohrHrStaffSyncHealthJson = {
  ok: boolean;
  last_success_at: string | null;
  last_cron_run_at: string | null;
  stale: boolean;
  stale_warning_hours: number;
  last_error: string | null;
  recent_failure_count: number;
};

export type HrStaffSyncCronBanner = {
  variant: "success" | "warning" | "danger";
  title: string;
  message: string;
};

export function parseStaffSyncStaleWarningHours(getEnv: (k: string) => string | undefined): number {
  const raw = getEnv("STAFF_SYNC_STALE_WARNING_HOURS")?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS;
}

function triggerOf(r: StaffSyncRunHealthRef): string | undefined {
  const t = r.metadata?.trigger;
  return typeof t === "string" ? t.trim() : undefined;
}

function completionTime(r: StaffSyncRunHealthRef): string | null {
  return r.finished_at?.trim() || r.started_at?.trim() || null;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function cronRunsDesc(runs: StaffSyncRunHealthRef[]): StaffSyncRunHealthRef[] {
  return runs.filter((r) => triggerOf(r) === "cron");
}

/**
 * Production health for IIOHR HR → FI staff sync (cron-scoped staleness + recent failures).
 */
export function computeIiohrHrStaffSyncHealth(input: {
  evolvedTenantId: string | null;
  runs: StaffSyncRunHealthRef[];
  staleWarningHours: number;
  nowMs: number;
}): IiohrHrStaffSyncHealthJson {
  const tid = input.evolvedTenantId?.trim() ?? "";
  const envOk = z.string().uuid().safeParse(tid).success;
  const hours = input.staleWarningHours;
  const now = input.nowMs;

  if (!envOk) {
    return {
      ok: false,
      last_success_at: null,
      last_cron_run_at: null,
      stale: true,
      stale_warning_hours: hours,
      last_error: "EVOLVED_PERTH_TENANT_ID is missing or not a valid UUID.",
      recent_failure_count: 0,
    };
  }

  const cron = cronRunsDesc(input.runs);
  const lastCron = cron[0] ?? null;
  const last_cron_run_at = lastCron?.started_at?.trim() || null;

  let last_success_at: string | null = null;
  for (const r of cron) {
    if (r.status === "success") {
      const ct = completionTime(r);
      if (ct && (!last_success_at || ct > last_success_at)) last_success_at = ct;
    }
  }

  const recent_failure_count = cron.filter((r) => r.status === "failed").length;

  let stale = false;
  if (!last_success_at) {
    stale = true;
  } else {
    const ms = new Date(last_success_at).getTime();
    stale = Number.isFinite(ms) && now - ms > hours * 3_600_000;
  }

  let last_error: string | null = null;
  if (lastCron?.status === "failed" && lastCron.error_message?.trim()) {
    last_error = truncate(lastCron.error_message, 500);
  }

  const latestFailed = lastCron?.status === "failed";
  const latestRunning = lastCron?.status === "running";
  const ok = envOk && !stale && !latestFailed && !latestRunning;

  return {
    ok,
    last_success_at,
    last_cron_run_at,
    stale,
    stale_warning_hours: hours,
    last_error,
    recent_failure_count,
  };
}

/**
 * Prominent cron health banner for `/fi-admin/[tenantId]/hr/staff-import` when this tenant is the Evolved Perth cron target.
 */
export function buildHrStaffSyncCronBanner(input: {
  pageTenantId: string;
  recentRuns: StaffSyncRunHealthRef[];
  getEnv: (k: string) => string | undefined;
  nowMs?: number;
}): HrStaffSyncCronBanner | null {
  const evolved = input.getEnv("EVOLVED_PERTH_TENANT_ID")?.trim() ?? "";
  const evolvedOk = z.string().uuid().safeParse(evolved).success;
  if (!evolvedOk || evolved !== input.pageTenantId.trim()) return null;

  const hours = parseStaffSyncStaleWarningHours(input.getEnv);
  const now = input.nowMs ?? Date.now();
  const health = computeIiohrHrStaffSyncHealth({
    evolvedTenantId: evolved,
    runs: input.recentRuns,
    staleWarningHours: hours,
    nowMs: now,
  });

  const cron = cronRunsDesc(input.recentRuns);
  const latest = cron[0];

  if (latest?.status === "failed" && health.last_error) {
    return {
      variant: "danger",
      title: "Latest scheduled staff sync failed",
      message: health.last_error,
    };
  }
  if (latest?.status === "running") {
    return {
      variant: "warning",
      title: "Scheduled staff sync in progress",
      message: "A cron-triggered staff sync run is still marked running in fi_staff_sync_runs.",
    };
  }
  if (health.stale) {
    return {
      variant: "warning",
      title: "Scheduled staff sync is stale",
      message: health.last_success_at
        ? `No successful cron staff sync in the last ${hours}h (last success ${health.last_success_at}).`
        : `No successful cron staff sync has been recorded yet (stale threshold ${hours}h).`,
    };
  }
  return {
    variant: "success",
    title: "Scheduled staff sync is healthy",
    message: `Last successful cron sync ${health.last_success_at ?? "—"}; last cron run ${health.last_cron_run_at ?? "—"}.`,
  };
}
