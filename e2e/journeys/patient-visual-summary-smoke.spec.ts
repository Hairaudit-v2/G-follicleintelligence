import { test } from "@playwright/test";

import { authenticatedTest, TENANT_ADMIN_STORAGE_STATE } from "../fixtures/auth";
import { patientPortalTest, hasPatientPortalCredentials } from "../fixtures/patientPortalAuth";
import { allowsMutations, hasDemoCredentials } from "../helpers/credentials";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * ImagingOS Phase 7D — visual summary workflow E2E.
 *
 * Full journey (staff zone save → approve → patient portal → PDF) requires:
 * - FI_E2E_DEMO_ADMIN_EMAIL / FI_E2E_DEMO_ADMIN_PASSWORD / FI_E2E_TENANT_ID
 * - FI_E2E_ALLOW_MUTATIONS=1
 * - FI_E2E_PATIENT_PORTAL_EMAIL / FI_E2E_PATIENT_PORTAL_PASSWORD (linked portal user)
 * - FI_E2E_VISUAL_SUMMARY_CASE_ID / FI_E2E_VISUAL_SUMMARY_PATIENT_ID
 *
 * Seed fixture: npm run seed:visual-summary-e2e
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

authenticatedTest.describe("patient visual summary — staff workflow @authenticated @mutation", () => {
  authenticatedTest.beforeEach(() => {
    authenticatedTest.skip(
      !allowsMutations() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID?.trim() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID?.trim(),
      "Requires FI_E2E_ALLOW_MUTATIONS=1 and visual summary fixture IDs"
    );
  });

  authenticatedTest(
    "staff saves zone data and approves summary on imaging workspace",
    async ({ page }) => {
      const tenantId = process.env.FI_E2E_TENANT_ID!.trim();
      const patientId = process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID!.trim();

      await page.goto(`/fi-admin/${tenantId}/patients/${patientId}/imaging`);
      await page.waitForLoadState("networkidle");
      await page.getByText("Patient visual summary", { exact: false }).first().waitFor({
        timeout: 15_000,
      });

      await page.getByLabel("Graft count").first().fill("120");

      await page.getByRole("button", { name: "Save zone data" }).click();
      await page.getByText("Zone data saved.", { exact: false }).waitFor({ timeout: 15_000 });

      await page.getByRole("button", { name: "Mark approved for patient" }).click();
      await page
        .getByText("Report approved for patient access.", { exact: false })
        .waitFor({ timeout: 15_000 });
    }
  );
});

patientPortalTest.describe("patient visual summary — portal @patient-portal @mutation", () => {
  patientPortalTest.beforeEach(() => {
    patientPortalTest.skip(
      !allowsMutations() ||
        !hasPatientPortalCredentials() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID?.trim(),
      "Requires portal credentials and visual summary fixture IDs"
    );
  });

  patientPortalTest(
    "patient views approved summary and downloads PDF",
    async ({ page, context }) => {
      const tenantId = process.env.FI_E2E_TENANT_ID!.trim();
      const caseId = process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID!.trim();

      await page.goto(`/patient/${tenantId}/visual-summary`);
      await page.waitForLoadState("networkidle");
      await page.getByRole("heading", { name: "Visual summaries" }).waitFor({ timeout: 15_000 });
      await page.getByText("No approved visual summaries", { exact: false }).waitFor({
        state: "hidden",
        timeout: 15_000,
      });

      const downloadPromise = page.waitForEvent("download", { timeout: 30_000 });
      await page.getByRole("link", { name: "Download PDF" }).first().click();
      const download = await downloadPromise;
      const filename = download.suggestedFilename();
      if (!filename.endsWith(".pdf")) {
        throw new Error(`Expected PDF download, got: ${filename}`);
      }

      const pdfResponse = await context.request.get(
        `/patient/${tenantId}/visual-summary/pdf?caseId=${caseId}&reportType=surgery_post_op_summary`
      );
      if (!pdfResponse.ok()) {
        throw new Error(`Portal PDF route failed: ${pdfResponse.status()}`);
      }
      const contentType = pdfResponse.headers()["content-type"] ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error(`Expected application/pdf, got ${contentType}`);
      }
    }
  );
});

authenticatedTest.describe("patient visual summary — full journey @authenticated @mutation @smoke", () => {
  authenticatedTest.beforeEach(() => {
    authenticatedTest.skip(
      !allowsMutations() ||
        !hasDemoCredentials() ||
        !hasPatientPortalCredentials() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID?.trim() ||
        !process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID?.trim(),
      "Requires full visual summary fixture env (run seed:visual-summary-e2e)"
    );
  });

  authenticatedTest(
    "staff approve then patient portal PDF is available",
    async ({ browser }) => {
      const tenantId = process.env.FI_E2E_TENANT_ID!.trim();
      const patientId = process.env.FI_E2E_VISUAL_SUMMARY_PATIENT_ID!.trim();
      const caseId = process.env.FI_E2E_VISUAL_SUMMARY_CASE_ID!.trim();

      const staffContext = await browser.newContext({
        storageState: TENANT_ADMIN_STORAGE_STATE,
      });
      const staffPage = await staffContext.newPage();
      await staffPage.goto(`/fi-admin/${tenantId}/patients/${patientId}/imaging`);
      await staffPage.getByRole("button", { name: "Save zone data" }).click();
      await staffPage
        .getByText("Zone data saved.", { exact: false })
        .waitFor({ timeout: 15_000 });
      await staffPage.getByRole("button", { name: "Mark approved for patient" }).click();
      await staffPage
        .getByText("Report approved for patient access.", { exact: false })
        .waitFor({ timeout: 15_000 });
      await staffContext.close();

      const portalContext = await browser.newContext();
      const portalPage = await portalContext.newPage();
      await portalPage.goto(`/patient/${tenantId}/sign-in`);
      await portalPage
        .getByLabel("Email")
        .fill(process.env.FI_E2E_PATIENT_PORTAL_EMAIL!.trim());
      await portalPage
        .getByLabel("Password")
        .fill(process.env.FI_E2E_PATIENT_PORTAL_PASSWORD!.trim());
      await portalPage.getByRole("button", { name: /sign in/i }).click();
      await portalPage.waitForURL(new RegExp(`/patient/${tenantId}/`), { timeout: 30_000 });

      const pdfResponse = await portalContext.request.get(
        `/patient/${tenantId}/visual-summary/pdf?caseId=${caseId}&reportType=surgery_post_op_summary`
      );
      if (!pdfResponse.ok()) {
        throw new Error(`Portal PDF route failed after approval: ${pdfResponse.status()}`);
      }
      const contentType = pdfResponse.headers()["content-type"] ?? "";
      if (!contentType.includes("application/pdf")) {
        throw new Error(`Expected application/pdf, got ${contentType}`);
      }
      await portalContext.close();
    }
  );
});