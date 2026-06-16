import { test as base } from "@playwright/test";

/**
 * Placeholder authenticated-session fixture pattern — NOT wired up yet.
 *
 * Patch 7 intentionally ships only unauthenticated security smoke tests
 * (see e2e/security/*.spec.ts). Real patient/booking/payment workflow
 * coverage needs an authenticated session, which this repo does not yet
 * have a safe way to provision in CI:
 *   - No real credentials may ever be committed (see repo rules / CRIT-1 in
 *     AUDIT_REPORT_2026-06-16.md re: leaked secrets).
 *   - A throwaway demo user/tenant needs to exist on whatever host is under
 *     test, with credentials supplied only via env vars / CI secrets.
 *
 * When that's ready, the intended shape is a Playwright fixture that logs
 * in once per worker and reuses the storage state, e.g.:
 *
 *   export const test = base.extend<{}, { fiAdminAuth: void }>({
 *     fiAdminAuth: [
 *       async ({ browser }, use) => {
 *         const email = process.env.FI_E2E_DEMO_ADMIN_EMAIL;
 *         const password = process.env.FI_E2E_DEMO_ADMIN_PASSWORD;
 *         if (!email || !password) {
 *           throw new Error(
 *             "Missing FI_E2E_DEMO_ADMIN_EMAIL/FI_E2E_DEMO_ADMIN_PASSWORD — " +
 *               "set these to a throwaway demo-tenant admin account, never a real one."
 *           );
 *         }
 *         const context = await browser.newContext();
 *         const page = await context.newPage();
 *         await page.goto("/login");
 *         await page.getByLabel("Email").fill(email);
 *         await page.getByLabel("Password").fill(password);
 *         await page.getByRole("button", { name: "Sign in" }).click();
 *         await page.waitForURL(/\/fi-admin\//);
 *         await context.storageState({ path: ".playwright/fi-admin-auth.json" });
 *         await context.close();
 *         await use();
 *       },
 *       { scope: "worker" },
 *     ],
 *   });
 *
 * Then authenticated specs would do:
 *   test.use({ storageState: ".playwright/fi-admin-auth.json" });
 *
 * Do not implement this until a dedicated, clearly-labelled demo tenant +
 * throwaway credentials exist for e2e use, supplied only via env/CI secrets
 * — never hardcoded here. Until then, re-export the base `test`/`expect` so
 * future specs have a single import to migrate from.
 */
export const test = base;
export { expect } from "@playwright/test";
