import { authenticatedTest as test, expect } from "../fixtures/auth";
import { e2eOtherTenantId, e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";
import { hasCrossTenantCredentials } from "../helpers/credentials";

/**
 * Cross-tenant isolation — prevents data leaks between clinic workspaces.
 *
 * @authenticated — requires demo admin credentials plus FI_E2E_OTHER_TENANT_ID
 * for the tenant the session must NOT access.
 *
 * Maps to clinic readiness runbook §1.5–1.6.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("cross-tenant isolation @authenticated", () => {
  test.beforeEach(() => {
    test.skip(
      !hasCrossTenantCredentials(),
      "Set FI_E2E_OTHER_TENANT_ID to a second demo tenant UUID to run cross-tenant checks",
    );
  });

  test("tenant A admin cannot open tenant B financial dashboard (UI)", async ({ page }) => {
    const otherTenantId = e2eOtherTenantId()!;
    const ownTenantId = e2eTenantId();
    test.skip(otherTenantId === ownTenantId, "FI_E2E_OTHER_TENANT_ID must differ from FI_E2E_TENANT_ID");

    const protectedPath = `/fi-admin/${otherTenantId}/financial/dashboard`;
    const response = await page.goto(protectedPath, { waitUntil: "domcontentloaded" });

    const finalUrl = page.url();
    const onOtherTenantDashboard = finalUrl.includes(`/fi-admin/${otherTenantId}/financial/dashboard`);
    const denied =
      !onOtherTenantDashboard ||
      /\/follicle-intelligence\/login/.test(finalUrl) ||
      (await page.getByText(/403|access denied|not provisioned/i).count()) > 0;

    expect(denied, `Tenant A session must not render Tenant B dashboard (landed at ${finalUrl})`).toBe(
      true,
    );
    expect(onOtherTenantDashboard).toBe(false);
  });

  test("tenant A session cannot list tenant B cases via API", async ({ page }) => {
    const otherTenantId = e2eOtherTenantId()!;
    const ownTenantId = e2eTenantId();
    test.skip(otherTenantId === ownTenantId, "FI_E2E_OTHER_TENANT_ID must differ from FI_E2E_TENANT_ID");

    // Warm session cookies from authenticated page context.
    await page.goto(`/fi-admin/${ownTenantId}/financial/dashboard`, {
      waitUntil: "domcontentloaded",
    });

    const response = await page.request.get(`/api/tenants/${otherTenantId}/cases`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const status = response.status();
    expect(status, "cross-tenant cases API must never return 200").not.toBe(200);
    expect([401, 403, 302, 303, 307].includes(status)).toBe(true);
  });
});
