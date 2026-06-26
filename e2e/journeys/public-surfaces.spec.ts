import { test, expect } from "../fixtures/auth";
import { LoginPage } from "../pages/login.page";
import { MarketingPage } from "../pages/marketing.page";
import { PublicPayPage } from "../pages/public-pay.page";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Public, read-only journeys that generate business value without credentials.
 *
 * @smoke — marketing discovery, staff login surface, patient payment entry.
 * Safe to run against staging; no data mutation.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("public surfaces @smoke", () => {
  test("marketing homepage loads with primary value proposition", async ({ page }) => {
    const marketing = new MarketingPage(page);
    await marketing.gotoHome();
    await marketing.expectHomeLoaded();
  });

  test("staff login surface is reachable and interactive", async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.expectLoaded();
  });

  test("fi-login redirect lands on OS login", async ({ page }) => {
    await page.goto("/fi-login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/follicle-intelligence\/login/);
    await expect(page.getByRole("button", { name: /sign in to os/i })).toBeVisible();
  });

  test("invalid payment link shows unavailable state (no crash)", async ({ page }) => {
    const pay = new PublicPayPage(page);
    await pay.goto("e2e-invalid-token-not-a-real-payment-link");
    await pay.expectUnavailableLink();
  });
});
