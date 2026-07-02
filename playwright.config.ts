import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";

import { hasDemoCredentials } from "./e2e/helpers/credentials";

/**
 * Playwright config for FI OS e2e journeys.
 *
 * Test tiers (grep tags):
 *   @security      — unauthenticated fail-closed checks (CI security workflow)
 *   @smoke         — public read-only business surfaces (cross-browser CI)
 *   @authenticated — tenant-admin journeys (requires demo credentials env)
 *
 * Does NOT start a dev/build server — tests run against FI_E2E_BASE_URL
 * (local `next start` production build or staging). Auth middleware only
 * activates when NODE_ENV=production (see middleware.ts).
 */

const BROWSER_MATRIX = [
  { name: "chromium", use: devices["Desktop Chrome"] },
  { name: "firefox", use: devices["Desktop Firefox"] },
  { name: "webkit", use: devices["Desktop Safari"] },
  { name: "mobile-chrome", use: devices["Pixel 5"] },
  { name: "mobile-safari", use: devices["iPhone 13"] },
] as const;

function isLocalE2eHost(): boolean {
  const base = process.env.FI_E2E_BASE_URL?.trim() ?? "";
  return /localhost|127\.0\.0\.1/i.test(base);
}

/** Limit browsers locally/CI via FI_E2E_BROWSERS=chromium,firefox */
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
    grep: /@security|@smoke|@a11y/,
  },
]);

const authenticatedProjects: PlaywrightTestConfig["projects"] = hasDemoCredentials()
  ? activeBrowsers().map((browser) => ({
      name: `${browser.name}-authenticated`,
      use: { ...browser.use },
      grep: /@authenticated|@mutation/,
      testMatch: /journeys\/.*\.spec\.ts|fi-operational-day\.spec\.ts|fi-ux-workspace-shell-validation\.spec\.ts/,
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
  projects: [...publicProjects, ...authenticatedProjects],
});
