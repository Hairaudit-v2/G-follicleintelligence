/**
 * FI-UX-REBUILD D1 (P0B) — workspace shell smoke coverage.
 *
 * Opt-in via env (same pattern as Today surface):
 *   FI_E2E_WORKSPACE_SHELL_ENABLED=true
 *   FI_WORKSPACE_SHELL_TENANT_IDS=<FI_E2E_TENANT_ID>
 *
 * Run:
 *   npx playwright test e2e/fi-ux-workspace-shell.spec.ts
 */

import { expect, test } from "@playwright/test";

const E2E_TENANT_ID = process.env.FI_E2E_TENANT_ID?.trim();
const WORKSPACE_SHELL_E2E =
  process.env.FI_E2E_WORKSPACE_SHELL_ENABLED?.trim().toLowerCase() === "true";

function tenantHomeUrl(): string {
  return `/fi-admin/${E2E_TENANT_ID}`;
}

test.describe("FI-UX-REBUILD D1 Workspace shell @smoke", () => {
  test.skip(
    !WORKSPACE_SHELL_E2E || !E2E_TENANT_ID,
    "Set FI_E2E_WORKSPACE_SHELL_ENABLED=true and FI_E2E_TENANT_ID (plus FI_WORKSPACE_SHELL_TENANT_IDS) to run workspace shell checks"
  );

  test("opens patient workspace from shallow URL without route change", async ({ page }) => {
    const patientId = process.env.FI_E2E_PATIENT_ID?.trim();
    test.skip(!patientId, "FI_E2E_PATIENT_ID required for workspace open assertion");

    await page.goto(`${tenantHomeUrl()}?workspace=patient:${patientId}`);
    await expect(page.getByRole("dialog", { name: /patient preview/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`workspace=patient:${patientId}`));
  });
});
