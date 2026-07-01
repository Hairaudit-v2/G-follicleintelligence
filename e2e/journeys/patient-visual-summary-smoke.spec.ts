import { test } from "@playwright/test";

import { authenticatedTest } from "../fixtures/auth";
import { allowsMutations, hasDemoCredentials } from "../helpers/credentials";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * ImagingOS Phase 7C — visual summary workflow smoke.
 *
 * Full journey (staff zone save → approve → patient portal) requires:
 * - FI_E2E_DEMO_ADMIN_EMAIL / FI_E2E_DEMO_ADMIN_PASSWORD / FI_E2E_TENANT_ID
 * - FI_E2E_ALLOW_MUTATIONS=1
 * - FI_E2E_PATIENT_PORTAL_EMAIL / FI_E2E_PATIENT_PORTAL_PASSWORD (linked portal user)
 * - FI_E2E_VISUAL_SUMMARY_CASE_ID / FI_E2E_VISUAL_SUMMARY_PATIENT_ID
 *
 * Unit/integration coverage in patientVisualSummary*Core.test.ts when env is unavailable.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("patient visual summary — env documentation", () => {
  test("lists required env vars for full staff→portal journey", async () => {
    test.info().annotations.push({
      type: "required-env",
      description:
        "FI_E2E_DEMO_ADMIN_*, FI_E2E_TENANT_ID, FI_E2E_ALLOW_MUTATIONS=1, FI_E2E_VISUAL_SUMMARY_CASE_ID, FI_E2E_VISUAL_SUMMARY_PATIENT_ID, FI_E2E_PATIENT_PORTAL_*",
    });
  });
});

authenticatedTest.describe("patient visual summary — staff to portal @authenticated @mutation", () => {
  authenticatedTest.beforeEach(() => {
    authenticatedTest.skip(
      !allowsMutations() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID?.trim() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID?.trim(),
      "Requires FI_E2E_ALLOW_MUTATIONS=1 and visual summary fixture IDs"
    );
  });

  authenticatedTest(
    "staff can open payroll imaging visual summary panel route",
    async ({ page }) => {
      const tenantId = process.env.FI_E2E_TENANT_ID!.trim();
      const patientId = process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID!.trim();
      await page.goto(`/fi-admin/${tenantId}/patients/${patientId}/imaging`);
      await page.waitForLoadState("networkidle");
      await page.getByText("Patient visual summary", { exact: false }).first().waitFor({
        timeout: 15_000,
      });
    }
  );
});