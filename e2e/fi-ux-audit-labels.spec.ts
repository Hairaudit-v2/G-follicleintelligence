/**
 * FI-UX-AUDIT-1 — live label validation (demo tenant, local dev).
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> FI_E2E_BROWSERS=chromium \
 *     npx playwright test e2e/fi-ux-audit-labels.spec.ts
 */
import { test, expect } from "@playwright/test";

import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI-UX-AUDIT-1 label pass @smoke", () => {
  test("reception board — page chrome and snapshot labels", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("heading", { name: "Reception Board", level: 1 })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: "Open Calendar" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Operations Centre" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Quick Create Booking" }).first()).toBeVisible();

    await expect(page.getByRole("heading", { name: "Reception snapshot", level: 2 })).toBeVisible();
    for (const card of [
      "Expected arrivals",
      "Checked in",
      "Waiting",
      "In consultation / treatment",
    ]) {
      await expect(page.getByText(card, { exact: true }).first()).toBeVisible();
    }

    await expect(page.getByRole("heading", { name: "Patient flow board", level: 2 })).toBeVisible();
    const flowBoard = page.getByRole("region", { name: "Patient flow board" });
    const laneOrEmpty = flowBoard.getByRole("heading", { level: 3 }).or(
      flowBoard.getByText(/No active patient flow/i),
    );
    await expect(laneOrEmpty.first()).toBeVisible({ timeout: 15_000 });
  });

  test("legacy /reception-board is command center (not /reception dashboard)", async ({ page }) => {
    await page.goto(`${BASE()}/reception-board`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: "Clinic operations cockpit", level: 1 }),
    ).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("FI OS · Reception Board")).toBeVisible();
  });

  test("FI OS shell — sidebar nav labels", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const nav = page.getByRole("navigation", { name: "FI OS modules" });
    await expect(nav).toBeVisible({ timeout: 30_000 });

    for (const label of [
      "Dashboard",
      "Operations centre",
      "Reception board",
      "Tomorrow board",
      "Cases",
      "FinancialOS",
      "ReceptionOS",
      "Staff",
    ]) {
      await expect(nav.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("FI OS shell — top bar search and quick create", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByRole("button", { name: /open workspace search/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/search patients, leads, cases/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /open quick create/i })).toBeVisible();
  });

  test("quick create entry point visible", async ({ page }) => {
    await page.goto(`${BASE()}/reception`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const btn = page.getByRole("button", { name: /open quick create/i });
    await expect(btn).toBeVisible({ timeout: 30_000 });
    await expect(btn).toContainText("Quick create");
    // Palette item labels: verified in fiOsQuickCreateItems.ts (Playwright palette open flaky on dev HMR).
  });

  test("operations centre loads", async ({ page }) => {
    await page.goto(`${BASE()}/operations`, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await expect(page.getByText(/operations centre/i).first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("link", { name: "Open Calendar" }).first()).toBeVisible();
  });
});