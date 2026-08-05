import { authenticatedTest as test, expect } from "../fixtures/auth";
import { e2eTenantId, isLocalE2eHost, requireE2eBaseUrl } from "../fixtures/baseUrl";
import {
  allowsMutations,
  hasLowRoleCredentials,
  lowRoleEmail,
  lowRolePassword,
} from "../helpers/credentials";
import {
  findEmptyRosterCell,
  gotoTeamRoster,
  parseRosterCellDate,
  setDrawerShiftWindow,
  submitDrawerForm,
} from "../helpers/rosterDrawer";
import {
  normalizePathname,
  pathnameEndsWith,
  RETIRED_PRIMARY_NAV_LABELS,
  TEAM_ADMIN_DIAGNOSTIC_SURFACES,
  TEAM_COHESION_REDIRECT_CASES,
  TEAM_PRESERVED_HR_OS_SURFACES,
  tenantPath,
} from "../helpers/teamCohesionRoutes";
import { LoginPage } from "../pages/login.page";

/**
 * FI-TEAM-COHESION-1D — Authenticated route consolidation smoke.
 *
 * Verifies A1/A2 redirects, sidebar Team cohesion, preserved HR OS surfaces,
 * admin diagnostics, token-route exemptions, and (opt-in) mutation refresh.
 *
 * @authenticated @smoke — requires FI_E2E_BASE_URL, FI_E2E_TENANT_ID,
 * FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD.
 *
 * Optional:
 *   FI_E2E_STAFF_ACCESS_ACCEPT_TOKEN / FI_E2E_STAFF_ACCESS_PIN_SETUP_TOKEN
 *     — prove valid invite / PIN setup render without auth session
 *     Mint (no email): npx tsx scripts/e2e/mint-staff-access-token-fixtures.mts
 *     Cleanup:         npx tsx scripts/e2e/mint-staff-access-token-fixtures.mts --cleanup
 *   FI_E2E_ALLOW_MUTATIONS=1 — roster soft-refresh after mutate
 *   FI_E2E_LOW_ROLE_* — admin diagnostic access-denied for non-admin
 *
 * Run:
 *   FI_E2E_BROWSERS=edge npx playwright test \
 *     e2e/journeys/team-cohesion-smoke.spec.ts --project=edge-authenticated
 */

const ACCESS_DENIED_HEADING =
  /Access unavailable|Insufficient role|Module not enabled|Clinic not activated|Subscription inactive/i;
const LOGIN_HEADING = /sign in|log in|welcome back/i;
const NOT_FOUND = /This page could not be found|404|Not Found/i;
/** Sink email used by scripts/e2e/mint-staff-access-token-fixtures.mts */
const SINK_EMAIL_HINT = /e2e-staff-access\+cohesion1d@example\.test/i;

test.beforeAll(() => {
  requireE2eBaseUrl();
});

async function settleAuthenticatedShell(
  page: import("@playwright/test").Page,
  path: string,
  timeout: number,
): Promise<"ok" | "login" | "denied"> {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  // Soft navigations / concurrent shell remounts can briefly yield 2 shells.
  const shell = page.getByTestId("fi-os-shell").first();
  const loginCue = page.getByRole("heading", { name: LOGIN_HEADING }).first();
  const accessDenied = page.getByRole("heading", { name: ACCESS_DENIED_HEADING }).first();

  await expect(
    shell.or(loginCue).or(accessDenied),
    `expected shell, login, or access-denied after ${path} (landed ${page.url()})`,
  ).toBeVisible({ timeout });

  if (await loginCue.isVisible().catch(() => false)) return "login";
  if (await accessDenied.isVisible().catch(() => false)) return "denied";
  return "ok";
}

