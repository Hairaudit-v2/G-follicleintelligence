import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test as base, expect } from "@playwright/test";

import {
  demoAdminEmail,
  demoAdminPassword,
  hasDemoCredentials,
} from "../helpers/credentials";
import { LoginPage } from "../pages/login.page";
import { e2eTenantId, requireE2eBaseUrl } from "./baseUrl";

export const TENANT_ADMIN_STORAGE_STATE = join(
  dirname(__dirname),
  ".playwright",
  "tenant-admin-auth.json",
);

const MISSING_DEMO_CREDS_REASON =
  "Set FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD, and FI_E2E_TENANT_ID";

type TestFixtures = {
  /** Auto-skips when demo admin env is unset/empty (avoids worker login TypeError). */
  _requireDemoCredentials: void;
};

type WorkerFixtures = {
  tenantAdminStorageState: string;
};

/**
 * Authenticated tenant-admin session fixture (login once per worker).
 *
 * Requires FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD, and
 * FI_E2E_TENANT_ID — all supplied via env/CI secrets, never committed.
 *
 * When credentials are missing: tests skip cleanly (no `.trim()` crash).
 * Public Playwright projects also `grepInvert: /@authenticated/` so dual-tagged
 * `@authenticated @smoke` cases never hit this path on the credential-less CI job.
 */
export const authenticatedTest = base.extend<TestFixtures, WorkerFixtures>({
  _requireDemoCredentials: [
    async ({}, use, testInfo) => {
      testInfo.skip(!hasDemoCredentials(), MISSING_DEMO_CREDS_REASON);
      await use();
    },
    { auto: true },
  ],
  storageState: async ({ tenantAdminStorageState }, use) => {
    await use(tenantAdminStorageState);
  },
  tenantAdminStorageState: [
    async ({ browser }, use) => {
      // Worker fixtures run before test-scoped skips; never call .trim() on unset env.
      if (!hasDemoCredentials()) {
        await use("");
        return;
      }

      mkdirSync(dirname(TENANT_ADMIN_STORAGE_STATE), { recursive: true });

      const context = await browser.newContext({
        baseURL: requireE2eBaseUrl(),
      });
      const page = await context.newPage();
      const login = new LoginPage(page);
      const tenantId = e2eTenantId();
      const dashboardPath = `/fi-admin/${tenantId}/financial/dashboard`;

      await login.goto(dashboardPath);
      await login.signIn(demoAdminEmail(), demoAdminPassword());
      await page.waitForURL(new RegExp(`/fi-admin/${tenantId}/`), { timeout: 30_000 });
      await context.storageState({ path: TENANT_ADMIN_STORAGE_STATE });
      await context.close();

      await use(TENANT_ADMIN_STORAGE_STATE);
    },
    { scope: "worker" },
  ],
});

/** Re-export base test for unauthenticated specs (security, public smoke). */
export const test = base;
export { expect, hasDemoCredentials };
