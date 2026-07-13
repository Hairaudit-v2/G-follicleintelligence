/**
 * FI-ROLE-JOURNEY-BAKE-1 — golden-patient UI spine (authenticated, read-only).
 *
 * Validates Pipeline lead detail agrees with linked patient workspace after reload.
 *
 * Env: FI_E2E_BASE_URL, FI_E2E_TENANT_ID, FI_E2E_DEMO_ADMIN_*,
 *      FI_E2E_LEAD_ID, FI_E2E_PATIENT_ID (safe fixture pair on demo tenant).
 *
 * Run:
 *   npx playwright test e2e/fi-trust-golden-patient-spine.spec.ts --project=chromium-authenticated
 */
import { authenticatedTest, expect, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

/** Profile route — exclude Health record (`/twin`) links in CRM lead header. */
function patientProfileLink(page: import("@playwright/test").Page, patientId: string) {
  return page.locator(`a[href="${BASE()}/patients/${patientId}"]`).first();
}

function spineFixturesReady(): boolean {
  return Boolean(
    hasDemoCredentials() &&
      process.env.FI_E2E_LEAD_ID?.trim() &&
      process.env.FI_E2E_PATIENT_ID?.trim(),
  );
}

authenticatedTest.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("FI trust golden patient spine @authenticated @smoke", () => {
  authenticatedTest.skip(!spineFixturesReady(), "Set FI_E2E_LEAD_ID and FI_E2E_PATIENT_ID");

  authenticatedTest("lead detail links to canonical patient workspace", async ({ page }) => {
    const leadId = process.env.FI_E2E_LEAD_ID!.trim();
    const patientId = process.env.FI_E2E_PATIENT_ID!.trim();

    await page.goto(`${BASE()}/crm/leads/${leadId}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/crm/leads/${leadId}`));

    const patientLink = patientProfileLink(page, patientId);
    await expect(patientLink).toBeVisible({ timeout: 30_000 });
    await patientLink.click();
    await page.waitForURL(new RegExp(`/patients/${patientId}(?:/|$|\\?)`), { timeout: 30_000 });
  });

  authenticatedTest("reload preserves lead-to-patient linkage", async ({ page }) => {
    const leadId = process.env.FI_E2E_LEAD_ID!.trim();
    const patientId = process.env.FI_E2E_PATIENT_ID!.trim();

    await page.goto(`${BASE()}/crm/leads/${leadId}`, { waitUntil: "domcontentloaded" });
    await expect(patientProfileLink(page, patientId)).toBeVisible({
      timeout: 30_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(patientProfileLink(page, patientId)).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`${BASE()}/crm`, { waitUntil: "domcontentloaded" });
    await page.goto(`${BASE()}/crm/leads/${leadId}`, { waitUntil: "domcontentloaded" });
    await expect(patientProfileLink(page, patientId)).toBeVisible({
      timeout: 30_000,
    });
  });

  authenticatedTest("negative — unlinked lead has no patient workspace link", async ({ page }) => {
    authenticatedTest.skip(
      !process.env.FI_E2E_UNLINKED_LEAD_ID?.trim(),
      "Set FI_E2E_UNLINKED_LEAD_ID for negative linkage case"
    );

    const leadId = process.env.FI_E2E_UNLINKED_LEAD_ID!.trim();
    await page.goto(`${BASE()}/crm/leads/${leadId}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator('a[href*="/patients/"]')).toHaveCount(0);
  });
});
