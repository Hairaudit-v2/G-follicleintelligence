/**
 * FI-UX-REBUILD D6D — Cross-workspace signal sync E2E.
 *
 * Opt-in:
 *   FI_E2E_D6_WORKSPACE_SYNC=true
 *   FI_E2E_TODAY_SURFACE_ENABLED=true
 *   FI_TODAY_SIGNAL_REVISION_POLL=true
 *
 *   npx playwright test e2e/fi-ux-d6d-workspace-signal-sync.spec.ts --project=chromium-authenticated
 */
import { expect, test } from "@playwright/test";

import { authenticatedTest, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";

const baseTest = hasDemoCredentials() ? authenticatedTest : test;

function TENANT(): string {
  return e2eTenantId();
}

function workspaceSyncOptedIn(): boolean {
  return process.env.FI_E2E_D6_WORKSPACE_SYNC?.trim().toLowerCase() === "true";
}

function todaySurfaceOptedIn(): boolean {
  return process.env.FI_E2E_TODAY_SURFACE_ENABLED?.trim().toLowerCase() === "true";
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

baseTest.describe("FI-UX-REBUILD D6D workspace signal sync @authenticated", () => {
  baseTest.beforeEach(() => {
    baseTest.skip(!hasDemoCredentials(), "Demo admin credentials required");
    baseTest.skip(!workspaceSyncOptedIn(), "Set FI_E2E_D6_WORKSPACE_SYNC=true to run");
    baseTest.skip(!todaySurfaceOptedIn(), "Set FI_E2E_TODAY_SURFACE_ENABLED=true to run");
  });

  baseTest("revision API returns non-PHI workspace signal snapshot", async ({ page }) => {
    const res = await page.request.get(
      `/api/tenants/${encodeURIComponent(TENANT())}/today-signal/revision`
    );
    expect(res.status()).toBeLessThan(500);
    const json = (await res.json()) as {
      revision?: string;
      workspaceSignals?: Array<{ signalType?: string; targetRefs?: unknown[] }>;
    };
    expect(json.revision).toMatch(/^[0-9a-f]{8}$/);
    expect(Array.isArray(json.workspaceSignals)).toBe(true);
    const serialized = JSON.stringify(json.workspaceSignals ?? []);
    expect(serialized).not.toMatch(/personLabel|patientName|James|amount/i);
  });

  baseTest("open patient workspace stays on page after shallow workspace URL", async ({ page }) => {
    const patientId = process.env.FI_E2E_WORKSPACE_PATIENT_ID?.trim();
    baseTest.skip(!patientId, "Set FI_E2E_WORKSPACE_PATIENT_ID to a tenant patient UUID");

    const startPath = `/fi-admin/${TENANT()}/patients`;
    await page.goto(`${startPath}?workspace=patient:${patientId}`);
    await expect(page).toHaveURL(new RegExp(`workspace=patient:${patientId}`));
    await expect(page.getByRole("dialog", { name: "Patient preview" })).toBeVisible();

    const res = await page.request.get(
      `/api/tenants/${encodeURIComponent(TENANT())}/today-signal/revision`
    );
    expect(res.ok()).toBeTruthy();

    await expect(page).toHaveURL(new RegExp(`workspace=patient:${patientId}`));
    await expect(page.getByRole("dialog", { name: "Patient preview" })).toBeVisible();
  });
});
