import { test, expect } from "../fixtures/auth";
import { hasStaffPinCredentials, staffPin, staffPinId } from "../helpers/credentials";
import { StaffPinLoginPage } from "../pages/staff-pin-login.page";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Staff PIN floor access — scoped clinic-floor session (runbook §1.3–1.4).
 *
 * @authenticated — requires FI_E2E_STAFF_ID + FI_E2E_STAFF_PIN on demo tenant.
 * Happy path uses real PIN; error path uses wrong PIN without granting access.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("staff PIN access @authenticated", () => {
  test("valid PIN grants calendar access with scoped session", async ({ page }) => {
    test.skip(!hasStaffPinCredentials(), "Set FI_E2E_STAFF_ID and FI_E2E_STAFF_PIN");

    const pinLogin = new StaffPinLoginPage(page);
    await pinLogin.goto();
    await pinLogin.expectLoaded();
    await pinLogin.signIn(staffPinId(), staffPin());

    const tenantId = e2eTenantId();
    await expect(page).toHaveURL(new RegExp(`/fi-admin/${tenantId}/calendar`), {
      timeout: 20_000,
    });
    await expect(page.getByRole("button", { name: /sign in to os/i })).toHaveCount(0);
  });

  test("wrong PIN shows error and does not reach calendar", async ({ page }) => {
    test.skip(!hasStaffPinCredentials(), "Set FI_E2E_STAFF_ID and FI_E2E_STAFF_PIN");

    const pinLogin = new StaffPinLoginPage(page);
    await pinLogin.goto();
    await pinLogin.signIn(staffPinId(), "0000");
    await pinLogin.expectInvalidCredentialsError();
    await expect(page).not.toHaveURL(/\/calendar/);
  });
});
