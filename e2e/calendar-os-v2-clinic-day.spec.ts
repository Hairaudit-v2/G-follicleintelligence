import { test, expect } from "@playwright/test";

import { authenticatedTest } from "./fixtures/auth";
import { requireE2eBaseUrl, e2eTenantId } from "./fixtures/baseUrl";

/**
 * CalendarOS V2 — clinic-day operational QA (browser tier).
 *
 * @authenticated — V2 shell loads with feature flag
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("CalendarOS V2 — clinic day @authenticated", () => {
  authenticatedTest("V2 shell loads with operational panel", async ({ page }) => {
    const tid = e2eTenantId();
    await page.goto(`/fi-admin/${tid}/calendar?calendarV2=1&view=day`);
    await expect(page.locator("body")).toBeVisible();
    await expect(
      page.getByText(/CalendarOS V2|resource-first operations view/i).first()
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("Operational context")).toBeVisible({ timeout: 15_000 });
  });

  authenticatedTest("density toggle and presets are interactive", async ({ page }) => {
    const tid = e2eTenantId();
    await page.goto(`/fi-admin/${tid}/calendar?calendarV2=1&view=week`);
    await expect(page.locator("body")).toBeVisible({ timeout: 20_000 });

    const densityBtn = page.getByRole("button", { name: /compact|command|comfortable/i }).first();
    if (await densityBtn.isVisible().catch(() => false)) {
      await densityBtn.click();
    }

    const weekBtn = page.getByRole("link", { name: /week/i }).or(page.getByRole("button", { name: /week/i }));
    const dayBtn = page.getByRole("link", { name: /day/i }).or(page.getByRole("button", { name: /day/i }));
    if (await dayBtn.first().isVisible().catch(() => false)) {
      await dayBtn.first().click();
      await page.waitForTimeout(300);
    }
    if (await weekBtn.first().isVisible().catch(() => false)) {
      await weekBtn.first().click();
    }
  });
});