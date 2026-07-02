/**
 * FI-UX-REBUILD D1B — workspace shell validation.
 *
 * Requires an authenticated CRM/bookings operator session (panels load via server actions).
 *
 * Server (.env.local):
 *   FI_WORKSPACE_SHELL_TENANT_IDS=<demo-tenant-uuid>
 *   FI_TODAY_SURFACE_TENANT_IDS=<demo-tenant-uuid>   # optional, for Today → workspace test
 *
 * Playwright:
 *   FI_E2E_BASE_URL=http://localhost:3000 \
 *   FI_E2E_TENANT_ID=c2615b95-b707-4485-aa5f-be8f78ec868a \
 *   FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
 *   FI_E2E_PATIENT_ID=287348d5-18bd-4434-9bab-7caafacbfe86 \
 *   FI_E2E_LEAD_ID=c9a58f3d-e1e4-4187-9986-59faed41565d \
 *   FI_E2E_WORKSPACE_SHELL_VALIDATION=true \
 *   npx playwright test e2e/fi-ux-workspace-shell-validation.spec.ts --project=chromium-authenticated
 */
import { expect, test, type Page } from "@playwright/test";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function validationOptedIn(): boolean {
  return process.env.FI_E2E_WORKSPACE_SHELL_VALIDATION?.trim().toLowerCase() === "true";
}

async function firstFeedHref(
  page: Page,
  pathPattern: RegExp
): Promise<string | null> {
  const links = page.locator(`a[href*="${TENANT()}"]`);
  const count = await links.count();
  for (let i = 0; i < count; i += 1) {
    const href = (await links.nth(i).getAttribute("href")) ?? "";
    if (pathPattern.test(href)) return href;
  }
  return null;
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

baseTest.describe("FI-UX-REBUILD D1B Workspace shell validation @smoke @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(
      !validationOptedIn(),
      "Set FI_E2E_WORKSPACE_SHELL_VALIDATION=true and start the server with FI_WORKSPACE_SHELL_TENANT_IDS including FI_E2E_TENANT_ID"
    );
    baseTest.skip(
      !hasDemoCredentials(),
      "Set FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD, and FI_E2E_TENANT_ID for authenticated workspace validation"
    );
  });

  baseTest("deep link — single patient workspace", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    test.skip(!patientId, "FI_E2E_PATIENT_ID required");

    await page.goto(`${BASE()}?workspace=patient:${patientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(new RegExp(`workspace=patient:${patientId}`, "i"));
    expect(page.url()).not.toMatch(new RegExp(`/patients/${patientId}$`));
  });

  baseTest("deep link — stacked patient then lead", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    const leadId = process.env.FI_E2E_LEAD_ID?.trim();
    test.skip(!patientId || !leadId, "FI_E2E_PATIENT_ID and FI_E2E_LEAD_ID required");

    await page.goto(`${BASE()}?workspace=patient:${patientId},lead:${leadId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.getByRole("dialog", { name: /lead/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(
      new RegExp(`workspace=patient:${patientId},lead:${leadId}`, "i")
    );
  });

  baseTest("Escape closes workspace panel", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    test.skip(!patientId, "FI_E2E_PATIENT_ID required");

    await page.goto(`${BASE()}?workspace=patient:${patientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toHaveCount(0, {
      timeout: 10_000,
    });
    await expect(page).not.toHaveURL(/workspace=/);
  });

  baseTest("browser back closes workspace after push navigation", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    test.skip(!patientId, "FI_E2E_PATIENT_ID required");

    await page.goto(BASE(), { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.goto(`${BASE()}?workspace=patient:${patientId}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.goBack();
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toHaveCount(0, {
      timeout: 10_000,
    });
  });

  baseTest("Today feed opens patient workspace in-panel when linked", async ({ page }) => {
    await page.goto(BASE(), { waitUntil: "domcontentloaded", timeout: 60_000 });

    const todayHeading = page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i });
    const legacyDashboard = page.getByText("Clinic Command Center");
    await expect(todayHeading.or(legacyDashboard)).toBeVisible({ timeout: 30_000 });
    test.skip(await legacyDashboard.isVisible(), "Today surface not enabled for this tenant");

    const patientHref = await firstFeedHref(
      page,
      new RegExp(`/fi-admin/${TENANT()}/patients/${UUID.source}`, "i")
    );
    test.skip(!patientHref, "No patient-linked Today feed item found");

    const pathBefore = page.url();
    await page.locator(`a[href="${patientHref}"]`).first().click();
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page).toHaveURL(/workspace=patient:/i);
    expect(page.url()).toContain(pathBefore.split("?")[0] ?? pathBefore);
  });

  baseTest("mobile viewport — workspace panel is full width", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    test.skip(!patientId, "FI_E2E_PATIENT_ID required");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE()}?workspace=patient:${patientId}`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const dialog = page.getByRole("dialog", { name: /patient preview/i });
    await expect(dialog).toBeVisible({ timeout: 30_000 });
    const box = await dialog.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(350);
  });
});

test.describe("FI-UX-REBUILD D1B Calendar guard @smoke", () => {
  test.beforeEach(() => {
    test.skip(
      !validationOptedIn(),
      "Set FI_E2E_WORKSPACE_SHELL_VALIDATION=true for D1B validation suite"
    );
  });

  test("Calendar route unchanged — full page, no workspace on load", async ({ page }) => {
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("dialog", { name: /patient preview|lead|appointment/i })).toHaveCount(
      0
    );
    await expect(page.locator("body")).toBeVisible();
  });
});
