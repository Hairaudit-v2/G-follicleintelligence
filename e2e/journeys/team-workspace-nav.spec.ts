import { authenticatedTest as test, expect } from "../fixtures/auth";
import { e2eTenantId, isLocalE2eHost, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * Team workspace tab navigation — consolidated /team/* sub-nav.
 *
 * @authenticated — requires FI_E2E_BASE_URL, FI_E2E_TENANT_ID,
 * FI_E2E_DEMO_ADMIN_EMAIL, FI_E2E_DEMO_ADMIN_PASSWORD (entitled manager/admin).
 *
 * Run:
 *   FI_E2E_BASE_URL=http://localhost:3000 FI_E2E_TENANT_ID=<uuid> \
 *     FI_E2E_DEMO_ADMIN_EMAIL=... FI_E2E_DEMO_ADMIN_PASSWORD=... \
 *     npx playwright test e2e/journeys/team-workspace-nav.spec.ts --project=edge-authenticated --headed
 */

type TeamTabSpec = {
  id: string;
  label: string;
  segment: string;
  heading: RegExp;
};

const TEAM_TABS: TeamTabSpec[] = [
  { id: "overview", label: "Team overview", segment: "", heading: /Workforce Intelligence Centre/i },
  { id: "staff", label: "Staff directory", segment: "staff", heading: /Staff Directory/i },
  { id: "roster", label: "Roster", segment: "roster", heading: /Roster Command Centre/i },
  { id: "onboarding", label: "Onboarding", segment: "onboarding", heading: /Onboarding Centre/i },
  { id: "compliance", label: "Compliance", segment: "compliance", heading: /^Compliance$/i },
  { id: "training", label: "Training", segment: "training", heading: /Certifications/i },
  { id: "identity", label: "Identity & access", segment: "identity", heading: /Staff Access Centre/i },
];

const ACCESS_DENIED_HEADING =
  /Access unavailable|Insufficient role|Module not enabled|Clinic not activated|Subscription inactive/i;

function teamBasePath(tenantId: string): string {
  return `/fi-admin/${tenantId}/team`;
}

function teamTabPath(tenantId: string, segment: string): string {
  const base = teamBasePath(tenantId);
  return segment ? `${base}/${segment}` : base;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function urlPatternForPath(path: string): RegExp {
  return new RegExp(`${escapeRegExp(path)}/?$`);
}

function normalizePathname(url: string): string {
  try {
    const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";
    return pathname;
  } catch {
    return url.replace(/\/+$/, "") || "/";
  }
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("Team workspace navigation @authenticated @smoke", () => {
  test("manager/admin can navigate all seven Team tabs with responsive feedback", async ({
    page,
  }) => {
    const localDev = isLocalE2eHost();
    const navTimeout = localDev ? 60_000 : 30_000;
    const tabContentTimeout = localDev ? 90_000 : 30_000;
    test.setTimeout(localDev ? 300_000 : 60_000);

    const tenantId = e2eTenantId();
    const teamBase = teamBasePath(tenantId);

    await page.goto(teamBase, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("team-sub-nav")).toBeVisible();

    const nav = page.getByTestId("team-sub-nav");
    for (const tab of TEAM_TABS) {
      await expect(nav.getByTestId(`team-tab-${tab.id}`)).toBeVisible();
    }

    let previousPath = normalizePathname(page.url());

    for (const tab of TEAM_TABS) {
      const expectedPath = teamTabPath(tenantId, tab.segment);
      const tabLink = nav.getByTestId(`team-tab-${tab.id}`);

      await expect(tabLink).toHaveText(tab.label);
      await expect(tabLink).toHaveAttribute("href", expectedPath);

      await tabLink.click();

      await expect(page).toHaveURL(urlPatternForPath(expectedPath), { timeout: navTimeout });

      const currentPath = normalizePathname(page.url());
      if (currentPath !== previousPath) {
        expect(currentPath, `expected URL to change to ${expectedPath}`).toBe(expectedPath);
      } else {
        expect(currentPath, `expected to remain on ${expectedPath}`).toBe(expectedPath);
      }
      previousPath = currentPath;

      await expect(async () => {
        const pending = await tabLink.getAttribute("data-pending");
        const active = await tabLink.getAttribute("aria-current");
        if (pending === "true" || active === "page") return;
        throw new Error(`tab ${tab.id} should show pending or active state after click`);
      }).toPass({ timeout: 10_000 });

      const skeleton = page.getByTestId("team-workspace-page-loading");
      const heading = page.getByRole("heading", { name: tab.heading });

      if (await skeleton.isVisible().catch(() => false)) {
        await expect(skeleton).toBeHidden({ timeout: tabContentTimeout });
      }
      await expect(heading).toBeVisible({ timeout: tabContentTimeout });

      await expect(tabLink).toHaveAttribute("aria-current", "page", { timeout: navTimeout });

      await expect(page.getByRole("heading", { name: ACCESS_DENIED_HEADING })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: /not found|404/i })).toHaveCount(0);
      await expect(page.getByText(/This page could not be found/i)).toHaveCount(0);
    }
  });
});
