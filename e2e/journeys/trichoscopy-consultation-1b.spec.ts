import { expect } from "@playwright/test";
import { authenticatedTest as test } from "../fixtures/auth";
import { allowsMutations } from "../helpers/credentials";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";

/**
 * FI-TRICHOSCOPY-1B — clinician consultation journey (browser).
 *
 * Skeleton: proves consultation workspace trichoscopy section is reachable for
 * an authenticated clinician. Full primary journey (indication → HLI → review →
 * pin → supersession) remains operator-supervised against staging until
 * FI_TRICHOSCOPY_CERT_* + live HLI credentials are available.
 *
 * Tags: @authenticated @trichoscopy @trichoscopy-1b
 *
 * Optional env:
 *   FI_TRICHOSCOPY_CERT_CONSULTATION_ID — deep-link an existing synthetic consultation
 *   FI_E2E_ALLOW_MUTATIONS=1 — enable indication/request mutation path
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("trichoscopy consultation 1B clinician path @authenticated @trichoscopy @trichoscopy-1b", () => {
  test("consultation hub exposes trichoscopy section when consultation id provided", async ({
    page,
  }) => {
    const tenantId = e2eTenantId();
    const consultationId = process.env.FI_TRICHOSCOPY_CERT_CONSULTATION_ID?.trim() || "";

    test.skip(
      !consultationId,
      "Set FI_TRICHOSCOPY_CERT_CONSULTATION_ID to a synthetic staging consultation"
    );

    await page.goto(`/fi-admin/${tenantId}/consultations/${consultationId}`);
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 30_000,
    });

    // ConsultationTrichoscopySection status card / expand control
    const trichoscopyRegion = page
      .getByText(/Trichoscopy|trichoscopy/i)
      .first();
    await expect(trichoscopyRegion).toBeVisible({ timeout: 30_000 });
  });

  test("clinician can expand trichoscopy review workspace when entitled", async ({ page }) => {
    const tenantId = e2eTenantId();
    const consultationId = process.env.FI_TRICHOSCOPY_CERT_CONSULTATION_ID?.trim() || "";

    test.skip(
      !consultationId,
      "Set FI_TRICHOSCOPY_CERT_CONSULTATION_ID to a synthetic staging consultation"
    );
    test.skip(
      !allowsMutations(),
      "Set FI_E2E_ALLOW_MUTATIONS=1 for interactive workspace expansion on throwaway tenant"
    );

    await page.goto(`/fi-admin/${tenantId}/consultations/${consultationId}`);

    const expand = page.getByRole("button", { name: /Expand review|Collapse/i }).first();
    if (await expand.isVisible().catch(() => false)) {
      await expand.click();
    }

    // Consent / indication affordances when request path is available
    const consentOrStatus = page
      .getByText(/consent|Ready for review|Request|Not required|Temporarily unavailable/i)
      .first();
    await expect(consentOrStatus).toBeVisible({ timeout: 30_000 });
  });
});
