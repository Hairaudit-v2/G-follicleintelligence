import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { loadRepoEnvFiles } from "./scripts/lib/loadRepoEnvFiles.mjs";
import {
  hasDemoCredentials,
  hasRosterManagerCredentials,
  hasRosterViewOnlyCredentials,
} from "./e2e/helpers/credentials";

loadRepoEnvFiles();

/**
 * Playwright config for FI OS e2e journeys.
 *
 * Test tiers (grep tags):
 *   @security      — unauthenticated fail-closed checks (CI security workflow)
 *   @smoke         — public read-only business surfaces (cross-browser CI)
 *   @authenticated — tenant-admin journeys (requires demo credentials env;
 *                    excluded from public projects via grepInvert)
 *
 * Does NOT start a dev/build server — tests run against FI_E2E_BASE_URL
 * (local `next start` production build or staging). Auth middleware only
 * activates when NODE_ENV=production (see middleware.ts).
 */

const BROWSER_MATRIX = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "edge", use: { ...devices["Desktop Chrome"], channel: "msedge" } },
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] },
  { name: "mobile-chrome", use: devices["Pixel 5"] },
  { name: "mobile-safari", use: devices["iPhone 13"] },
] as const;

function isLocalE2eHost(): boolean {
  const base = process.env.FI_E2E_BASE_URL?.trim() ?? "";
  return /localhost|127\.0\.0\.1/i.test(base);
}

/** Limit browsers locally/CI via FI_E2E_BROWSERS=edge,chromium,firefox */
function activeBrowsers(): typeof BROWSER_MATRIX[number][] {
  const filter = process.env.FI_E2E_BROWSERS?.trim();
  if (!filter) return [...BROWSER_MATRIX];
  const allowed = new Set(
    filter
      .split(",")
      .map((b) => b.trim().toLowerCase())
      .filter(Boolean),
  );
  const selected = BROWSER_MATRIX.filter((b) => allowed.has(b.name));
  if (selected.length === 0) {
    throw new Error(
      `FI_E2E_BROWSERS=${filter} matched no projects. Valid: ${BROWSER_MATRIX.map((b) => b.name).join(", ")}`,
    );
  }
  return selected;
}

const publicProjects: PlaywrightTestConfig["projects"] = activeBrowsers().flatMap((browser) => [
  {
    name: browser.name,
    use: { ...browser.use },
    // Public job has no FI_E2E_DEMO_ADMIN_* — exclude dual-tagged @authenticated @smoke
    // so credentialed journeys only run on *-authenticated projects (PUB-AUTH-CRASH).
    grep: /@security|@smoke|@a11y/,
    grepInvert: /@authenticated/,
  },
]);

const authenticatedProjects: PlaywrightTestConfig["projects"] = hasDemoCredentials()
  ? activeBrowsers().map((browser) => ({
      name: `${browser.name}-authenticated`,
      use: { ...browser.use },
      grep: /@authenticated|@mutation/,
      grepInvert: /@roster-manager|@roster-view-only/,
      testMatch:
        /journeys\/.*\.spec\.ts|fi-operational-day\.spec\.ts|fi-prod-feature-smoke\.spec\.ts|fi-ux-workspace-shell-validation\.spec\.ts|fi-ux-tablet-layout\.spec\.ts|fi-ux-audit-labels\.spec\.ts|fi-trust-.*\.spec\.ts|calendar-os-.*\.spec\.ts|fi-ux-d6.*\.spec\.ts/,
    }))
  : [];

const rosterManagerProjects: PlaywrightTestConfig["projects"] = hasRosterManagerCredentials()
  ? activeBrowsers().map((browser) => ({
      name: `${browser.name}-roster-manager`,
      use: { ...browser.use },
      grep: /@roster-manager/,
      testMatch: /journeys\/roster-permission-validation\.spec\.ts/,
      timeout: 300_000,
    }))
  : [];

const rosterViewOnlyProjects: PlaywrightTestConfig["projects"] = hasRosterViewOnlyCredentials()
  ? activeBrowsers().map((browser) => ({
      name: `${browser.name}-roster-view-only`,
      use: { ...browser.use },
      grep: /@roster-view-only/,
      testMatch: /journeys\/roster-permission-validation\.spec\.ts/,
      timeout: 180_000,
    }))
  : [];

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Local `next start` cannot serve 8 parallel browser sessions reliably.
  workers: isLocalE2eHost() ? 2 : undefined,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["dot"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.FI_E2E_BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: process.env.CI ? "retain-on-failure" : "off",
  },
  projects: [
    ...publicProjects,
    ...authenticatedProjects,
    ...rosterManagerProjects,
    ...rosterViewOnlyProjects,
  ],
});
