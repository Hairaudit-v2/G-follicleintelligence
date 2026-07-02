/**
 * FI-UX-REBUILD D2 — navigation collapse smoke coverage.
 *
 * Requires both Today surface and Workspace Shell enabled for the tenant:
 *   FI_TODAY_SURFACE_TENANT_IDS=<uuid>
 *   FI_WORKSPACE_SHELL_TENANT_IDS=<uuid>
 *
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> \
 *     FI_E2E_NAV_COLLAPSE_ENABLED=true FI_E2E_BROWSERS=chromium \
 *     npx playwright test e2e/fi-ux-nav-collapse.spec.ts
 */
import { test, expect } from "@playwright/test";

import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

function navCollapseOptedIn(): boolean {
  return process.env.FI_E2E_NAV_COLLAPSE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI-UX-REBUILD D2 navigation collapse @smoke", () => {
  test.beforeEach(() => {
    test.skip(
      !navCollapseOptedIn(),
      "Set FI_E2E_NAV_COLLAPSE_ENABLED=true and start the server with both " +
        "FI_TODAY_SURFACE_TENANT_IDS and FI_WORKSPACE_SHELL_TENANT_IDS including FI_E2E_TENANT_ID",
    );
  });

  test("minimal rail replaces legacy sidebar on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("navigation", { name: "FI OS primary navigation" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("navigation", { name: "FI OS modules" })).toHaveCount(0);

    for (const label of ["Today", "Calendar", "Search", "New", "More"]) {
      await expect(
        page.getByRole("navigation", { name: "FI OS primary navigation" }).getByText(label, {
          exact: true,
        }),
      ).toBeVisible();
    }
  });

  test("More opens legacy module navigation with RBAC-filtered items", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await page
      .getByRole("navigation", { name: "FI OS primary navigation" })
      .getByRole("button", { name: "More" })
      .click();

    const modulesNav = page.getByRole("navigation", { name: "FI OS modules" });
    await expect(modulesNav).toBeVisible({ timeout: 15_000 });
    await expect(modulesNav.getByText("Operations centre", { exact: true }).first()).toBeVisible();
  });

  test("calendar route still renders full page with minimal rail", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("navigation", { name: "FI OS primary navigation" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator("#fi-os-main-content")).toBeVisible();
  });

  test("mobile shows bottom bar instead of hamburger", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("navigation", { name: "FI OS mobile navigation" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveCount(0);
  });

  test("top bar uses New label in collapsed shell mode", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });

    await expect(page.getByRole("button", { name: "Open new" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /open quick create/i })).toHaveCount(0);
  });
});
