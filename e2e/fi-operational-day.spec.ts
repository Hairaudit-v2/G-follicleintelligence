import { test, expect } from "@playwright/test";

import { authenticatedTest } from "./fixtures/auth";
import { requireE2eBaseUrl, e2eTenantId, e2eOtherTenantId } from "./fixtures/baseUrl";
import { allowsMutations } from "./helpers/credentials";

/**
 * Sprint 6 — Unified operational day journey (browser tier).
 *
 * @smoke — unauthenticated fail-closed + public posture
 * @authenticated — tenant admin can load operational surfaces
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

const procedureDayFlagOff = !["1", "true", "yes", "on"].includes(
  (process.env.FI_PROCEDURE_DAY_ENABLED ?? "").trim().toLowerCase(),
);

test.describe("FI operational day — security @smoke", () => {
  test("reception board requires authentication", async ({ page }) => {
    const tid = e2eTenantId();
    const res = await page.goto(`/fi-admin/${tid}/reception-board`, { waitUntil: "commit" });
    const status = res?.status() ?? 0;
    expect([200, 302, 303, 307, 401, 403]).toContain(status);
    if (status === 200) {
      await expect(page.getByRole("heading", { name: /reception/i })).not.toBeVisible({
        timeout: 5000,
      });
    }
  });

  test("procedure day route hidden or denied when flag off", async ({ page }) => {
    test.skip(!procedureDayFlagOff, "FI_PROCEDURE_DAY_ENABLED is on — skip hidden-route check");
    const tid = e2eTenantId();
    const res = await page.goto(`/fi-admin/${tid}/procedure-day`, { waitUntil: "commit" });
    const status = res?.status() ?? 0;
    expect([404, 302, 303, 307, 401, 403]).toContain(status);
  });

  test("reception-board API rejects unauthenticated access", async ({ request }) => {
    const tid = e2eTenantId();
    const res = await request.get(`/api/tenants/${tid}/reception-board`);
    expect([401, 403]).toContain(res.status());
  });
});

authenticatedTest.describe("FI operational day — authenticated @authenticated @smoke", () => {
  authenticatedTest("tenant admin can open reception board", async ({ page }) => {
    const tid = e2eTenantId();
    await page.goto(`/fi-admin/${tid}/reception-board`);
    await expect(page.locator("body")).toBeVisible();
    await expect(page.getByText(/reception|operational|appointments/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  authenticatedTest("procedure day nav hidden when flag off", async ({ page }) => {
    test.skip(!procedureDayFlagOff, "FI_PROCEDURE_DAY_ENABLED is on");
    const tid = e2eTenantId();
    await page.goto(`/fi-admin/${tid}/financial/dashboard`);
    await expect(page.getByRole("link", { name: /procedure day/i })).toHaveCount(0);
  });

  authenticatedTest("cross-tenant reception board denied", async ({ page }) => {
    const other = e2eOtherTenantId();
    test.skip(!other, "Set FI_E2E_OTHER_TENANT_ID for cross-tenant isolation");
    const res = await page.goto(`/fi-admin/${other}/reception-board`, { waitUntil: "commit" });
    const status = res?.status() ?? 0;
    if (status === 200) {
      await expect(page.getByText(/not authorized|access denied|forbidden/i)).toBeVisible({
        timeout: 10_000,
      });
    } else {
      expect([302, 303, 307, 401, 403, 404]).toContain(status);
    }
  });
});

authenticatedTest.describe("FI operational day — mutation journey @authenticated @mutation", () => {
  authenticatedTest.beforeEach(() => {
    authenticatedTest.skip(
      !allowsMutations(),
      "Set FI_E2E_ALLOW_MUTATIONS=1 on a throwaway demo tenant",
    );
  });

  authenticatedTest("operational surfaces load after patient create path", async ({ page }) => {
    const tid = e2eTenantId();
    await page.goto(`/fi-admin/${tid}/reception-board`);
    await expect(page.locator("body")).toBeVisible();
    await page.goto(`/fi-admin/${tid}/calendar`);
    await expect(page.locator("body")).toBeVisible();
    const calendarHeading = page.getByText(/calendar|schedule/i).first();
    await expect(calendarHeading).toBeVisible({ timeout: 20_000 });
  });
});