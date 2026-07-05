import { authenticatedTest as test, expect } from "../fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "../fixtures/baseUrl";
import { allowsMutations } from "../helpers/credentials";

/**
 * Production workforce validation — roster drawer CRUD + Anita maternity leave.
 *
 * Requires FI_E2E_BASE_URL (production), demo admin credentials, FI_E2E_TENANT_ID,
 * and FI_E2E_ALLOW_MUTATIONS=1 for roster shift mutations.
 *
 * Run:
 *   FI_E2E_BASE_URL=https://follicleintelligence.ai FI_E2E_ALLOW_MUTATIONS=1 \
 *     npx playwright test e2e/journeys/workforce-production-validation.spec.ts \
 *     --project=edge-authenticated
 */

const ANITA_STAFF_ID =
  process.env.FI_E2E_ANITA_STAFF_ID?.trim() ?? "8c604502-ea8a-411d-8c9e-7c19755b5ae1";

async function clickDrawerButton(
  page: import("@playwright/test").Page,
  name: RegExp | string,
): Promise<void> {
  const drawer = page.getByTestId("roster-shift-drawer");
  const button = drawer.getByRole("button", { name });
  await button.evaluate((el) => (el as HTMLButtonElement).click());
}

async function submitDrawerForm(page: import("@playwright/test").Page): Promise<void> {
  const form = page.getByTestId("roster-shift-drawer").getByTestId("roster-manual-shift-form");
  await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
}

function parseRosterCellDate(cellTestId: string): string {
  const match = cellTestId.match(/(\d{4}-\d{2}-\d{2})$/);
  if (!match) throw new Error(`Could not parse roster cell date from ${cellTestId}`);
  return match[1]!;
}

async function setDrawerShiftWindow(
  drawer: import("@playwright/test").Locator,
  localDate: string,
  startHour: number,
): Promise<void> {
  const pad = (value: number) => String(value).padStart(2, "0");
  const starts = `${localDate}T${pad(startHour)}:30`;
  const ends = `${localDate}T${pad(startHour + 1)}:30`;
  const dateInputs = drawer.locator('input[type="datetime-local"]');
  await dateInputs.nth(0).fill(starts);
  await dateInputs.nth(1).fill(ends);
}

