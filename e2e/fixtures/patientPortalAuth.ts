import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { test as base, expect } from "@playwright/test";

import { e2eTenantId } from "./baseUrl";

export const PATIENT_PORTAL_STORAGE_STATE = join(
  dirname(__dirname),
  ".playwright",
  "patient-portal-auth.json",
);

type WorkerFixtures = {
  patientPortalStorageState: string;
};

function hasPatientPortalCredentials(): boolean {
  return Boolean(
    process.env.FI_E2E_PATIENT_PORTAL_EMAIL?.trim() &&
      process.env.FI_E2E_PATIENT_PORTAL_PASSWORD?.trim() &&
      process.env.FI_E2E_TENANT_ID?.trim()
  );
}

/**
 * Authenticated patient-portal session (login once per worker).
 *
 * Requires FI_E2E_PATIENT_PORTAL_EMAIL, FI_E2E_PATIENT_PORTAL_PASSWORD, FI_E2E_TENANT_ID.
 */
export const patientPortalTest = base.extend<{}, WorkerFixtures>({
  storageState: async ({ patientPortalStorageState }, use) => {
    await use(patientPortalStorageState);
  },
  patientPortalStorageState: [
    async ({ browser }, use) => {
      if (!hasPatientPortalCredentials()) {
        await use("");
        return;
      }

      mkdirSync(dirname(PATIENT_PORTAL_STORAGE_STATE), { recursive: true });

      const context = await browser.newContext();
      const page = await context.newPage();
      const tenantId = e2eTenantId();
      const returnPath = `/patient/${tenantId}/visual-summary`;

      await page.goto(`/patient/${tenantId}/sign-in`);
      await page.getByLabel("Email").fill(process.env.FI_E2E_PATIENT_PORTAL_EMAIL!.trim());
      await page.getByLabel("Password").fill(process.env.FI_E2E_PATIENT_PORTAL_PASSWORD!.trim());
      await page.getByRole("button", { name: /sign in/i }).click();
      await page.waitForURL(new RegExp(`/patient/${tenantId}/visual-summary`), {
        timeout: 30_000,
      });
      await context.storageState({ path: PATIENT_PORTAL_STORAGE_STATE });
      await context.close();

      await use(PATIENT_PORTAL_STORAGE_STATE);
    },
    { scope: "worker" },
  ],
});

export { expect, hasPatientPortalCredentials };