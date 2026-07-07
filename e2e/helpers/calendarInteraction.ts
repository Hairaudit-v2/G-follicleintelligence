import { expect, type Locator, type Page } from "@playwright/test";

/** Monday UTC of the week containing `dateAnchor` (YYYY-MM-DD). */
export function weekMondayYmd(dateAnchor: string): string {
  const y = Number(dateAnchor.slice(0, 4));
  const mo = Number(dateAnchor.slice(5, 7)) - 1;
  const d = Number(dateAnchor.slice(8, 10));
  const ms = Date.UTC(y, mo, d, 0, 0, 0, 0);
  const dow = new Date(ms).getUTCDay();
  const offset = (dow + 6) % 7;
  return new Date(ms - offset * 86_400_000).toISOString().slice(0, 10);
}

/** Default sample anchor — current week Monday (UTC). */
export function defaultInteractionDateAnchor(): string {
  return weekMondayYmd(new Date().toISOString().slice(0, 10));
}

export function interactionDateAnchor(): string {
  return process.env.FI_E2E_CALENDAR_INTERACTION_DATE?.trim() || defaultInteractionDateAnchor();
}

export function bookingCard(page: Page, bookingId: string): Locator {
  return page.locator(`[data-booking-id="${bookingId}"]`).first();
}

export async function expectBookingDraggable(page: Page, bookingId: string, draggable: boolean) {
  const card = bookingCard(page, bookingId);
  await expect(card).toBeVisible({ timeout: 15_000 });
  await expect(card).toHaveAttribute("data-calendar-draggable", draggable ? "true" : "false");
}

/** Pointer drag for @dnd-kit (activation distance ~6px). */
export async function dragBookingCard(
  page: Page,
  bookingId: string,
  target: Locator,
  targetPosition?: { x: number; y: number }
): Promise<void> {
  const card = bookingCard(page, bookingId);
  const dragHandle = card.locator('[data-testid="calendar-booking-drag-handle"]');
  const dragEl = (await dragHandle.count()) > 0 ? dragHandle.first() : card;
  const from = await dragEl.boundingBox();
  expect(from, "drag source must be visible").toBeTruthy();

  const toBox = await target.boundingBox();
  expect(toBox, "drop target must be visible").toBeTruthy();

  const toX = toBox!.x + (targetPosition?.x ?? toBox!.width / 2);
  const toY = toBox!.y + (targetPosition?.y ?? toBox!.height / 2);

  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width / 2 + 8, from!.y + from!.height / 2, { steps: 2 });
  await page.mouse.move(toX, toY, { steps: 12 });
  await page.mouse.up();
}

export async function expectSuccessToast(page: Page, message?: RegExp | string) {
  const toast = page.getByTestId("calendar-toast-success").last();
  await expect(toast).toBeVisible({ timeout: 10_000 });
  if (message) {
    await expect(toast).toContainText(message);
  }
}

export async function expectErrorToast(page: Page, message?: RegExp | string) {
  const toast = page.getByTestId("calendar-toast-error").last();
  await expect(toast).toBeVisible({ timeout: 10_000 });
  if (message) {
    await expect(toast).toContainText(message);
  }
}

export async function expectSingleBookingCard(page: Page, bookingId: string) {
  await expect(page.locator(`[data-booking-id="${bookingId}"]`)).toHaveCount(1);
}

export function acceptNextDialog(page: Page): void {
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
}

export function dismissNextDialog(page: Page): void {
  page.once("dialog", async (dialog) => {
    await dialog.dismiss();
  });
}
