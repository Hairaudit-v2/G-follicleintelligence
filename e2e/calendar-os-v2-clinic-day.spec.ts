import { test, expect } from "@playwright/test";

import { authenticatedTest } from "./fixtures/auth";
import { requireE2eBaseUrl } from "./fixtures/baseUrl";
import { CalendarE2ePage } from "./pages/calendar.page";

/**
 * CalendarOS — click-to-create regression (browser tier).
 *
 * Covers z-index / pointer-events / overlay behaviour that unit tests cannot catch.
 *
 * @authenticated — requires FI_E2E_BASE_URL, demo admin credentials, FI_E2E_TENANT_ID
 *
 * Run:
 *   pnpm exec playwright test e2e/calendar-os-v2-clinic-day.spec.ts --project=chromium-authenticated
 */

test.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("CalendarOS V2 — shell @authenticated", () => {
  authenticatedTest("V2 shell loads with operational panel", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day" });
    await expect(page.getByLabel("Operational context")).toBeVisible({ timeout: 15_000 });
  });
});

authenticatedTest.describe("CalendarOS V2 — day click-to-create @authenticated", () => {
  authenticatedTest.beforeEach(async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day" });
    await calendar.closeQuickCreate();
    await calendar.closeBookingDrawer();
  });

  authenticatedTest("empty time slot opens Quick book with Consultation at ~9:00", async ({
    page,
  }) => {
    const calendar = new CalendarE2ePage(page);
    const grid = await calendar.readGridHours("v2-day");
    const targetHour = grid.start + 1 <= grid.end - 1 ? grid.start + 1 : grid.start;

    await calendar.clickEmptySlotAtHour(calendar.emptyDaySlotLayer(), targetHour, grid);
    await calendar.expectQuickCreateOpen();
    await calendar.expectConsultationSelected();

    const hm = `${String(targetHour).padStart(2, "0")}:00`;
    await calendar.expectStartTimeHm(hm);
    await expect(page.getByTestId("calendar-quick-create-time-summary")).toContainText(/\d/);
  });

  authenticatedTest("staff lane empty slot prefills provider when staff columns exist", async ({
    page,
  }) => {
    const calendar = new CalendarE2ePage(page);
    const staffLayer = calendar.emptyDaySlotLayer("s:");
    if ((await staffLayer.count()) === 0) {
      test.skip(true, "No staff resource columns in this tenant calendar");
      return;
    }

    const grid = await calendar.readGridHours("v2-day");
    await calendar.clickEmptySlotAtHour(staffLayer, grid.start + 1, grid);
    await calendar.expectQuickCreateOpen();

    const staffField = page.getByTestId("calendar-quick-create-staff-field");
    await expect(staffField).toBeVisible();
    const staffSelect = page.locator("#calendar-quick-create-staff-select");
    const value = await staffSelect.inputValue();
    expect(value.trim().length, "staff lane click should prefill assigned staff").toBeGreaterThan(0);
  });

  authenticatedTest("room lane empty slot opens quick-create when room columns exist", async ({
    page,
  }) => {
    const calendar = new CalendarE2ePage(page);
    const roomLayer = calendar.emptyDaySlotLayer("r:");
    if ((await roomLayer.count()) === 0) {
      test.skip(true, "No room resource columns in this tenant calendar");
      return;
    }

    const grid = await calendar.readGridHours("v2-day");
    await calendar.clickEmptySlotAtHour(roomLayer, grid.start + 2, grid);
    await calendar.expectQuickCreateOpen();
    await expect(page.getByTestId("calendar-quick-create-drawer")).toContainText(/room|Room/i);
  });

  authenticatedTest("booking card opens details only — not Quick book", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    const bookingCard = page.getByTestId("calendar-booking-card").first();
    if ((await bookingCard.count()) === 0) {
      test.skip(true, "No bookings on the visible day — seed data or pick another date");
      return;
    }

    await bookingCard.click();
    await calendar.expectBookingDrawerOpen();
    await calendar.expectQuickCreateClosed();
  });
});

authenticatedTest.describe("CalendarOS V2 — week click-to-create @authenticated", () => {
  authenticatedTest("empty week cell opens Quick book at clinic open hour", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "week" });
    await calendar.closeQuickCreate();

    const cell = calendar.emptyWeekCell();
    if ((await cell.count()) === 0) {
      test.skip(true, "No week resource cells rendered");
      return;
    }

    const dayKey = (await cell.getAttribute("data-calendar-day-key"))?.trim();
    expect(dayKey, "week cell should expose day key").toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await cell.click();
    await calendar.expectQuickCreateOpen();

    const grid = await calendar.readGridHours("v2-week");
    await calendar.expectStartTimeHm(calendar.formatOpenHourHm(grid));
    await expect(page.getByTestId("calendar-quick-create-start-time")).toBeVisible();
  });
});

authenticatedTest.describe("Calendar V1 — day click-to-create smoke @authenticated", () => {
  authenticatedTest("legacy grid empty slot opens Quick book", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: false, view: "day" });

    const layer = calendar.emptyDaySlotLayer();
    if ((await layer.count()) === 0) {
      test.skip(true, "Quick-create disabled (read-only calendar) or no empty-slot layer");
      return;
    }

    const grid = await calendar.readGridHours("v1");
    await calendar.clickEmptySlotAtHour(layer, grid.start + 1, grid);
    await calendar.expectQuickCreateOpen();
    await calendar.expectConsultationSelected();
  });
});
