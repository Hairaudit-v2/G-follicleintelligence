/**
 * FI-UX-REBUILD D6F — Intelligence bake internal surface.
 *
 * Opt-in checks:
 *   FI_E2E_D6_BAKE=true
 *   FI_E2E_TODAY_SURFACE_ENABLED=true
 *
 *   npx playwright test e2e/fi-ux-d6f-intelligence-bake.spec.ts --project=chromium-authenticated
 */
import { expect, test } from "@playwright/test";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function TENANT(): string {
  return e2eTenantId();
}

function bakeOptedIn(): boolean {
  return process.env.FI_E2E_D6_BAKE?.trim().toLowerCase() === "true";
}

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

baseTest.describe("FI-UX-REBUILD D6F intelligence bake @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
    baseTest.skip(!bakeOptedIn(), "Set FI_E2E_D6_BAKE=true to run");
    baseTest.skip(!todaySurfaceOptedIn(), "Set FI_E2E_TODAY_SURFACE_ENABLED=true to run");
  });

  baseTest("admin can open d6-bake route and see validation domains", async ({ page }) => {
    const route = `/fi-admin/${TENANT()}/intelligence/d6-bake`;
    const res = await page.goto(route);
    expect(res?.status()).toBeLessThan(500);

    await expect(page.getByRole("heading", { name: "D6 Intelligence Bake" })).toBeVisible();
    await expect(page.getByText("Validation domains")).toBeVisible();
    await expect(page.getByText("Rollout flags")).toBeVisible();
  });

  baseTest("d6-bake route does not expose forbidden raw fields", async ({ page }) => {
    const route = `/fi-admin/${TENANT()}/intelligence/d6-bake`;
    await page.goto(route);

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/entity_id|signal_key|metadata|patientName/i);
    expect(bodyText).not.toMatch(/\$\d+\.\d{2}|pathology result text|clinical notes/i);
  });

  baseTest("when realtime is disabled, page shows watch or pass rather than hard failure headline", async ({
    page,
  }) => {
    const route = `/fi-admin/${TENANT()}/intelligence/d6-bake`;
    await page.goto(route);

    const statusBadge = page.locator("header").getByText(/Pass|Watch|Fail|Not enough data/);
    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).not.toHaveText("Fail");
  });
});
