/**
 * FI-UX-REBUILD D6E — Presence Engine E2E.
 *
 * Opt-in:
 *   FI_E2E_D6_PRESENCE=true
 *   FI_E2E_TODAY_SURFACE_ENABLED=true
 *   FI_TODAY_SIGNAL_REVISION_POLL=true
 *
 *   npx playwright test e2e/fi-ux-d6e-presence-engine.spec.ts --project=chromium-authenticated
 */
import { expect, test } from "@playwright/test";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function TENANT(): string {
  return e2eTenantId();
}

function presenceOptedIn(): boolean {
  return process.env.FI_E2E_D6_PRESENCE?.trim().toLowerCase() === "true";
}

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

baseTest.describe("FI-UX-REBUILD D6E presence engine @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
    baseTest.skip(!presenceOptedIn(), "Set FI_E2E_D6_PRESENCE=true to run");
    baseTest.skip(!todaySurfaceOptedIn(), "Set FI_E2E_TODAY_SURFACE_ENABLED=true to run");
  });

  baseTest("Today surface shows safe presence copy without surveillance strings", async ({ page }) => {
    await page.goto(`/fi-admin/${TENANT()}`);
    await page.waitForLoadState("networkidle");

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/last active at|productivity|timesheet|payroll/i);
    expect(bodyText).not.toMatch(/\babsent\b|\blate\b|\bfailed to work\b/i);
  });

  baseTest("presence intelligence route returns non-PHI summary when accessible", async ({ page }) => {
    const res = await page.request.get(
      `/fi-admin/${encodeURIComponent(TENANT())}/intelligence/presence`
    );
    if (res.status() === 404) {
      baseTest.skip(true, "Presence route not accessible for this viewer");
      return;
    }
    expect(res.status()).toBeLessThan(500);
    const html = await res.text();
    expect(html).not.toMatch(/last active at|staff surveillance|productivity score/i);
    expect(html).toMatch(/presence|operational|unknown/i);
  });
});
