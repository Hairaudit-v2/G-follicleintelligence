/**
 * FI-TRUST-LANDING-AND-SPINE-1 — Pipeline board scroll containment.
 *
 * Ensures horizontal board scroll stays inside the pipeline container, not the document root.
 *
 * Env: FI_E2E_BASE_URL, FI_E2E_TENANT_ID, FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD
 */
import { authenticatedTest, expect } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const TENANT = () => e2eTenantId();
const BASE = () => `/fi-admin/${TENANT()}`;

authenticatedTest.beforeAll(() => {
  requireE2eBaseUrl();
});

async function expectNoDocumentHorizontalOverflow(page: import("@playwright/test").Page) {
  const bodyOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(bodyOverflow).toBeLessThanOrEqual(24);
}

authenticatedTest.describe("FI trust pipeline layout @authenticated @smoke", () => {
  authenticatedTest("Pipeline page avoids document-level horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE()}/crm`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^enquiries$/i })).toBeVisible({
      timeout: 30_000,
    });

    const board = page.getByTestId("pipeline-board-h-scroll");
    if ((await board.count()) > 0) {
      await expect(board).toBeVisible();
    }

    await expectNoDocumentHorizontalOverflow(page);
  });

  authenticatedTest("Pipeline board scroll container at tablet width", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto(`${BASE()}/crm`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^enquiries$/i })).toBeVisible({
      timeout: 30_000,
    });

    const board = page.getByTestId("pipeline-board-h-scroll");
    if ((await board.count()) > 0) {
      const metrics = await board.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(metrics.scrollWidth).toBeGreaterThanOrEqual(metrics.clientWidth);
    }

    await expectNoDocumentHorizontalOverflow(page);
  });
});
