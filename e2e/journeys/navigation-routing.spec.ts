import { test, expect } from "../fixtures/auth";
import { MarketingPage } from "../pages/marketing.page";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Marketing navigation and routing — discovery funnel before clinic signup.
 *
 * @smoke — read-only; validates public routes render without auth.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("marketing navigation @smoke", () => {
  test("homepage → pricing → platform routes load", async ({ page }) => {
    const marketing = new MarketingPage(page);

    await marketing.gotoHome();
    await marketing.expectHomeLoaded();

    await marketing.gotoPricing();
    await marketing.expectPricingLoaded();

    await marketing.gotoPlatformOverview();
    await marketing.expectPlatformLoaded();
  });

  test("unknown admin route redirects unauthenticated users away", async ({ page }) => {
    await page.goto("/fi-admin/not-a-real-tenant/calendar", { waitUntil: "domcontentloaded" });
    const url = page.url();
    const blocked =
      /\/follicle-intelligence\/login/.test(url) ||
      (await page.getByRole("button", { name: /sign in to os/i }).count()) > 0 ||
      (await page.getByText(/403|not found|access denied/i).count()) > 0;
    expect(blocked, `expected unauthenticated block, got ${url}`).toBe(true);
  });
});
