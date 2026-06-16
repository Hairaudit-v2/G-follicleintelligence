import { test, expect } from "../fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Unauthenticated security smoke tests (Patch 7).
 *
 * Scope: confirm protected surfaces fail closed with no session, and the
 * public login surface still loads. No login, no data mutation, no
 * patient/booking/payment workflow — see e2e/fixtures/auth.ts for the
 * planned follow-up once a safe demo-credential pattern exists.
 *
 * Requires FI_E2E_BASE_URL (see e2e/fixtures/baseUrl.ts for the error you'll
 * get if it's missing). Optional FI_E2E_TENANT_ID for a real tenant UUID;
 * falls back to a syntactically valid placeholder since these checks only
 * assert "access denied," not "this tenant's data is correct".
 *
 * Note: the auth guard in middleware.ts only activates when
 * NODE_ENV=production. Run these against `next build && next start` (or a
 * deployed staging host), not `next dev` — against dev, 1.x/H/I below will
 * not exercise the fail-closed path and may render 200.
 */

test.beforeAll(() => {
  // Fail fast with a clear message instead of every test failing on a
  // missing/garbage baseURL.
  requireE2eBaseUrl();
});

test.describe("unauthenticated access — fails closed", () => {
  test("platform admin shell (/fi-admin/system) is not reachable without a session", async ({
    page,
  }) => {
    const response = await page.goto("/fi-admin/system", { waitUntil: "domcontentloaded" });
    expect(response, "expected a response").toBeTruthy();

    const status = response!.status();
    const finalUrl = page.url();

    // Either a server-side redirect (3xx, followed automatically by
    // Playwright's page.goto -> finalUrl no longer /fi-admin/system) or a
    // direct 401/403 is acceptable. A 200 with the admin shell rendered is
    // the regression this test exists to catch.
    const redirectedAway = !finalUrl.includes("/fi-admin/system");
    const failedClosed = redirectedAway || status === 401 || status === 403;

    expect(
      failedClosed,
      `expected redirect or 401/403 for unauthenticated /fi-admin/system, got status ${status} at ${finalUrl}`,
    ).toBe(true);
    expect(status, "should never return 200 for the platform admin shell without a session").not.toBe(200);
  });

  test("tenant clinic dashboard is not reachable without a session", async ({ page }) => {
    const tenantId = e2eTenantId();
    const response = await page.goto(`/fi-admin/${tenantId}/financial/dashboard`, {
      waitUntil: "domcontentloaded",
    });
    expect(response, "expected a response").toBeTruthy();

    const status = response!.status();
    const finalUrl = page.url();
    const redirectedAway = !finalUrl.includes(`/fi-admin/${tenantId}/financial/dashboard`);
    const failedClosed = redirectedAway || status === 401 || status === 403;

    expect(
      failedClosed,
      `expected redirect or 401/403 for unauthenticated tenant dashboard, got status ${status} at ${finalUrl}`,
    ).toBe(true);
    expect(status, "should never return 200 for a tenant dashboard without a session").not.toBe(200);
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

    // /fi-login redirects to /follicle-intelligence/login (see
    // app/fi-login/page.tsx) — following that redirect to a 200 is the
    // success case here; the login page must remain publicly reachable.
    expect(response!.status(), "public login route must not fail closed").toBeLessThan(400);
    await expect(page).toHaveURL(/\/follicle-intelligence\/login/);
  });
});
