import { defineConfig, devices } from "@playwright/test";

import { loadRepoEnvFiles } from "./scripts/lib/loadRepoEnvFiles.mjs";
import { hasProductionAdminCredentials } from "./e2e/helpers/credentials";

loadRepoEnvFiles();

/**
 * Dedicated Playwright config for HubSpot production smoke.
 *
 * - Traces disabled (customer content risk)
 * - Video disabled
 * - Screenshots only via privacy-safe helpers / failure still on
 * - Single Chromium project
 * - Does not start a local server — targets FI_E2E_BASE_URL (production)
 */
const baseURL = process.env.FI_E2E_BASE_URL?.trim();

if (process.env.CI && !hasProductionAdminCredentials()) {
  console.warn(
    "[hubspot-production-smoke] Missing FI_E2E_PRODUCTION_ADMIN_* / FI_E2E_TENANT_ID / FI_E2E_BASE_URL — tests will skip.",
  );
}

export default defineConfig({
  testDir: "./e2e/hubspot-production-smoke",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report/hubspot-production-smoke" }],
    ["json", { outputFile: "test-results/hubspot-production-smoke-playwright.json" }],
  ],
  use: {
    baseURL,
    trace: "off",
    video: "off",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },
  projects: [
    {
      name: "hubspot-production-smoke",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /hubspot-production-smoke\.spec\.ts/,
    },
  ],
});