async function closeDrawer(page: import("@playwright/test").Page): Promise<void> {
  const drawer = page.getByTestId("roster-shift-drawer");
  if (!(await drawer.isVisible().catch(() => false))) return;
  await drawer.getByRole("button", { name: /^Close$/i }).evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

async function openShiftInCellByNotes(
  page: import("@playwright/test").Page,
  cell: import("@playwright/test").Locator,
  notes: string,
): Promise<void> {
  const shifts = cell.locator('[data-testid^="roster-shift-"]');
  const count = await shifts.count();
  for (let i = 0; i < count; i++) {
    await shifts.nth(i).click();
    const drawer = page.getByTestId("roster-shift-drawer");
    await expect(drawer).toBeVisible();
    const notesField = drawer
      .getByTestId("roster-manual-shift-form")
      .locator('input[placeholder="Manual adjustment"]');
    if ((await notesField.inputValue()) === notes) return;
    await closeDrawer(page);
  }
  throw new Error(`Could not find roster shift with notes: ${notes}`);
}

test.beforeAll(() => {
  requireE2eBaseUrl();
});

test.describe("Workforce production validation @authenticated @mutation", () => {
  test("roster empty-cell drawer CRUD and Anita maternity leave", async ({ page }) => {
    test.skip(!allowsMutations(), "Set FI_E2E_ALLOW_MUTATIONS=1 on demo tenant");

    const tenantId = e2eTenantId();
    const marker = `e2e-prod-roster-${Date.now()}`;
    const editedMarker = `${marker}-edited`;

    test.setTimeout(300_000);

    // --- Roster: empty-cell drawer + shift CRUD ---
    await page.goto(`/fi-admin/${tenantId}/team/roster`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("roster-command-centre")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });

    const grid = page.getByTestId("roster-week-grid");
    const cells = grid.locator('[data-testid^="roster-cell-"]');
    const cellCount = await cells.count();
    expect(cellCount, "roster grid should expose clickable cells").toBeGreaterThan(0);

    let targetCellTestId: string | null = null;
    let openedDrawer = false;
    for (let i = 0; i < cellCount; i++) {
      const cell = cells.nth(i);
      const shiftCount = await cell.locator('[data-testid^="roster-shift-"]').count();
      if (shiftCount > 0) continue;

      const cellTestId = await cell.getAttribute("data-testid");
      await cell.click();
      const drawer = page.getByTestId("roster-shift-drawer");
      if (await drawer.isVisible().catch(() => false)) {
        openedDrawer = true;
        targetCellTestId = cellTestId;
        break;
      }
      await page.keyboard.press("Escape").catch(() => undefined);
    }

    expect(openedDrawer, "empty roster cell should open shift drawer").toBe(true);
    expect(targetCellTestId, "target roster cell test id").toBeTruthy();

    const drawer = page.getByTestId("roster-shift-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByTestId("roster-manual-shift-form")).toBeVisible();

    const localDate = parseRosterCellDate(targetCellTestId!);
    const notesField = drawer
      .getByTestId("roster-manual-shift-form")
      .locator('input[placeholder="Manual adjustment"]');
    const preferredHour = 12 + (Date.now() % 6);
    await setDrawerShiftWindow(drawer, localDate, preferredHour);
    await notesField.fill(marker);

    for (let hour = preferredHour; hour <= preferredHour + 4; hour++) {
      await setDrawerShiftWindow(drawer, localDate, hour);
      await submitDrawerForm(page);
      const errorText = drawer.locator("p.text-rose-300, p.text-sm.text-rose-300");
      if (await drawer.isHidden().catch(() => false)) break;
      if ((await errorText.count()) === 0) break;
      const message = (await errorText.first().textContent()) ?? "";
      if (!/overlap/i.test(message)) {
        throw new Error(`Manual shift create failed: ${message}`);
      }
    }
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    const targetCell = page.getByTestId(targetCellTestId!);
    await expect
      .poll(async () => targetCell.locator('[data-testid^="roster-shift-"]').count())
      .toBeGreaterThan(0, { timeout: 60_000 });

    await openShiftInCellByNotes(page, targetCell, marker);
    await drawer.getByTestId("roster-shift-edit-start").evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(drawer.getByTestId("roster-shift-edit-save")).toBeVisible();
    await expect(notesField).toBeEnabled();
    await notesField.fill(editedMarker);
    await drawer.getByTestId("roster-manual-shift-form").locator("select").nth(1).selectOption("training_day");
    await drawer.getByTestId("roster-shift-edit-reason").selectOption("role_change");
    await submitDrawerForm(page);
    await expect(drawer).toBeHidden({ timeout: 60_000 });

    const editedShift = targetCell
      .locator('[data-testid^="roster-shift-"]')
      .filter({ hasText: /training day/i });
    await expect(editedShift.first()).toBeVisible({ timeout: 60_000 });

    await editedShift.first().click();
    await expect(drawer.getByTestId("roster-shift-cancel-section")).toBeVisible();
    await drawer.getByTestId("roster-shift-cancellation-reason").selectOption({ index: 1 });
    await clickDrawerButton(page, /Confirm cancel shift/i);
    await expect(drawer).toBeHidden({ timeout: 60_000 });
    await expect(editedShift).toHaveCount(0, { timeout: 60_000 });

    // --- Anita: maternity leave surfaced on profile + roster ---
    await page.goto(`/fi-admin/${tenantId}/workforce-os/staff/${ANITA_STAFF_ID}`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("h1", { hasText: /Anita Katherine Cottee/i })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(/On maternity leave|maternity leave/i).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto(`/fi-admin/${tenantId}/team/roster`, { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("roster-ineligible-staff-section")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("roster-ineligible-staff-toggle").click();
    const anitaRow = page.getByTestId(`roster-ineligible-staff-${ANITA_STAFF_ID}`);
    await expect(anitaRow).toBeVisible({ timeout: 30_000 });
    await expect(anitaRow).toContainText(/maternity leave/i);
  });
});