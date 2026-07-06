import { expect, type Locator, type Page } from "@playwright/test";

export async function clickDrawerButton(page: Page, name: RegExp | string): Promise<void> {
  const drawer = page.getByTestId("roster-shift-drawer");
  const button = drawer.getByRole("button", { name });
  await button.evaluate((el) => (el as HTMLButtonElement).click());
}

export async function submitDrawerForm(page: Page): Promise<void> {
  const form = page.getByTestId("roster-shift-drawer").getByTestId("roster-manual-shift-form");
  await form.evaluate((el) => (el as HTMLFormElement).requestSubmit());
}

export function parseRosterCellDate(cellTestId: string): string {
  const match = cellTestId.match(/(\d{4}-\d{2}-\d{2})$/);
  if (!match) throw new Error(`Could not parse roster cell date from ${cellTestId}`);
  return match[1]!;
}

export async function setDrawerShiftWindow(
  drawer: Locator,
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

export async function closeDrawer(page: Page): Promise<void> {
  const drawer = page.getByTestId("roster-shift-drawer");
  if (!(await drawer.isVisible().catch(() => false))) return;
  await drawer.getByRole("button", { name: /^Close$/i }).evaluate((el) => {
    (el as HTMLButtonElement).click();
  });
  await expect(drawer).toBeHidden({ timeout: 30_000 });
}

export async function openShiftInCellByNotes(
  page: Page,
  cell: Locator,
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

export async function findEmptyRosterCell(
  page: Page,
  options?: { requireDrawer?: boolean },
): Promise<{
  cell: Locator;
  cellTestId: string;
}> {
  const grid = page.getByTestId("roster-week-grid");
  await expect(grid).toBeVisible({ timeout: 60_000 });
  const cells = grid.locator('[data-testid^="roster-cell-"]');
  const cellCount = await cells.count();
  expect(cellCount, "roster grid should expose clickable cells").toBeGreaterThan(0);

  const requireDrawer = options?.requireDrawer ?? false;

  for (let i = 0; i < cellCount; i++) {
    const cell = cells.nth(i);
    const shiftCount = await cell.locator('[data-testid^="roster-shift-"]').count();
    if (shiftCount > 0) continue;
    const cellTestId = await cell.getAttribute("data-testid");
    if (!cellTestId) continue;

    if (!requireDrawer) {
      return { cell, cellTestId };
    }

    await cell.click();
    const drawer = page.getByTestId("roster-shift-drawer");
    if (await drawer.isVisible().catch(() => false)) {
      return { cell, cellTestId };
    }
    const denied = page.getByTestId("roster-action-error");
    if (await denied.isVisible().catch(() => false)) {
      await page.keyboard.press("Escape").catch(() => undefined);
      continue;
    }
    await page.keyboard.press("Escape").catch(() => undefined);
  }

  throw new Error(
    requireDrawer
      ? "No empty roster cell opened the shift drawer in the current week grid."
      : "No empty roster cell found in current week grid.",
  );
}

export async function gotoTeamRoster(page: Page, tenantId: string): Promise<void> {
  await page.goto(`/fi-admin/${tenantId}/team/roster`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("roster-command-centre")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("roster-week-grid")).toBeVisible({ timeout: 60_000 });
}