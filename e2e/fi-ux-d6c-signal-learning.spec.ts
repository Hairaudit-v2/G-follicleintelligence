/**
 * FI-UX-REBUILD D6C — Signal Learning internal intelligence surface.
 *
 * Opt-in checks:
 *   FI_E2E_D6_SIGNAL_LEARNING=true
 *   FI_TODAY_SIGNAL_LEARNING_ENABLED=true
 *   FI_E2E_TODAY_SURFACE_ENABLED=true
 *
 *   npx playwright test e2e/fi-ux-d6c-signal-learning.spec.ts --project=chromium-authenticated
 */
import { expect, test } from "@playwright/test";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function TENANT(): string {
  return e2eTenantId();
}

function signalLearningOptedIn(): boolean {
  return process.env.FI_E2E_D6_SIGNAL_LEARNING?.trim().toLowerCase() === "true";
}

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

function learningEnabled(): boolean {
  return process.env.FI_TODAY_SIGNAL_LEARNING_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

baseTest.describe("FI-UX-REBUILD D6C signal learning @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
    baseTest.skip(!signalLearningOptedIn(), "Set FI_E2E_D6_SIGNAL_LEARNING=true to run");
    baseTest.skip(!todaySurfaceOptedIn(), "Set FI_E2E_TODAY_SURFACE_ENABLED=true to run");
    baseTest.skip(!learningEnabled(), "Set FI_TODAY_SIGNAL_LEARNING_ENABLED=true to run");
  });

  baseTest("admin can open signal learning route without PHI-like fields", async ({ page }) => {
    const route = `/fi-admin/${TENANT()}/intelligence/signal-learning`;
    const res = await page.goto(route);
    expect(res?.status()).toBeLessThan(500);

    await expect(page.getByRole("heading", { name: "Signal Learning" })).toBeVisible();

    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(/signal_key|entity_id|priorityReasons|personLabel|patientName/i);
    expect(bodyText).not.toMatch(/::booking::|::payment::/);
  });
});
