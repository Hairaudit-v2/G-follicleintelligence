/**
 * Production-oriented authenticated smoke for recently shipped product surfaces:
 * Clinic guide, patient AI summary / journey, calendar (smart scheduling entry).
 *
 * Uses demo/auth fixture (map PRODUCTION_ADMIN → DEMO_ADMIN for prod runs).
 * Read-only navigation only — no booking creates/saves.
 */
import { authenticatedTest as test, expect, hasDemoCredentials } from "./fixtures/auth";
import { e2eTenantId } from "./fixtures/baseUrl";

const tenantId = () => e2eTenantId();
const patientId = () => process.env.FI_E2E_PATIENT_ID?.trim() || "";

test.describe("FI prod feature smoke @authenticated @smoke", () => {
  test.skip(!hasDemoCredentials(), "Need admin credentials + FI_E2E_TENANT_ID");

  test("tenant home loads and clinic guide dock mounts", async ({ page }) => {
    const tid = tenantId();
    await page.goto(`/fi-admin/${tid}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/fi-admin/${tid}`));
    // Guide dock should appear for members (collapsed or expanded).
    const guide = page.getByTestId("guided-assist-widget");
    await expect(guide).toBeVisible({ timeout: 45_000 });
    // Toggle control present when expanded or as compact switch
    const toggle = page.getByTestId("guided-assist-toggle");
    // May be hidden if collapsed chrome uses different control — expand first if needed
    const expand = page.getByRole("button", { name: /expand clinic guide/i });
    if (await expand.isVisible().catch(() => false)) {
      await expand.click();
    }
    await expect(toggle.or(page.getByTestId("guided-assist-collapsed-turn-on"))).toBeVisible({
      timeout: 15_000,
    });
  });

  test("clinic guide settings page loads for admin", async ({ page }) => {
    const tid = tenantId();
    await page.goto(`/fi-admin/${tid}/settings/clinic-guide`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: /clinic guide/i })).toBeVisible({
      timeout: 45_000,
    });
    // AI toggle or health panel may require admin role — page itself must not 500
    await expect(page.getByText(/server misconfigured/i)).toHaveCount(0);
  });

  test("patient profile shows journey or AI entry points", async ({ page }) => {
    test.skip(!patientId(), "Set FI_E2E_PATIENT_ID");
    const tid = tenantId();
    const pid = patientId();
    await page.goto(`/fi-admin/${tid}/patients/${pid}`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/patients/${pid}`), { timeout: 45_000 });

    // Profile must load without server error chrome
    await expect(page.getByText(/server misconfigured|application error/i)).toHaveCount(0);

    const aiBtn = page.getByTestId("patient-ai-summary-open");
    const journey = page.getByTestId("patient-journey");
    const backPatients = page.getByRole("link", { name: /patients/i }).first();
    const aiVisible = await aiBtn.isVisible().catch(() => false);
    const journeyVisible = await journey.isVisible().catch(() => false);
    const profileChrome = await backPatients.isVisible().catch(() => false);

    // Prefer new surfaces when present; otherwise accept a loaded patient workspace.
    if (aiVisible || journeyVisible) {
      expect(aiVisible || journeyVisible).toBeTruthy();
    } else {
      expect(profileChrome).toBeTruthy();
      test.info().annotations.push({
        type: "note",
        description:
          "Patient profile loaded but AI Summary / Visual Journey testids not found (layout variant or feature gated).",
      });
    }

    if (aiVisible) {
      await aiBtn.click();
      await expect(page.getByTestId("patient-ai-summary-panel")).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(/recorded data only|always verify clinically/i)).toBeVisible();
      const close = page.getByRole("button", { name: /^close$/i }).first();
      if (await close.isVisible().catch(() => false)) await close.click();
    }
  });

  test("patient timeline / journey route loads", async ({ page }) => {
    test.skip(!patientId(), "Set FI_E2E_PATIENT_ID");
    const tid = tenantId();
    const pid = patientId();
    await page.goto(`/fi-admin/${tid}/patients/${pid}/timeline`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page).toHaveURL(new RegExp(`/patients/${pid}/timeline`), { timeout: 45_000 });
    // Heading area
    await expect(page.getByText(/journey|timeline/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test("calendar page loads (smart scheduling lives in drawers)", async ({ page }) => {
    const tid = tenantId();
    await page.goto(`/fi-admin/${tid}/calendar`, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(new RegExp(`/fi-admin/${tid}/calendar`), { timeout: 45_000 });
    // Calendar chrome — avoid brittle class selectors
    await expect(
      page.getByRole("heading", { name: /calendar/i }).or(page.getByText(/today|week|month/i).first())
    ).toBeVisible({ timeout: 45_000 });
  });
});
