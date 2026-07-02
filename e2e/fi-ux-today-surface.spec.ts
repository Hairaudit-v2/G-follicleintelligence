/**
 * FI-UX-REBUILD-1D (P0B) — Today surface smoke coverage.
 *
 * This spec only exercises the new Today surface, which is opt-in per tenant
 * (see src/lib/fiOs/todaySurfaceRollout.server.ts). To run it against a real
 * tenant:
 *   1. Start the server under test with the tenant enabled, e.g.
 *        FI_TODAY_SURFACE_TENANT_IDS=<uuid> npm run build && npm run start
 *   2. Run Playwright with the same tenant id, plus an explicit opt-in so this
 *      spec doesn't silently no-op in a suite where the server flag wasn't set:
 *        FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> \
 *          FI_E2E_TODAY_SURFACE_ENABLED=true FI_E2E_BROWSERS=chromium \
 *          npx playwright test e2e/fi-ux-today-surface.spec.ts
 *
 * Left un-opted-in by default so this spec never fails a routine run against
 * a server/tenant combination where `today_surface` is off (the expected
 * state for every tenant during P0/P0B).
 */
import { test, expect } from "@playwright/test";

import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI-UX-REBUILD-1D Today surface @smoke", () => {
  test.beforeEach(() => {
    test.skip(
      !todaySurfaceOptedIn(),
      "Set FI_E2E_TODAY_SURFACE_ENABLED=true (and start the server with " +
        "FI_TODAY_SURFACE_TENANT_IDS including FI_E2E_TENANT_ID) to run Today surface checks",
    );
  });

  test("home renders Today surface, not the legacy Clinic Command Center", async ({ page }) => {
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Clinic Command Center")).toHaveCount(0);
  });

  test("Right now / Up next / Coming up sections all render", async ({ page }) => {
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("heading", { name: "Needs you now" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Queued for today" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Later and tomorrow/ })).toBeVisible();
  });

  test("Coming up section is collapsed by default", async ({ page }) => {
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    const comingUp = page.getByRole("region", { name: /Later and tomorrow/ });
    await expect(comingUp).toBeVisible({ timeout: 30_000 });
    const details = comingUp.locator("details");
    await expect(details).not.toHaveJSProperty("open", true);
  });

  test("no KPI cards or module tiles on the Today surface", async ({ page }) => {
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 30_000,
    });

    for (const legacyLabel of [
      "Patients in clinic today",
      "Urgent operational alerts",
      "Open Operations Centre",
    ]) {
      await expect(page.getByText(legacyLabel)).toHaveCount(0);
    }
  });
});
