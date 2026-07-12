/**
 * FI-PIPELINE-STABILITY-DEPLOY-GATE — deployed build identity.
 *
 * Lets platform operators confirm *which* build is running (so stale-deploy
 * symptoms can be ruled in/out before any further code change). Pure + test-safe:
 * env is passed in; no `server-only`, no secrets, no fabrication.
 */

export type FiBuildIdentity = {
  sha: string | null;
  environment: string | null;
  pipelineRolloutEnabled: boolean;
};

/**
 * Resolve the deployed commit SHA from real deployment env vars, in priority order.
 * Never fabricated from package.json — returns null when no deployment SHA exists.
 */
export function pickBuildSha(env: Record<string, string | undefined>): string | null {
  const candidates = [
    env.VERCEL_GIT_COMMIT_SHA,
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
    env.GITHUB_SHA,
  ];
  for (const c of candidates) {
    const v = (c ?? "").trim();
    if (v) return v;
  }
  return null;
}

/** Resolve the deployment environment label (preview/production/…) or null. */
export function pickBuildEnvironment(env: Record<string, string | undefined>): string | null {
  const v = (env.VERCEL_ENV ?? env.NEXT_PUBLIC_VERCEL_ENV ?? "").trim();
  return v || null;
}

/** Short display SHA (first 8 chars) or the literal "unavailable" — never fabricated. */
export function shortBuildSha(sha: string | null): string {
  const v = (sha ?? "").trim();
  return v ? v.slice(0, 8) : "unavailable";
}
