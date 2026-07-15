import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test as base, expect, type Page } from "@playwright/test";

import {
  hasProductionAdminCredentials,
  productionAdminEmail,
  productionAdminPassword,
} from "../helpers/credentials";
import {
  installHubspotMutationGuard,
  type HubspotMutationGuardHandle,
} from "../helpers/hubspotMutationGuard";
import { LoginPage } from "../pages/login.page";
import { e2eTenantId, requireE2eBaseUrl } from "./baseUrl";

/**
 * Production read-only HubSpot smoke fixture.
 *
 * - Authenticates with FI_E2E_PRODUCTION_ADMIN_* (generated storage state per run)
 * - Installs HubSpot mutation guard (network + click)
 * - Never commits storage-state files
 */

export const PRODUCTION_ADMIN_STORAGE_STATE = join(
  dirname(__dirname),
  ".playwright",
  "hubspot-production-admin-auth.json",
);

const MISSING_PRODUCTION_CREDS_REASON =
  "Set FI_E2E_BASE_URL, FI_E2E_PRODUCTION_ADMIN_EMAIL, FI_E2E_PRODUCTION_ADMIN_PASSWORD, and FI_E2E_TENANT_ID";

type TestFixtures = {
  _requireProductionCredentials: void;
  mutationGuard: HubspotMutationGuardHandle;
  hubspotPage: Page;
};

type WorkerFixtures = {
  productionAdminStorageState: string;
};

export const productionReadOnlyTest = base.extend<TestFixtures, WorkerFixtures>({
  _requireProductionCredentials: [
    async ({}, use, testInfo) => {
      testInfo.skip(!hasProductionAdminCredentials(), MISSING_PRODUCTION_CREDS_REASON);
      await use();
    },
    { auto: true },
  ],

  storageState: async ({ productionAdminStorageState }, use) => {
    await use(productionAdminStorageState);
  },

  productionAdminStorageState: [
    async ({ browser }, use) => {
      if (!hasProductionAdminCredentials()) {
        await use("");
        return;
      }

      mkdirSync(dirname(PRODUCTION_ADMIN_STORAGE_STATE), { recursive: true });

      const context = await browser.newContext({
        baseURL: requireE2eBaseUrl(),
      });
      const page = await context.newPage();
      const login = new LoginPage(page);
      const tenantId = e2eTenantId();
      const landing = `/fi-admin/${tenantId}/settings/integrations/hubspot`;

      await login.goto(landing);
      await login.signIn(productionAdminEmail(), productionAdminPassword());
      await page.waitForURL(new RegExp(`/fi-admin/${tenantId}/`), { timeout: 45_000 });
      await context.storageState({ path: PRODUCTION_ADMIN_STORAGE_STATE });
      await context.close();

      await use(PRODUCTION_ADMIN_STORAGE_STATE);
    },
    { scope: "worker" },
  ],

  mutationGuard: async ({ page }, use) => {
    const guard = await installHubspotMutationGuard(page);
    await use(guard);
    guard.assertClean();
    guard.dispose();
  },

  hubspotPage: async ({ page, mutationGuard }, use) => {
    // Ensure the guard fixture is installed before tests navigate.
    void mutationGuard;
    await use(page);
  },
});

export { expect, hasProductionAdminCredentials };
