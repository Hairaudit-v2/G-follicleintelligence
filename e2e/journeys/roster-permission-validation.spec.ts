import { rosterManagerTest as managerTest, rosterViewOnlyTest as viewOnlyTest, expect } from "../fixtures/rosterAuth";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";
import { allowsRosterMutations } from "../helpers/credentials";
import {
  clickDrawerButton,
  closeDrawer,
  findEmptyRosterCell,
  gotoTeamRoster,
  openShiftInCellByNotes,
  parseRosterCellDate,
  setDrawerShiftWindow,
  submitDrawerForm,
} from "../helpers/rosterDrawer";

/**
 * Roster permission validation — manager CRUD with refresh persistence + view-only deny alert.
 *
 * Manager login: paul@evolvedhair.com.au by default (override FI_E2E_ROSTER_MANAGER_EMAIL).
 * Note: manager@evolvedhair.com.au is tenant_backend without fi_tenant_admin_users — portal denied.
 * View-only login: danicamiloseski24@gmail.com (override FI_E2E_ROSTER_VIEW_ONLY_EMAIL).
 *
 * Auth uses Supabase magic links (service role) — no password env required.
 *
 * Run (production):
 *   FI_E2E_BASE_URL=https://follicleintelligence.ai FI_E2E_ALLOW_MUTATIONS=1 \
 *     npx playwright test e2e/journeys/roster-permission-validation.spec.ts \
 *     --project=edge-roster-manager --project=edge-roster-view-only
 */

managerTest.beforeAll(() => {
  requireE2eBaseUrl();
});

viewOnlyTest.beforeAll(() => {
  requireE2eBaseUrl();
});

managerTest.describe("Roster manager permission validation @roster-manager @mutation", () => {
  managerTest("manager can create, persist, edit, and cancel a test shift", async ({ page }) => {
    managerTest.skip(!allowsRosterMutations(), "Set FI_E2E_ALLOW_MUTATIONS=1 for roster shift mutations");

    const tenantId = e2eTenantId();
    const marker = `e2e-roster-perm-${Date.now()}`;
    const editedMarker = `${marker}-edited`;
    managerTest.setTimeout(300_000);

    // Steps 1–2: Log in (fixture) → Team → Roster
    await gotoTeamRoster(page, tenantId);
    await expect(page.getByTestId("roster-manage-denied-banner")).toHaveCount(0);

    // Steps 3–4: Click empty cell → drawer opens
    const { cell: targetCell, cellTestId: targetCellTestId } = await findEmptyRosterCell(page, {
      requireDrawer: true,
    });
    const drawer = page.getByTestId("roster-shift-drawer");
    await expect(drawer).toBeVisible({ timeout: 30_000 });
    await expect(drawer.getByTestId("roster-manual-shift-form")).toBeVisible();

    // Step 5: Create one small test shift
    const localDate = parseRosterCellDate(targetCellTestId);
    const notesField = drawer
      .getByTestId("roster-manual-shift-form")
      .locator('input[placeholder="Manual adjustment"]');
    const preferredHour = 14 + (Date.now() % 4);
    await notesField.fill(marker);

    for (let hour = preferredHour; hour <= preferredHour + 4; hour++) {
      await setDrawerShiftWindow(drawer, localDate, hour);
      await submitDrawerForm(page);
      if (await drawer.isHidden().catch(() => false)) break;
      const errorText = drawer.locator("p.text-rose-300, p.text-sm.text-rose-300");
      if ((await errorText.count()) === 0) break;
      const message = (await errorText.first().textContent()) ?? "";
      if (!/overlap/i.test(message)) {
        throw new Error(`Manual shift create failed: ${message}`);
      }
    }
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    // Step 6: Refresh and confirm shift remains
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });
    const refreshedCell = page.getByTestId(targetCellTestId);
    await expect
      .poll(async () => refreshedCell.locator('[data-testid^="roster-shift-"]').count())
      .toBeGreaterThan(0, { timeout: 60_000 });

    // Steps 7–8: Click shift → edit note/time → save
    await openShiftInCellByNotes(page, refreshedCell, marker);
    await drawer.getByTestId("roster-shift-edit-start").evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(drawer.getByTestId("roster-shift-edit-save")).toBeVisible();
    await notesField.fill(editedMarker);
    await setDrawerShiftWindow(drawer, localDate, preferredHour + 1);
    await drawer.getByTestId("roster-manual-shift-form").locator("select").nth(1).selectOption("training_day");
    await drawer.getByTestId("roster-shift-edit-reason").selectOption("role_change");
    await submitDrawerForm(page);
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    // Step 9: Refresh and confirm edit remains
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });
    const editedCell = page.getByTestId(targetCellTestId);
    await openShiftInCellByNotes(page, editedCell, editedMarker);
    await expect(notesField).toHaveValue(editedMarker);
    await closeDrawer(page);

    const editedShift = editedCell
      .locator('[data-testid^="roster-shift-"]')
      .filter({ hasText: /training day/i });
    await expect(editedShift.first()).toBeVisible({ timeout: 60_000 });

    // Steps 10–11: Cancel/remove test shift → refresh → confirm gone
    await editedShift.first().click();
    await expect(drawer.getByTestId("roster-shift-cancel-section")).toBeVisible();
    await drawer.getByTestId("roster-shift-cancellation-reason").selectOption({ index: 1 });
    await clickDrawerButton(page, /Confirm cancel shift/i);
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId(targetCellTestId).locator('[data-testid^="roster-shift-"]')).toHaveCount(
      0,
      { timeout: 60_000 },
    );
  });
});

