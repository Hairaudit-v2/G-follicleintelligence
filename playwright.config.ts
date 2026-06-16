import { defineConfig, devices } from "@playwright/test";

/**
 * Minimal Playwright foundation for FI OS readiness checks.
 *
 * Scope (Patch 7): unauthenticated security smoke tests only. This config
 * deliberately does NOT start a dev/build server itself — tests run against
 * whatever host FI_E2E_BASE_URL points at (a local `next start` production
 * build, or a staging deployment). That keeps this suite safe to point at a
 * real staging clinic without ever risking a `next dev` run with relaxed
 * behavior, and avoids the harness silently spinning up a server that
 * doesn't reflect production auth behavior (see middleware.ts — the auth
 * guard only activates when NODE_ENV=production).
 *
 * Required env: FI_E2E_BASE_URL (e.g. http://localhost:3000 or
 * https://<staging-host>). Tests fail with a clear message if it's missing
 * — see e2e/fixtures/baseUrl.ts.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: process.env.FI_E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
