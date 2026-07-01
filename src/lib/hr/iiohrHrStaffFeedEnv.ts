export type IiohrHrStaffFeedUrlSource =
  | "IIOHR_HR_PERTH_STAFF_FEED_URL"
  | "IIOHR_HR_STAFF_FEED_URL";

function trimEnvValue(value: string | undefined): string | null {
  const trimmed = value?.replace(/\r\n/g, "").trim();
  return trimmed || null;
}

/** Resolves the IIOHR HR staff feed URL (Perth canonical, legacy alias fallback). */
export function readIiohrHrStaffFeedUrl(
  getEnv: (key: string) => string | undefined = (key) => process.env[key]
): { url: string; source: IiohrHrStaffFeedUrlSource } | null {
  const perth = trimEnvValue(getEnv("IIOHR_HR_PERTH_STAFF_FEED_URL"));
  if (perth) return { url: perth, source: "IIOHR_HR_PERTH_STAFF_FEED_URL" };

  const legacy = trimEnvValue(getEnv("IIOHR_HR_STAFF_FEED_URL"));
  if (legacy) return { url: legacy, source: "IIOHR_HR_STAFF_FEED_URL" };

  return null;
}

export function readIiohrHrStaffFeedKey(
  getEnv: (key: string) => string | undefined = (key) => process.env[key]
): string | null {
  return trimEnvValue(getEnv("IIOHR_HR_PERTH_STAFF_FEED_KEY"));
}

export function buildIiohrHrStaffFeedEnvDiagnostics(
  getEnv: (key: string) => string | undefined = (key) => process.env[key]
): {
  feedUrlConfigured: boolean;
  feedUrlSource: IiohrHrStaffFeedUrlSource | null;
  feedKeyConfigured: boolean;
  cronSecretConfigured: boolean;
  evolvedPerthTenantIdConfigured: boolean;
  legacyFeedUrlConfigured: boolean;
} {
  const feed = readIiohrHrStaffFeedUrl(getEnv);
  const cronSecret = trimEnvValue(getEnv("CRON_SECRET"));
  const fiHrSyncCronSecret = trimEnvValue(getEnv("FI_HR_SYNC_CRON_SECRET"));
  return {
    feedUrlConfigured: Boolean(feed?.url),
    feedUrlSource: feed?.source ?? null,
    feedKeyConfigured: Boolean(readIiohrHrStaffFeedKey(getEnv)),
    cronSecretConfigured: Boolean(
      (cronSecret && cronSecret.length >= 16) || (fiHrSyncCronSecret && fiHrSyncCronSecret.length >= 16)
    ),
    evolvedPerthTenantIdConfigured: Boolean(trimEnvValue(getEnv("EVOLVED_PERTH_TENANT_ID"))),
    legacyFeedUrlConfigured: Boolean(trimEnvValue(getEnv("IIOHR_HR_STAFF_FEED_URL"))),
  };
}
