/**
 * Tablet layout smoke — Calendar chrome density + scroll contract (Today, WorkforceOS).
 *
 * Requires FI_E2E_BASE_URL, demo admin credentials, and FI_E2E_TENANT_ID.
 * Today scroll checks also need FI_E2E_TODAY_SURFACE_ENABLED=true.
 *
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> \
 *     FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
 *     FI_E2E_BROWSERS=chromium \
 *     npx playwright test e2e/fi-ux-tablet-layout.spec.ts --project=chromium-authenticated
 */
import { test, expect } from "@playwright/test";

import { authenticatedTest } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

async function expectMainColumnScrollable(
  page: import("@playwright/test").Page,
  sentinel: import("@playwright/test").Locator,
) {
  const main = page.locator("#fi-os-main-content");
  await expect(main).toBeVisible();

  const sidebar = page.getByTestId("fi-os-shell").locator("aside").first();
  if ((await sidebar.count()) > 0) {
    await expect(sidebar).toBeVisible();
  }

  const metrics = await main.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    scrollTopMax: el.scrollHeight - el.clientHeight,
  }));

  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight + 8);

  await main.evaluate((el, max) => {
    el.scrollTop = max;
  }, metrics.scrollTopMax);

  await expect(sentinel).toBeInViewport({ ratio: 0.15 });

  const bodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(bodyOverflow).toBeLessThanOrEqual(24);
}

async function expectCalendarGridVisible(page: import("@playwright/test").Page) {
  await expect(page.getByTestId("calendar-top-controls")).toBeVisible({ timeout: 30_000 });

  const grid =
    (await page.getByTestId("calendar-os-v2-shell").count()) > 0
      ? page.getByTestId("calendar-os-v2-shell")
      : page.getByTestId("calendar-v1-grid");

  await expect(grid).toBeVisible({ timeout: 20_000 });

  const box = await grid.boundingBox();
  expect(box?.height ?? 0).toBeGreaterThan(240);

  await expect(page.getByTestId("calendar-today-strip-toggle")).toBeVisible();
  await expect(page.getByTestId("calendar-tablet-filters-toggle")).toBeVisible();
}

authenticatedTest.describe("FI OS tablet layout @authenticated", () => {
  authenticatedTest("calendar grid visible at 1024x768 with compact chrome", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expectCalendarGridVisible(page);
  });

  authenticatedTest("calendar grid visible at 1180x820 with compact chrome", async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expectCalendarGridVisible(page);
  });

  authenticatedTest("calendar guided assist defaults collapsed on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByTestId("calendar-top-controls")).toBeVisible({ timeout: 30_000 });

    const assist = page.getByTestId("guided-assist-widget");
    if ((await assist.count()) === 0) {
      test.skip(true, "Guided Assist not mounted for this tenant/session");
    }

    await expect(assist).toHaveAttribute("data-guided-assist-collapsed", "true");
  });

  authenticatedTest("Today main column scrolls to lower feed sections", async ({ page }) => {
    test.skip(
      !todaySurfaceOptedIn(),
      "Set FI_E2E_TODAY_SURFACE_ENABLED=true to run Today tablet scroll checks",
    );

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE()}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: /Good (morning|afternoon|evening)/i })).toBeVisible({
      timeout: 30_000,
    });

    await expectMainColumnScrollable(
      page,
      page.getByRole("heading", { name: /Later and tomorrow/ }),
    );
  });

  authenticatedTest("Team overview scrolls to page bottom at 1440x900", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE()}/workforce-os`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Team overview", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await expectMainColumnScrollable(page, page.getByTestId("workforce-os-page-bottom"));
  });

  authenticatedTest("Team overview scrolls at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE()}/workforce-os`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Team overview", exact: true })).toBeVisible({
      timeout: 30_000,
    });

    await expectMainColumnScrollable(page, page.getByTestId("workforce-os-page-bottom"));
  });
});
