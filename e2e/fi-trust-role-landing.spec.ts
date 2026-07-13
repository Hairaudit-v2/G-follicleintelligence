/**
 * FI-TRUST-LANDING-AND-SPINE-1 — post-login role homes (authenticated).
 *
 * Env: FI_E2E_BASE_URL, FI_E2E_TENANT_ID, FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD
 * Optional: FI_E2E_EXPECTED_LANDING_PATH_SUFFIX — e.g. /front-desk, /crm, /doctor, /financial-os,
 *           or leave unset to assert only that login does not land on /cases.
 *
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 npx playwright test e2e/fi-trust-role-landing.spec.ts --project=chromium
 */
import { test, expect } from "@playwright/test";

import {
  demoAdminEmail,
  demoAdminPassword,
  hasDemoCredentials,
} from "./helpers/credentials";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";
import { LoginPage } from "./pages/login.page";

const TENANT = () => e2eTenantId();

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("FI trust role landing @authenticated @smoke", () => {
  test.skip(!hasDemoCredentials(), "Set FI_E2E_DEMO_ADMIN_* and FI_E2E_TENANT_ID");

  test("post-login does not default to Cases worklist", async ({ page }) => {
    const tid = TENANT();
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(demoAdminEmail(), demoAdminPassword());
    await page.waitForURL(new RegExp(`/fi-admin/${tid}(?:/|$)`), { timeout: 30_000 });

    const url = page.url();
    expect(url).not.toMatch(new RegExp(`/fi-admin/${tid}/cases(?:/|$)`));
  });

  test("legacy LeadFlow URL redirects to Pipeline", async ({ page }) => {
    test.skip(!hasDemoCredentials(), "demo credentials required");
    const tid = TENANT();
    const login = new LoginPage(page);
    await login.goto(`/fi-admin/${tid}/leadflow`);
    await login.signIn(demoAdminEmail(), demoAdminPassword());
    await page.waitForURL(new RegExp(`/fi-admin/${tid}/crm(?:/|$|\\?)`), { timeout: 30_000 });
  });

  test("optional FI_E2E_EXPECTED_LANDING_PATH_SUFFIX matches role home", async ({ page }) => {
    const expectedRaw = process.env.FI_E2E_EXPECTED_LANDING_PATH_SUFFIX;
    test.skip(
      expectedRaw === undefined,
      "Set FI_E2E_EXPECTED_LANDING_PATH_SUFFIX to assert a specific role landing"
    );

    const tid = TENANT();
    const suffix = expectedRaw?.trim() ?? "";
    const login = new LoginPage(page);
    await login.goto();
    await login.signIn(demoAdminEmail(), demoAdminPassword());

    if (!suffix || suffix === "/") {
      await page.waitForURL(new RegExp(`/fi-admin/${tid}/?$`), { timeout: 30_000 });
      return;
    }

    const normalized = suffix.startsWith("/") ? suffix : `/${suffix}`;
    await page.waitForURL(new RegExp(`/fi-admin/${tid}${normalized}(?:/|$|\\?)`), {
      timeout: 30_000,
    });
  });
});
