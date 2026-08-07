/** Production tenants that cannot be archived without an explicit override (platform admin only). */
export const PROTECTED_TENANT_SLUGS = new Set<string>(["evolved-hair"]);

/** Known demo / sandbox slugs (also flagged via is_demo in fi_tenants). */
export const KNOWN_DEMO_TENANT_SLUGS = new Set<string>([
  "acme-demo",
  "ihrg-global",
  "follicle-demo-clinic",
]);

/** Slugs eligible for manual archive after operator verification (not auto-archived). */
export const TENANT_ARCHIVE_CANDIDATE_SLUGS = new Set<string>([
  "acme-demo",
  "evolved",
  "ihrg-global",
  "follicle-demo-clinic",
]);

export const PRODUCTION_TENANT_SLUG = "evolved-hair";
