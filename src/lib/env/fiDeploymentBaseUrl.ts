/**
 * Normalises the public deployment origin used for server-to-server calls to this app.
 * Strips trailing slashes and a mistaken `/fi-admin` suffix (FI_BASE_URL must be the site root, not the admin shell path).
 */
export function normalizeFiDeploymentBaseUrl(raw: string): string {
  let base = raw.trim().replace(/\/+$/, "");
  base = base.replace(/\/fi-admin\/?$/i, "").replace(/\/+$/, "");
  return base;
}
