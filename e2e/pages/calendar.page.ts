import { expect, type Locator, type Page } from "@playwright/test";

import { e2eTenantId } from "../fixtures/baseUrl";

export type CalendarGridKind = "v2-day" | "v2-week" | "v1";

export type GridHours = {
  start: number;
  end: number;
};

/** Authenticated calendar page helpers — stable test ids for click-to-create regressions. */
export class CalendarE2ePage {
  constructor(readonly page: Page) {}

  async gotoCalendar(opts: {
    v2: boolean;
    view: "day" | "week" | "3day";
    dateAnchor?: string;
    sample?: boolean;
  }): Promise<void> {
    const tid = e2eTenantId();
    const params = new URLSearchParams({ view: opts.view });
    if (opts.v2) params.set("calendarV2", "1");
    if (opts.dateAnchor?.trim()) params.set("date", opts.dateAnchor.trim());
    if (opts.sample) params.set("sample", "1");

    await this.page.goto(`/fi-admin/${tid}/calendar?${params.toString()}`);
    await expect(this.page.locator("body")).toBeVisible({ timeout: 20_000 });

    if (opts.v2) {
      await expect(this.page.getByTestId("calendar-os-v2-shell")).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(this.page.getByTestId("calendar-v1-grid")).toBeVisible({ timeout: 20_000 });
    }
  }

  gridLocator(kind: CalendarGridKind): Locator {
    switch (kind) {
      case "v2-day":
        return this.page.getByTestId("calendar-day-grid");
      case "v2-week":
        return this.page.getByTestId("calendar-week-grid");
      case "v1":
        return this.page.getByTestId("calendar-v1-grid");
    }
  }

  async readGridHours(kind: CalendarGridKind): Promise<GridHours> {
    const grid = this.gridLocator(kind);
    await expect(grid).toBeVisible();
    const start = Number(await grid.getAttribute("data-grid-start-hour"));
    const end = Number(await grid.getAttribute("data-grid-end-hour"));
    return {
      start: Number.isFinite(start) ? start : 8,
      end: Number.isFinite(end) ? end : 18,
    };
  }

  emptyDaySlotLayer(columnIdPrefix?: string): Locator {
    if (!columnIdPrefix) {
      return this.page
        .getByTestId("calendar-empty-slot")
        .or(this.page.getByTestId("calendar-empty-slot-layer"))
        .first();
    }
    return this.page
      .locator(
        `[data-testid="calendar-empty-slot"][data-calendar-column-id^="${columnIdPrefix}"], [data-testid="calendar-empty-slot-layer"][data-calendar-column-id^="${columnIdPrefix}"]`,
      )
      .first();
  }

  emptyWeekCell(columnIdPrefix?: string): Locator {
    const base = this.page.getByTestId("calendar-empty-week-cell");
    if (!columnIdPrefix) return base.first();
    return this.page
      .locator(
        `[data-testid="calendar-empty-week-cell"][data-calendar-column-id^="${columnIdPrefix}"]`,
      )
      .first();
  }

  /** Click the centre of an empty-slot capture layer at a wall-clock hour (clinic grid). */
  async clickEmptySlotAtHour(layer: Locator, hour: number, grid: GridHours): Promise<void> {
    await expect(layer).toBeVisible({ timeout: 15_000 });
    const box = await layer.boundingBox();
    expect(box, "empty-slot layer must have a visible bounding box").toBeTruthy();
    const span = Math.max(1, grid.end - grid.start);
    const fraction = (hour - grid.start) / span;
    const y = Math.max(8, Math.min(box!.height - 8, fraction * box!.height));
    await layer.click({ position: { x: box!.width / 2, y } });
  }

  async expectQuickCreateOpen(): Promise<void> {
    await expect(this.page.getByTestId("calendar-quick-create-drawer")).toBeVisible({
      timeout: 10_000,
    });
  }

  /** Quick create drawer must sit below FI OS top command bar (not clipped behind chrome). */
  async expectQuickCreateBelowTopChrome(): Promise<void> {
    const topChrome = this.page.getByTestId("fi-os-top-chrome");
    await expect(topChrome).toBeVisible({ timeout: 10_000 });
    const drawer = this.page.getByTestId("calendar-quick-create-drawer");
    await expect(drawer).toBeVisible({ timeout: 10_000 });

    const chromeBox = await topChrome.boundingBox();
    const drawerBox = await drawer.boundingBox();
    expect(chromeBox, "FI OS top chrome must be measurable").toBeTruthy();
    expect(drawerBox, "Quick create drawer must be measurable").toBeTruthy();

    const chromeBottom = chromeBox!.y + chromeBox!.height;
    expect(
      drawerBox!.y,
      "drawer top should start at or below the bottom of FI OS top chrome"
    ).toBeGreaterThanOrEqual(chromeBottom - 1);

    await expect(drawer.getByRole("heading", { name: /quick book/i })).toBeVisible();
    await expect(drawer.getByRole("button", { name: /close drawer/i })).toBeVisible();
  }

  /** Booking drawer uses the same viewport-safe shell as quick create. */
  async expectBookingDrawerBelowTopChrome(): Promise<void> {
    const topChrome = this.page.getByTestId("fi-os-top-chrome");
    await expect(topChrome).toBeVisible({ timeout: 10_000 });
    const drawer = this.bookingDrawer();
    await expect(drawer).toBeVisible({ timeout: 10_000 });

    const chromeBox = await topChrome.boundingBox();
    const drawerBox = await drawer.boundingBox();
    expect(chromeBox).toBeTruthy();
    expect(drawerBox).toBeTruthy();

    const chromeBottom = chromeBox!.y + chromeBox!.height;
    expect(drawerBox!.y).toBeGreaterThanOrEqual(chromeBottom - 1);
    await expect(drawer.getByRole("button", { name: /^close$/i })).toBeVisible();
  }

  async expectQuickCreateClosed(): Promise<void> {
    await expect(this.page.getByTestId("calendar-quick-create-drawer")).toHaveCount(0);
  }

  bookingDrawer(): Locator {
    return this.page
      .getByTestId("calendar-appointment-drawer")
      .or(this.page.getByTestId("calendar-booking-drawer"));
  }

  async expectBookingDrawerOpen(): Promise<void> {
    await expect(this.bookingDrawer()).toBeVisible({
      timeout: 10_000,
    });
  }

  async expectConsultationSelected(): Promise<void> {
    const tpl = this.page.getByTestId("calendar-quick-create-template-consultation");
    await expect(tpl).toBeVisible();
    await expect(tpl).toHaveClass(/sky-500|22C1FF/);
  }

  async expectStartTimeHm(hm: string): Promise<void> {
    await expect(this.page.getByTestId("calendar-quick-create-start-time")).toHaveValue(hm);
  }

  async closeQuickCreate(): Promise<void> {
    const drawer = this.page.getByTestId("calendar-quick-create-drawer");
    if (!(await drawer.isVisible().catch(() => false))) return;
    await drawer.getByRole("button", { name: /close drawer/i }).click();
    await this.expectQuickCreateClosed();
  }

  async closeBookingDrawer(): Promise<void> {
    const drawer = this.bookingDrawer();
    if (!(await drawer.isVisible().catch(() => false))) return;
    await drawer.getByRole("button", { name: /^close$/i }).click();
    await expect(drawer).toHaveCount(0);
  }

  formatOpenHourHm(grid: GridHours): string {
    const hour = Number.isFinite(grid.start) && grid.start >= 0 && grid.start <= 23 ? grid.start : 9;
    return `${String(hour).padStart(2, "0")}:00`;
  }
}
