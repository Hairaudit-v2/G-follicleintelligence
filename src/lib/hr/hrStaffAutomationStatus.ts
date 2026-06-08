import { z } from "zod";

/** Minimal run shape for automation hints (matches `FiStaffSyncRunRow` subset). */
export type HrAutomationStaffSyncRunRef = {
  status: string;
  started_at: string;
  finished_at: string | null;
  metadata: Record<string, unknown>;
};

export const DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS = 48;

export type HrStaffAutomationStatus = {
  /** Relative cron URL (POST only). */
  cronPath: string;
  cronSecretConfigured: boolean;
  cronSecretLengthOk: boolean;
  evolvedPerthTenantIdConfigured: boolean;
  evolvedPerthTenantMatchesPageTenant: boolean;
  fiBaseUrlConfigured: boolean;
  iiohrSyncSecretConfigured: boolean;
  perthHrFeedUrlConfigured: boolean;
  allowEmptyHrSyncConfigured: boolean;
  allOutboundEnvConfigured: boolean;
  allCronEnvConfigured: boolean;
  /** Latest non-cron producer run (external API or FI admin paste). */
  lastProducerApiRun: HrAutomationStaffSyncRunRef | null;
  /** Latest run tagged `metadata.trigger = cron`. */
  lastCronRun: HrAutomationStaffSyncRunRef | null;
  /** ISO timestamp of the most recent successful run completion (finished_at or started_at). */
  lastSuccessfulRunAt: string | null;
  staleSyncWarning: string | null;
};

function triggerOf(r: HrAutomationStaffSyncRunRef): string | undefined {
  const t = r.metadata?.trigger;
  return typeof t === "string" ? t.trim() : undefined;
}

function completionTime(r: HrAutomationStaffSyncRunRef): string | null {
  return r.finished_at?.trim() || r.started_at?.trim() || null;
}

/**
 * Derives HR staff sync automation hints for the FI Admin staff import page (no secret values).
 */
export function buildHrStaffAutomationStatus(input: {
  pageTenantId: string;
  recentRuns: HrAutomationStaffSyncRunRef[];
  getEnv: (key: string) => string | undefined;
  nowMs?: number;
}): HrStaffAutomationStatus {
  const cronPath = "/api/cron/iiohr-hr-perth-staff-sync";
  const cs = input.getEnv("CRON_SECRET")?.trim() ?? "";
  const evolved = input.getEnv("EVOLVED_PERTH_TENANT_ID")?.trim() ?? "";
  const evolvedUuidOk = z.string().uuid().safeParse(evolved).success;
  const pageMatches = evolvedUuidOk && evolved === input.pageTenantId.trim();

  const fiBase = Boolean(input.getEnv("FI_BASE_URL")?.trim());
  const iiohrSec = Boolean(input.getEnv("IIOHR_HR_SYNC_SECRET")?.trim());
  const feed = Boolean(input.getEnv("IIOHR_HR_PERTH_STAFF_FEED_URL")?.trim());
  const allOutbound = fiBase && iiohrSec && feed;
  const allowEmpty = input.getEnv("ALLOW_EMPTY_HR_SYNC")?.trim() === "true";

  const cronSecretConfigured = Boolean(cs);
  const cronSecretLengthOk = cs.length >= 16;
  const evolvedConfigured = Boolean(evolved) && evolvedUuidOk;
  const allCron = cronSecretConfigured && cronSecretLengthOk && evolvedConfigured && allOutbound;

  let lastProducer: HrAutomationStaffSyncRunRef | null = null;
  let lastCron: HrAutomationStaffSyncRunRef | null = null;
  let lastSuccessfulRunAt: string | null = null;

  for (const r of input.recentRuns) {
    const trig = triggerOf(r);
    if (lastCron === null && trig === "cron") lastCron = r;
    if (lastProducer === null && trig !== "cron") lastProducer = r;
    if (r.status === "success") {
      const ct = completionTime(r);
      if (ct && (!lastSuccessfulRunAt || ct > lastSuccessfulRunAt)) lastSuccessfulRunAt = ct;
    }
  }

  const rawHours = input.getEnv("STAFF_SYNC_STALE_WARNING_HOURS")?.trim();
  const parsedHours = rawHours ? Number.parseInt(rawHours, 10) : DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS;
  const staleHours =
    Number.isFinite(parsedHours) && parsedHours > 0 ? parsedHours : DEFAULT_STAFF_SYNC_STALE_WARNING_HOURS;
  const now = input.nowMs ?? Date.now();

  let staleSyncWarning: string | null = null;
  if (pageMatches && allCron) {
    if (!lastSuccessfulRunAt) {
      staleSyncWarning = "No successful staff sync recorded yet for this tenant.";
    } else {
      const ms = new Date(lastSuccessfulRunAt).getTime();
      if (Number.isFinite(ms) && now - ms > staleHours * 3_600_000) {
        staleSyncWarning = `No successful staff sync in the last ${staleHours}h (check cron and HR feed).`;
      }
    }
  }

  return {
    cronPath,
    cronSecretConfigured,
    cronSecretLengthOk,
    evolvedPerthTenantIdConfigured: evolvedConfigured,
    evolvedPerthTenantMatchesPageTenant: pageMatches,
    fiBaseUrlConfigured: fiBase,
    iiohrSyncSecretConfigured: iiohrSec,
    perthHrFeedUrlConfigured: feed,
    allowEmptyHrSyncConfigured: allowEmpty,
    allOutboundEnvConfigured: allOutbound,
    allCronEnvConfigured: allCron,
    lastProducerApiRun: lastProducer,
    lastCronRun: lastCron,
    lastSuccessfulRunAt,
    staleSyncWarning,
  };
}
