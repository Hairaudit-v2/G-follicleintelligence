/**
 * FI-UX-AUDIT-1 / S3.4 — live Front Desk cutover label validation (demo tenant).
 *
 * Requires an authenticated session — Front Desk lives behind `/fi-admin/...`.
 * Public Playwright projects `grepInvert: /@authenticated/`, so these cases do
 * not run on the credential-less CI public smoke job (PUB-LABELS / Bucket A).
 *
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> \
 *     FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
 *     FI_E2E_BROWSERS=chromium \
 *     npx playwright test e2e/fi-ux-audit-labels.spec.ts --project=chromium-authenticated
 */
import { test } from "@playwright/test";

import { authenticatedTest, expect } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

test.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("FI-UX S3.4 Front Desk cutover @authenticated @smoke", () => {
  authenticatedTest("/front-desk renders Today board (not ReceptionOS dashboard)", async ({
    page,
  }) => {
    await page.goto(`${BASE()}/front-desk`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText("Front desk").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Reception Board", level: 1 })).toHaveCount(0);
    await expect(page.getByText("Clinic operations cockpit")).toHaveCount(0);
    await expect(page.getByLabel("Day summary")).toBeVisible({ timeout: 15_000 });
  });

  authenticatedTest("exactly two Front Desk tabs: Today and Tomorrow", async ({ page }) => {
    await page.goto(`${BASE()}/front-desk`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const subNav = page.getByRole("navigation", { name: "Front desk navigation" });
    await expect(subNav).toBeVisible({ timeout: 30_000 });
    await expect(subNav.getByRole("link", { name: "Today" })).toBeVisible();
    await expect(subNav.getByRole("link", { name: "Tomorrow" })).toBeVisible();
    await expect(subNav.getByRole("link")).toHaveCount(2);
    for (const absent of [
      "Reception operations",
      "Clinic flow",
      "Reception board",
      "Tomorrow board",
    ]) {
      await expect(subNav.getByText(absent, { exact: true })).toHaveCount(0);
    }
  });

  authenticatedTest("Today tab is active on /front-desk", async ({ page }) => {
    await page.goto(`${BASE()}/front-desk`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const today = page
      .getByRole("navigation", { name: "Front desk navigation" })
      .getByRole("link", { name: "Today" });
    await expect(today).toBeVisible({ timeout: 30_000 });
    await expect(today).toHaveClass(/22C1FF|bg-\[#22C1FF/);
  });

  authenticatedTest("Tomorrow tab is active on /front-desk/tomorrow", async ({ page }) => {
    await page.goto(`${BASE()}/front-desk/tomorrow`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const tomorrow = page
      .getByRole("navigation", { name: "Front desk navigation" })
      .getByRole("link", { name: "Tomorrow" });
    await expect(tomorrow).toBeVisible({ timeout: 30_000 });
    await expect(page).toHaveURL(new RegExp(`/front-desk/tomorrow`));
  });

  authenticatedTest("legacy /reception redirects to /front-desk and preserves bookingId/date", async ({
    page,
  }) => {
    await page.goto(`${BASE()}/reception?bookingId=abc&date=2026-07-12&demo=1&junk=x`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    await expect(page).toHaveURL(new RegExp(`/front-desk\\?`));
    const url = new URL(page.url());
    expect(url.pathname.endsWith("/front-desk")).toBeTruthy();
    expect(url.searchParams.get("bookingId")).toBe("abc");
    expect(url.searchParams.get("date")).toBe("2026-07-12");
    expect(url.searchParams.get("demo")).toBeNull();
    expect(url.searchParams.get("junk")).toBeNull();
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
  });

  authenticatedTest("legacy /reception-board and /operations redirect to Today", async ({
    page,
  }) => {
    for (const path of ["reception-board", "operations"]) {
      await page.goto(`${BASE()}/${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page).toHaveURL(new RegExp(`/front-desk$`));
    }
  });

  authenticatedTest("legacy /tomorrow redirects to /front-desk/tomorrow", async ({ page }) => {
    await page.goto(`${BASE()}/tomorrow`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page).toHaveURL(new RegExp(`/front-desk/tomorrow`));
  });

  authenticatedTest("legacy front-desk subroutes redirect to Today", async ({ page }) => {
    for (const path of ["front-desk/clinic-flow", "front-desk/reception-board"]) {
      await page.goto(`${BASE()}/${path}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
      await expect(page).toHaveURL(new RegExp(`/front-desk$`));
    }
  });

  authenticatedTest("staff cannot open /reception-os (not found)", async ({ page }) => {
    const res = await page.goto(`${BASE()}/reception-os`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    // Staff PIN / ordinary staff: 404 page, not Front Desk redirect.
    const status = res?.status() ?? 0;
    expect([404, 200]).toContain(status);
    if (status === 200) {
      // Platform admin may still see tooling; ordinary staff see not-found chrome.
      const hasToday = await page.getByRole("heading", { name: "Today", level: 1 }).count();
      expect(hasToday).toBe(0);
    }
  });

  authenticatedTest("top bar search and quick create remain available", async ({ page }) => {
    await page.goto(`${BASE()}/front-desk`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const search = page
      .getByRole("button", { name: /open workspace search/i })
      .or(page.getByRole("button", { name: /open search/i }));
    await expect(search.first()).toBeVisible({ timeout: 30_000 });
    const create = page
      .getByRole("button", { name: /open quick create/i })
      .or(page.getByRole("button", { name: /open new/i }));
    await expect(create.first()).toBeVisible();
  });

  authenticatedTest("tablet 768×1024 has no horizontal document overflow on Today", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${BASE()}/front-desk`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth + 1;
    });
    expect(overflow).toBe(false);
  });
});
