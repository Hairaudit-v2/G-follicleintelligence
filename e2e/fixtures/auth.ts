import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test as base, expect } from "@playwright/test";

import { hasDemoCredentials } from "../helpers/credentials";
import { LoginPage } from "../pages/login.page";
import { e2eTenantId } from "./baseUrl";

export const TENANT_ADMIN_STORAGE_STATE = join(
  dirname(__dirname),
  ".playwright",
  "tenant-admin-auth.json",
);

type WorkerFixtures = {
  tenantAdminStorageState: string;
};

/**
 * Authenticated tenant-admin session fixture (login once per worker).
 *
 * Requires FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD, and
 * FI_E2E_TENANT_ID — all supplied via env/CI secrets, never committed.
 */
export const authenticatedTest = base.extend<{}, WorkerFixtures>({
  storageState: async ({ tenantAdminStorageState }, use) => {
    await use(tenantAdminStorageState);
  },
  tenantAdminStorageState: [
    async ({ browser }, use) => {
      mkdirSync(dirname(TENANT_ADMIN_STORAGE_STATE), { recursive: true });

      const context = await browser.newContext();
      const page = await context.newPage();
      const login = new LoginPage(page);
      const tenantId = e2eTenantId();
      const dashboardPath = `/fi-admin/${tenantId}/financial/dashboard`;

      await login.goto(dashboardPath);
      await login.signIn(
        process.env.FI_E2E_DEMO_ADMIN_EMAIL!.trim(),
        process.env.FI_E2E_DEMO_ADMIN_PASSWORD!.trim(),
      );
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
