/**
 * FI-UX-AUDIT-1 — live label validation against demo tenant (dev server, no auth).
 * Run: FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> npx playwright test e2e/fi-ux-audit-labels.spec.ts
 */
import { test, expect } from "@playwright/test";

import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI-UX-AUDIT-1 label pass @smoke", () => {
  test("reception board — page chrome and flow lanes", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Reception Board" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "Open Calendar" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Quick Create Booking" }).first()).toBeVisible();

    for (const lane of [
      "Arriving soon",
      "Waiting",
      "Checked in",
      "In consultation / treatment",
      "Ready for handoff",
      "Completed",
    ]) {
      await expect(page.getByText(lane, { exact: true }).first()).toBeVisible();
    }
  });

  test("reception canonical route matches legacy /reception-board", async ({ page }) => {
    await page.goto(`${BASE()}/reception-board`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Reception Board" })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("FI OS shell — sidebar nav labels", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const nav = page.getByRole("navigation").first();
    await expect(nav).toBeVisible({ timeout: 30_000 });

    for (const label of [
      "Dashboard",
      "Calendar",
      "Operations centre",
      "Reception board",
      "ReceptionOS",
      "Patients",
      "Cases",
      "Settings",
    ]) {
      await expect(nav.getByRole("link", { name: new RegExp(label, "i") }).first()).toBeVisible();
    }
  });

  test("FI OS shell — top bar search and quick create", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(
      page.getByPlaceholder(/search patients, leads, cases/i).or(
        page.getByRole("button", { name: /open workspace search/i }),
      ),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("button", { name: /quick create/i }).first()).toBeVisible();
  });

  test("quick create palette items", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.getByRole("button", { name: /quick create/i }).first().click();
    for (const item of [
      "New consultation",
      "New patient",
      "New enquiry",
      "New case",
      "New task",
    ]) {
      await expect(page.getByRole("option", { name: new RegExp(item, "i") }).or(
        page.getByText(item, { exact: true }),
      ).first()).toBeVisible({ timeout: 10_000 });
    }
  });

  test("calendar — view toggles and density", async ({ page }) => {
    await page.goto(`${BASE()}/calendar`, { waitUntil: "domcontentloaded", timeout: 90_000 });
    for (const view of ["Day", "Week", "Month"]) {
      await expect(
        page.getByRole("button", { name: new RegExp(`^${view}$`, "i") }).or(
          page.getByRole("tab", { name: new RegExp(view, "i") }),
        ).first(),
      ).toBeVisible({ timeout: 45_000 });
    }
  });

  test("operations centre loads", async ({ page }) => {
    await page.goto(`${BASE()}/operations`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText(/operations centre/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Open Calendar" }).first()).toBeVisible();
  });
});