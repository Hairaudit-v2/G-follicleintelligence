import { test, expect } from "../fixtures/auth";
import { expectProtectedRouteFailsClosed } from "../helpers/access-denied";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Unauthenticated security smoke tests.
 *
 * @security — run on every browser in CI smoke workflow; chromium-only in
 * the dedicated security workflow for speed.
 *
 * Scope: confirm protected surfaces fail closed with no session, and the
 * public login surface still loads. No login, no data mutation.
 *
 * Requires FI_E2E_BASE_URL. Optional FI_E2E_TENANT_ID for route construction.
 *
 * Note: middleware auth guard only activates when NODE_ENV=production. Run
 * against `next build && next start` or staging — not `next dev`.
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("unauthenticated access — fails closed @security", () => {
  test("platform admin shell (/fi-admin/system) is not reachable without a session", async ({
    page,
  }) => {
    const response = await page.goto("/fi-admin/system", { waitUntil: "domcontentloaded" });
    await expectProtectedRouteFailsClosed(page, response, "/fi-admin/system");
  });

  test("tenant clinic dashboard is not reachable without a session", async ({ page }) => {
    const tenantId = e2eTenantId();
    const protectedPath = `/fi-admin/${tenantId}/financial/dashboard`;
    const response = await page.goto(protectedPath, { waitUntil: "domcontentloaded" });
    await expectProtectedRouteFailsClosed(page, response, protectedPath);
  });

  test("protected tenant API route (cases list) fails closed without a session", async ({
    request,
  }) => {
    const tenantId = e2eTenantId();
    const response = await request.get(`/api/tenants/${tenantId}/cases`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    const status = response.status();
    expect(status, "API route should never return 200 with no session").not.toBe(200);
    expect(
      [401, 403, 302, 303, 307].includes(status),
      `expected 401/403 (or a redirect) for unauthenticated cases API, got ${status}`,
    ).toBe(true);
  });

  test("public login route still loads", async ({ page }) => {
    const response = await page.goto("/fi-login", { waitUntil: "domcontentloaded" });
    expect(response, "expected a response").toBeTruthy();
    expect(response!.status(), "public login route must not fail closed").toBeLessThan(400);
    await expect(page).toHaveURL(/\/follicle-intelligence\/login/);
  });
});
