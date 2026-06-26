import { authenticatedTest as test, expect } from "../fixtures/auth";
import { FinancialDashboardPage } from "../pages/financial-dashboard.page";
import { LoginPage } from "../pages/login.page";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Authenticated tenant-admin access — revenue-critical entry point.
 *
 * @authenticated — requires FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD,
 * and FI_E2E_TENANT_ID. Only scheduled when all three are set.
 *
 * Maps to clinic readiness runbook §1.2 (tenant admin → financial dashboard).
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("tenant admin access @authenticated", () => {
  test("admin can sign in and reach financial dashboard", async ({ page }) => {
    const dashboard = new FinancialDashboardPage(page);
    await dashboard.goto();
    await dashboard.expectLoaded();
  });

  test("authenticated session is not redirected to login from tenant dashboard", async ({
    page,
  }) => {
    const tenantId = e2eTenantId();
    await page.goto(`/fi-admin/${tenantId}/financial/dashboard`, {
      waitUntil: "domcontentloaded",
    });

    await expect(page).not.toHaveURL(/\/follicle-intelligence\/login/);
    await expect(page.getByRole("button", { name: /sign in to os/i })).toHaveCount(0);
  });

  test("login with bad credentials shows error without granting access", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    const login = new LoginPage(page);

    await login.goto();
    await login.signIn("e2e-invalid@example.test", "not-a-real-password");

    await expect(page).toHaveURL(/error=invalid_credentials/);
    await expect(page.getByRole("alert")).toContainText(/invalid email or password/i);
    await context.close();
  });
});