test.describe("Team cohesion authenticated smoke @authenticated @smoke", () => {
  test("sidebar advertises Team only; legacy labels absent", async ({ page }) => {
    const localDev = isLocalE2eHost();
    const timeout = localDev ? 60_000 : 45_000;
    test.setTimeout(localDev ? 120_000 : 90_000);

    const tenantId = e2eTenantId();
    const settle = await settleAuthenticatedShell(page, tenantPath(tenantId, "team"), timeout);
    if (settle === "login") {
      throw new Error(`authenticated session missing at ${page.url()}`);
    }
    if (settle === "denied") {
      test.skip(true, "Demo admin lacks Team entitlement on this tenant");
      return;
    }

    const shell = page.getByTestId("fi-os-shell");
    await expect(shell.getByRole("link", { name: /^Team$/i }).first()).toBeVisible({
      timeout,
    });

    for (const label of RETIRED_PRIMARY_NAV_LABELS) {
      await expect(
        shell.getByRole("link", { name: label }),
        `retired primary nav label ${label} must not be advertised`,
      ).toHaveCount(0);
    }

    const teamTab = page.getByTestId("team-sub-nav").getByTestId("team-tab-roster");
    await expect(teamTab).toBeVisible({ timeout });
    await teamTab.click();
    await expect(page).toHaveURL(pathnameEndsWith(tenantPath(tenantId, "team/roster")), {
      timeout,
    });
    await expect(teamTab).toHaveAttribute("aria-current", "page", { timeout });
  });

  test("retired legacy routes redirect once to canonical Team destinations", async ({
    page,
  }) => {
    const localDev = isLocalE2eHost();
    const timeout = localDev ? 60_000 : 45_000;
    test.setTimeout(localDev ? 300_000 : 240_000);

    const tenantId = e2eTenantId();
    const settle = await settleAuthenticatedShell(page, tenantPath(tenantId, "team"), timeout);
    if (settle === "login") throw new Error(`authenticated session missing at ${page.url()}`);
    if (settle === "denied") {
      test.skip(true, "Demo admin lacks Team entitlement on this tenant");
      return;
    }

    for (const redirectCase of TEAM_COHESION_REDIRECT_CASES) {
      const from = tenantPath(tenantId, redirectCase.fromSuffix);
      const expected = tenantPath(tenantId, redirectCase.toSuffix);
      // Marker query must survive the redirect (A2 preserves search params).
      const fromWithQuery = `${from}?cohesion=1d`;

      await page.goto(fromWithQuery, { waitUntil: "domcontentloaded" });
      await expect(
        page,
        `${redirectCase.label}: ${from} should land on ${expected}`,
      ).toHaveURL(pathnameEndsWith(expected), { timeout });

      const landed = normalizePathname(page.url());
      expect(landed, `${redirectCase.label}: unexpected pathname`).toBe(expected);
      expect(
        page.url(),
        `${redirectCase.label}: query must survive redirect`,
      ).toContain("cohesion=1d");

      // Soft loop guard: re-visiting the canonical URL must not bounce away.
      await page.goto(expected, { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(pathnameEndsWith(expected), { timeout });
      expect(normalizePathname(page.url())).toBe(expected);

      await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    }
  });

  test("preserved HR OS surfaces still render and highlight Team", async ({ page }) => {
    const localDev = isLocalE2eHost();
    const timeout = localDev ? 60_000 : 45_000;
    test.setTimeout(localDev ? 240_000 : 180_000);

    const tenantId = e2eTenantId();
    const settle = await settleAuthenticatedShell(page, tenantPath(tenantId, "team"), timeout);
    if (settle === "login") throw new Error(`authenticated session missing at ${page.url()}`);
    if (settle === "denied") {
      test.skip(true, "Demo admin lacks Team entitlement on this tenant");
      return;
    }

    for (const surface of TEAM_PRESERVED_HR_OS_SURFACES) {
      const path = tenantPath(tenantId, surface.suffix);
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Must NOT redirect into /team (exact preserved routes).
      expect(
        normalizePathname(page.url()),
        `${surface.label} must remain on ${path}`,
      ).toBe(path);

      await expect(
        page.getByRole("heading", { name: surface.heading }).first(),
        `${surface.label} heading missing at ${page.url()}`,
      ).toBeVisible({ timeout });

      // Preserved routes still light up the Team primary item.
      const teamLink = page.getByTestId("fi-os-shell").getByRole("link", { name: /^Team$/i });
      await expect(teamLink.first()).toBeVisible({ timeout });

      await expect(page.getByText(NOT_FOUND)).toHaveCount(0);
    }
  });

  test("Team admin diagnostics render under /team/admin/*", async ({ page }) => {
    const localDev = isLocalE2eHost();
    const timeout = localDev ? 60_000 : 45_000;
    test.setTimeout(localDev ? 180_000 : 120_000);

    const tenantId = e2eTenantId();
    const settle = await settleAuthenticatedShell(page, tenantPath(tenantId, "team"), timeout);
    if (settle === "login") throw new Error(`authenticated session missing at ${page.url()}`);
    if (settle === "denied") {
      test.skip(true, "Demo admin lacks Team entitlement on this tenant");
      return;
    }

    for (const surface of TEAM_ADMIN_DIAGNOSTIC_SURFACES) {
      const path = tenantPath(tenantId, surface.suffix);
      await page.goto(path, { waitUntil: "domcontentloaded" });

      const landed = normalizePathname(page.url());
      // Admin pages use notFound() for unauthorized — skip that surface if so.
      const notFoundVisible = await page.getByText(NOT_FOUND).first().isVisible().catch(() => false);
      if (notFoundVisible || /\/404\b/.test(landed)) {
        test.info().annotations.push({
          type: "note",
          description: `${surface.label} returned not-found for this admin — role gate may exclude session`,
        });
        continue;
      }

      expect(landed, `${surface.label} must stay on ${path}`).toBe(path);
      await expect(
        page.getByRole("heading", { name: surface.heading }).first(),
        `${surface.label} heading missing at ${page.url()}`,
      ).toBeVisible({ timeout });
    }
  });

  test("token child routes are not intercepted by staff-access retirement", async ({
    browser,
  }) => {
    // Public token routes — no admin session (proves middleware exemption).
    const timeout = isLocalE2eHost() ? 60_000 : 45_000;
    test.setTimeout(90_000);

    const tenantId = e2eTenantId();
    const context = await browser.newContext({ baseURL: requireE2eBaseUrl() });
    const page = await context.newPage();

    const bogusAccept = tenantPath(
      tenantId,
      "workforce-os/staff-access/accept/e2e-invalid-token-cohesion-1d",
    );
    await page.goto(bogusAccept, { waitUntil: "domcontentloaded" });
    expect(normalizePathname(page.url())).toBe(bogusAccept);
    // Must not bounce to /team/identity (parent retirement).
    expect(page.url()).not.toMatch(/\/team\/identity/);
    // Safe failure path: rose error copy or soft 404 — never admin login wall.
    const acceptFailure = page
      .getByText(/Invitation not found|expired|no longer active|not found|Ask your clinic/i)
      .or(page.getByText(NOT_FOUND));
    await expect(acceptFailure.first()).toBeVisible({ timeout });

    const bogusPin = tenantPath(
      tenantId,
      "workforce-os/staff-access/pin-setup/e2e-invalid-pin-setup-cohesion-1d",
    );
    await page.goto(bogusPin, { waitUntil: "domcontentloaded" });
    expect(normalizePathname(page.url())).toBe(bogusPin);
    expect(page.url()).not.toMatch(/\/team\/identity/);
    const pinFailure = page
      .getByText(/expired|Ask your clinic|not found|PIN setup/i)
      .or(page.getByText(NOT_FOUND));
    await expect(pinFailure.first()).toBeVisible({ timeout });

    const bogusOnboarding = tenantPath(
      tenantId,
      "onboarding/invite/e2e-invalid-onboarding-invite-cohesion-b22c",
    );
    await page.goto(bogusOnboarding, { waitUntil: "domcontentloaded" });
    expect(normalizePathname(page.url())).toBe(bogusOnboarding);
    expect(page.url()).not.toMatch(/\/team\/onboarding$/);
    expect(page.url()).not.toMatch(/\/hr-os\/onboarding/);
    const onboardingFailure = page
      .getByText(/Invitation not found|expired|no longer active|not found|Ask your clinic/i)
      .or(page.getByText(NOT_FOUND));
    await expect(onboardingFailure.first()).toBeVisible({ timeout });

    await context.close();
  });

  test("valid fixture tokens render staff-access accept and PIN setup", async ({ browser }) => {
    const acceptToken = process.env.FI_E2E_STAFF_ACCESS_ACCEPT_TOKEN?.trim();
    const pinToken = process.env.FI_E2E_STAFF_ACCESS_PIN_SETUP_TOKEN?.trim();
    test.skip(
      !acceptToken && !pinToken,
      "Set FI_E2E_STAFF_ACCESS_ACCEPT_TOKEN and/or FI_E2E_STAFF_ACCESS_PIN_SETUP_TOKEN",
    );

    const timeout = isLocalE2eHost() ? 60_000 : 45_000;
    test.setTimeout(120_000);
    const tenantId = e2eTenantId();
    const context = await browser.newContext({ baseURL: requireE2eBaseUrl() });
    const page = await context.newPage();

    if (acceptToken) {
      const path = tenantPath(tenantId, `workforce-os/staff-access/accept/${acceptToken}`);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(normalizePathname(page.url())).toBe(path);
      expect(page.url()).not.toMatch(/\/team\/identity/);
      await expect(
        page.getByText(/Invitation not found|expired|no longer active/i),
      ).toHaveCount(0);
      // Render-only: never click Confirm — just prove the invite surface mounts.
      await expect(
        page.getByRole("button", { name: /Confirm staff access/i }).or(
          page.getByRole("heading", { name: /staff access|Welcome|Invite/i }),
        ).first(),
      ).toBeVisible({ timeout });
      await expect(page.getByText(SINK_EMAIL_HINT)).toBeVisible({ timeout });
    }

    if (pinToken) {
      const path = tenantPath(tenantId, `workforce-os/staff-access/pin-setup/${pinToken}`);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(normalizePathname(page.url())).toBe(path);
      expect(page.url()).not.toMatch(/\/team\/identity/);
      await expect(page.getByText(/This PIN setup link has expired/i)).toHaveCount(0);
      // Render-only: never click Save PIN.
      await expect(
        page.getByRole("heading", { name: /Set your staff PIN/i }),
      ).toBeVisible({ timeout });
      await expect(page.getByRole("button", { name: /Save PIN/i })).toBeVisible({ timeout });
    }

    await context.close();
  });

  test("roster edit soft-refreshes canonical /team/roster", async ({ page }) => {
    test.skip(!allowsMutations(), "Set FI_E2E_ALLOW_MUTATIONS=1 on a throwaway tenant");

    const localDev = isLocalE2eHost();
    test.setTimeout(localDev ? 300_000 : 240_000);
    const tenantId = e2eTenantId();
    const marker = `e2e-cohesion-1d-${Date.now()}`;

    await gotoTeamRoster(page, tenantId);
    await expect(page).toHaveURL(pathnameEndsWith(tenantPath(tenantId, "team/roster")));
    await expect(page.getByTestId("roster-manage-denied-banner")).toHaveCount(0);

    const { cellTestId } = await findEmptyRosterCell(page, { requireDrawer: true });
    const drawer = page.getByTestId("roster-shift-drawer");
    await expect(drawer).toBeVisible({ timeout: 30_000 });

    const localDate = parseRosterCellDate(cellTestId);
    const notesField = drawer
      .getByTestId("roster-manual-shift-form")
      .locator('input[placeholder="Manual adjustment"]');
    await notesField.fill(marker);
    await setDrawerShiftWindow(drawer, localDate, 15);
    await submitDrawerForm(page);
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    // Soft refresh — URL stays canonical; no full navigation to legacy paths.
    expect(normalizePathname(page.url())).toBe(tenantPath(tenantId, "team/roster"));
    await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });
    await expect
      .poll(async () => page.getByTestId(cellTestId).locator('[data-testid^="roster-shift-"]').count())
      .toBeGreaterThan(0, { timeout: 60_000 });

    // Cleanup cancel so the run is not leave litter.
    await page.getByTestId(cellTestId).locator('[data-testid^="roster-shift-"]').first().click();
    await expect(drawer).toBeVisible();
    if (await drawer.getByTestId("roster-shift-cancel-section").isVisible().catch(() => false)) {
      await drawer.getByTestId("roster-shift-cancellation-reason").selectOption({ index: 1 });
      await drawer.getByTestId("roster-shift-cancel-confirm").click();
      await expect(drawer).toBeHidden({ timeout: 60_000 });
    }
    expect(normalizePathname(page.url())).toBe(tenantPath(tenantId, "team/roster"));
  });
});

