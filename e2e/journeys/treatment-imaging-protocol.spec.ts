import { authenticatedTest as test, expect } from "../fixtures/auth";
import { requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * FI-TREATMENT-IMAGING-PROTOCOL-1 — treatment photo checklist UI smoke.
 *
 * Requires a PRP or exosome booking visible in the tenant calendar/fixtures.
 * Skips when the operational fixture booking is unavailable.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("treatment imaging protocol @authenticated @smoke", () => {
  test("PRP appointment detail exposes Treatment Photos checklist when fixture booking exists", async ({
    page,
  }) => {
    const bookingId = process.env.FI_E2E_PRP_BOOKING_ID?.trim();
    const tenantId = process.env.FI_E2E_TENANT_ID?.trim();
    test.skip(!bookingId || !tenantId, "Set FI_E2E_TENANT_ID and FI_E2E_PRP_BOOKING_ID");

    await page.goto(`/fi-admin/${tenantId}/appointments/${bookingId}`);
    await expect(page.getByTestId("treatment-photos-checklist")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Treatment Photos")).toBeVisible();
    await expect(page.getByTestId("treatment-photo-slot-front_hairline")).toBeVisible();
    await expect(page.getByTestId("treatment-photo-slot-misc")).toBeVisible();
  });

  test("consultation appointment does not expose treatment photos checklist", async ({ page }) => {
    const bookingId = process.env.FI_E2E_CONSULTATION_BOOKING_ID?.trim();
    const tenantId = process.env.FI_E2E_TENANT_ID?.trim();
    test.skip(!bookingId || !tenantId, "Set FI_E2E_TENANT_ID and FI_E2E_CONSULTATION_BOOKING_ID");

    await page.goto(`/fi-admin/${tenantId}/appointments/${bookingId}`);
    await expect(page.getByTestId("treatment-photos-checklist")).toHaveCount(0, { timeout: 10_000 });
  });
});