const VIEW_ONLY_STAFF_ID =
  process.env.FI_E2E_ROSTER_VIEW_ONLY_STAFF_ID?.trim() ?? "6b7fcebb-557e-4236-b0a9-d37b21c87746";

viewOnlyTest.describe("Roster view-only permission validation @roster-view-only", () => {
  viewOnlyTest("view-only staff sees permission alert on empty cell click", async ({ page }) => {
    const tenantId = e2eTenantId();
    viewOnlyTest.setTimeout(120_000);

    // Steps 12–13: Log in (fixture) → roster → click empty cell
    await gotoTeamRoster(page, tenantId);
    await expect(page.getByTestId("roster-manage-denied-banner")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/View-only roster access/i)).toBeVisible();

    const grid = page.getByTestId("roster-week-grid");
    const emptyMarkers = grid.locator(
      `[data-testid^="generate-or-add-shift-${VIEW_ONLY_STAFF_ID}-"], [data-testid^="add-shift-${VIEW_ONLY_STAFF_ID}-"]`,
    );
    expect(
      await emptyMarkers.count(),
      "view-only staff should have generate/add-shift empty cells",
    ).toBeGreaterThan(0);

    const denyPattern =
      /permission|not yet activated|do not have permission|not roster-eligible/i;
    const alert = page.getByTestId("roster-action-error");
    let denyShown = false;

    for (let i = 0; i < (await emptyMarkers.count()); i++) {
      const marker = emptyMarkers.nth(i);
      const markerTestId = (await marker.getAttribute("data-testid")) ?? "";
      const localDate = parseRosterCellDate(
        markerTestId.replace(/^generate-or-add-shift-/, "roster-cell-").replace(/^add-shift-/, "roster-cell-"),
      );
      const cell = grid.getByTestId(`roster-cell-${VIEW_ONLY_STAFF_ID}-${localDate}`);
      await cell.click();

      try {
        await expect
          .poll(async () => ((await alert.textContent()) ?? "").trim())
          .toMatch(denyPattern, { timeout: 5_000 });
        denyShown = true;
        break;
      } catch {
        await page.keyboard.press("Escape").catch(() => undefined);
      }
    }

    expect(denyShown, "empty roster cell should surface a deny alert for view-only staff").toBe(
      true,
    );

    // Step 14: Clear deny alert — not a dead click, drawer must not open
    await expect(alert).toHaveAttribute("role", "alert");
    await expect(page.getByTestId("roster-shift-drawer")).toHaveCount(0);
  });
});