test.describe("Team admin access-denied (low role) @authenticated @smoke", () => {
  test("non-admin is denied Team admin diagnostics", async ({ browser }) => {
    test.skip(!hasLowRoleCredentials(), "Set FI_E2E_LOW_ROLE_EMAIL and FI_E2E_LOW_ROLE_PASSWORD");

    const timeout = isLocalE2eHost() ? 60_000 : 45_000;
    test.setTimeout(120_000);
    const tenantId = e2eTenantId();

    const context = await browser.newContext({ baseURL: requireE2eBaseUrl() });
    const page = await context.newPage();
    const login = new LoginPage(page);
    await login.goto(tenantPath(tenantId, "team"));
    await login.signIn(lowRoleEmail(), lowRolePassword());
    await page.waitForURL(new RegExp(`/fi-admin/${tenantId}/`), { timeout: 45_000 });

    for (const surface of TEAM_ADMIN_DIAGNOSTIC_SURFACES) {
      const path = tenantPath(tenantId, surface.suffix);
      await page.goto(path, { waitUntil: "domcontentloaded" });
      const landed = page.url();
      const notFoundVisible = await page.getByText(NOT_FOUND).first().isVisible().catch(() => false);
      const accessDenied = await page
        .getByRole("heading", { name: ACCESS_DENIED_HEADING })
        .isVisible()
        .catch(() => false);
      const moduleUnavailable =
        /module-unavailable|featureDenied=/i.test(landed) ||
        (await page.getByText(/not enabled|unavailable|do not have access/i).first().isVisible().catch(() => false));
      const stillOnAdmin = normalizePathname(landed) === path;
      expect(
        notFoundVisible || accessDenied || moduleUnavailable || !stillOnAdmin,
        `${surface.label} must deny low-role user (got ${landed})`,
      ).toBe(true);
    }

    await context.close();
  });
});
