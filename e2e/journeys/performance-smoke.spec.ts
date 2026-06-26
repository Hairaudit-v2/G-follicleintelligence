import { test } from "../fixtures/auth";
import { expectPageLoadsWithinBudget } from "../helpers/performance";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Soft performance regression guards on critical public pages.
 *
 * @smoke — not a load test; catches major regressions in CI.
 * Override budget: FI_E2E_PERF_BUDGET_MS=12000
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("performance smoke @smoke", () => {
  test("homepage loads within budget", async ({ page }) => {
    await expectPageLoadsWithinBudget(page, "/");
  });

  test("login page loads within budget", async ({ page }) => {
    await expectPageLoadsWithinBudget(page, "/follicle-intelligence/login");
  });

  test("pricing page loads within budget", async ({ page }) => {
    await expectPageLoadsWithinBudget(page, "/pricing");
  });
});
