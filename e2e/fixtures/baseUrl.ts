import { normalizeFiDeploymentBaseUrl } from "../../src/lib/env/fiDeploymentBaseUrl";

/**
 * Resolves the base URL e2e tests run against. Throws a clear, actionable
 * error rather than letting Playwright fall through to a confusing
 * "baseURL not set" failure deep in a test.
 *
 * Required env: FI_E2E_BASE_URL — e.g. http://localhost:3000 for a local
 * `next build && next start`, or https://<staging-host> for a deployed
 * staging environment. Never point this at a host with real patient data
 * unless you're certain every test in this suite is read-only (it is, as
 * of Patch 7 — see e2e/security/*.spec.ts).
 */
export function requireE2eBaseUrl(): string {
  const raw = process.env.FI_E2E_BASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "Missing FI_E2E_BASE_URL. Set it to the host under test, e.g.\n" +
        "  FI_E2E_BASE_URL=http://localhost:3000 npm run test:e2e\n" +
        "(start a local production build first: `npm run build && npm run start`, " +
        "or point this at a staging deployment).",
    );
  }
  return normalizeFiDeploymentBaseUrl(raw);
}

/**
 * Resolves the tenant ID used by tests that need a real (non-secret) tenant
 * UUID — e.g. to build a tenant-scoped route under test. Optional for the
 * unauthenticated security suite (falls back to a syntactically valid but
 * non-existent UUID, since these checks only assert "access denied", not
 * "this tenant's data is correct").
 */
export function e2eTenantId(): string {
  return process.env.FI_E2E_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000000";
}
