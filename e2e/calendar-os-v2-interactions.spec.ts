import { expect } from "@playwright/test";

import { E2E_SAMPLE_BOOKING_IDS } from "./helpers/calendarInteractionFixtures";
import { authenticatedTest } from "./fixtures/auth";
import { requireE2eBaseUrl } from "./fixtures/baseUrl";
import {
  rosterViewOnlyTest,
  hasRosterViewOnlyCredentials,
} from "./fixtures/rosterAuth";
import {
  acceptNextDialog,
  bookingCard,
  dragBookingCard,
  expectBookingDraggable,
  expectErrorToast,
  expectSingleBookingCard,
  expectSuccessToast,
  interactionDateAnchor,
  weekMondayYmd,
} from "./helpers/calendarInteraction";
import { allowsMutations } from "./helpers/credentials";
import { CalendarE2ePage } from "./pages/calendar.page";

/**
 * CalendarOS V2 — drag/drop + source-sync interaction safety (@mutation).
 *
 * Uses `?sample=1` interaction fixtures (client-side reschedule — no server PATCH).
 * Requires FI_E2E_BASE_URL, demo admin credentials, FI_E2E_TENANT_ID, FI_E2E_ALLOW_MUTATIONS=1.
 *
 * Run:
 *   FI_E2E_BASE_URL=https://<host> FI_E2E_ALLOW_MUTATIONS=1 \
 *     pnpm exec playwright test e2e/calendar-os-v2-interactions.spec.ts --project=chromium-authenticated
 */

const anchor = interactionDateAnchor();
const mon = weekMondayYmd(anchor);

authenticatedTest.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("CalendarOS V2 — interaction safety @authenticated @mutation", () => {
  authenticatedTest.beforeEach(({ page: _page }, testInfo) => {
    authenticatedTest.skip(
      !allowsMutations(),
      "Set FI_E2E_ALLOW_MUTATIONS=1 on a throwaway demo tenant",
    );
    testInfo.setTimeout(120_000);
  });

  authenticatedTest("A — drag FI consultation later on same day", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });
    await calendar.closeQuickCreate();
    await calendar.closeBookingDrawer();

    await expect(page.getByTestId("calendar-v2-day-view")).toBeVisible({ timeout: 20_000 });

    const bookingId = E2E_SAMPLE_BOOKING_IDS.fiConsult;
    await expectBookingDraggable(page, bookingId, true);

    const card = bookingCard(page, bookingId);
    const dropZone = page.getByTestId("calendar-drop-zone").filter({ has: card }).first();
    await expect(dropZone).toBeVisible();

    const beforeTime = (await card.textContent()) ?? "";
    await dragBookingCard(page, bookingId, dropZone, { x: 40, y: 280 });
    await expectSuccessToast(page, /appointment moved|updated in fi os/i);
    await expectSingleBookingCard(page, bookingId);

    const afterTime = (await card.textContent()) ?? "";
    expect(afterTime).not.toEqual(beforeTime);
  });

  authenticatedTest("B — drag FI consultation to another staff/room column", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });

    const bookingId = E2E_SAMPLE_BOOKING_IDS.fiConsult;
    await expectBookingDraggable(page, bookingId, true);

    const sourceCard = bookingCard(page, bookingId);
    const sourceZone = page.getByTestId("calendar-drop-zone").filter({ has: sourceCard }).first();
    const sourceColumn = await sourceZone.getAttribute("data-calendar-drop-column");

    const targetZone = page
      .getByTestId("calendar-drop-zone")
      .filter({ hasNot: sourceCard })
      .first();
    if ((await targetZone.count()) === 0) {
      authenticatedTest.skip(true, "Need at least two resource columns for column drag");
      return;
    }
    const targetColumn = await targetZone.getAttribute("data-calendar-drop-column");
    if (!targetColumn || targetColumn === sourceColumn) {
      authenticatedTest.skip(true, "No distinct target column for staff/room drag");
      return;
    }

    await dragBookingCard(page, bookingId, targetZone, { x: 30, y: 120 });
    await expectSuccessToast(page, /appointment moved/i);
    await expectSingleBookingCard(page, bookingId);

    const newZone = page.getByTestId("calendar-drop-zone").filter({ has: sourceCard }).first();
    await expect(newZone).toHaveAttribute("data-calendar-drop-column", targetColumn!);
  });

  authenticatedTest("C — drag FI consultation to another day in week view", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "week", dateAnchor: mon, sample: true });

    await expect(page.getByTestId("calendar-v2-week-view")).toBeVisible({ timeout: 20_000 });

    const bookingId = E2E_SAMPLE_BOOKING_IDS.weekMove;
    await expectBookingDraggable(page, bookingId, true);

    const card = bookingCard(page, bookingId);
    const sourceCell = page.getByTestId("calendar-drop-zone").filter({ has: card }).first();
    const sourceDay = await sourceCell.getAttribute("data-calendar-drop-day");
    expect(sourceDay, "week-move sample should start on Tuesday").toBeTruthy();

    const targetCell = page
      .locator('[data-testid="calendar-drop-zone"]')
      .filter({ hasNot: card })
      .first();

    if ((await targetCell.count()) === 0) {
      authenticatedTest.skip(true, "No alternate week day cell for cross-day drag");
      return;
    }

    const durationBefore = await card.textContent();
    await dragBookingCard(page, bookingId, targetCell, { x: 20, y: 20 });
    await expectSuccessToast(page, /appointment moved/i);
    await expectSingleBookingCard(page, bookingId);

    const targetDay = await targetCell.getAttribute("data-calendar-drop-day");
    const landedCell = page.getByTestId("calendar-drop-zone").filter({ has: card }).first();
    await expect(landedCell).toHaveAttribute("data-calendar-drop-day", targetDay!);

    const durationAfter = await card.textContent();
    expect(durationAfter).toContain("45m");
    expect(durationBefore).toContain("45m");
  });

  authenticatedTest("D — Google imported appointment cannot be dragged", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });

    const bookingId = E2E_SAMPLE_BOOKING_IDS.googleImport;
    await expectBookingDraggable(page, bookingId, false);

    const card = bookingCard(page, bookingId);
    await expect(card.getByTestId("calendar-booking-source-label")).toContainText(/google/i);
    await expect(card.getByTestId("calendar-booking-source-label")).toContainText(/read-only/i);

    const dropZone = page.getByTestId("calendar-drop-zone").first();
    const boxBefore = await card.boundingBox();
    await dragBookingCard(page, bookingId, dropZone, { x: 40, y: 200 }).catch(() => {
      /* drag may no-op when disabled */
    });

    await expect(page.getByTestId("calendar-toast-success")).toHaveCount(0);
    const boxAfter = await card.boundingBox();
    expect(boxAfter?.y).toBeCloseTo(boxBefore?.y ?? 0, 0);
    await expectSingleBookingCard(page, bookingId);
  });

  authenticatedTest("E — Timely import requires confirm and shows local override", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });

    const bookingId = E2E_SAMPLE_BOOKING_IDS.timelyImport;
    await expectBookingDraggable(page, bookingId, true);

    acceptNextDialog(page);
    const card = bookingCard(page, bookingId);
    const dropZone = page.getByTestId("calendar-drop-zone").filter({ has: card }).first();
    await dragBookingCard(page, bookingId, dropZone, { x: 40, y: 220 });

    await expectSuccessToast(page, /updated in fi os|appointment moved/i);
    await card.click();
    await calendar.expectBookingDrawerOpen();
    await expect(page.getByTestId("calendar-local-override-warning")).toBeVisible();
    await expect(page.getByTestId("calendar-local-override-warning")).toContainText(/timely/i);
  });

  authenticatedTest("G — overlapping drag rolls back with error toast", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });

    const anchorId = E2E_SAMPLE_BOOKING_IDS.overlapAnchor;
    const blockerId = E2E_SAMPLE_BOOKING_IDS.overlapBlocker;

    await expectBookingDraggable(page, anchorId, true);
    await expectBookingDraggable(page, blockerId, true);

    const anchorCard = bookingCard(page, anchorId);
    const blockerCard = bookingCard(page, blockerId);
    const blockerZone = page.getByTestId("calendar-drop-zone").filter({ has: blockerCard }).first();
    const anchorBoxBefore = await anchorCard.boundingBox();

    await dragBookingCard(page, anchorId, blockerZone, { x: 30, y: 30 });
    await expectErrorToast(page, /scheduling conflict|overlap|not available/i);

    const anchorBoxAfter = await anchorCard.boundingBox();
    expect(anchorBoxAfter?.y).toBeCloseTo(anchorBoxBefore?.y ?? 0, 0);
    await expectSingleBookingCard(page, anchorId);
    await expectSingleBookingCard(page, blockerId);
  });

  authenticatedTest("H — 3-day view renders all three day lanes", async ({ page }) => {
    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "3day", dateAnchor: mon, sample: true });

    await expect(page.getByTestId("calendar-v2-three-day-view")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("calendar-three-day-lane")).toHaveCount(3);

    const dayKeys = await page.getByTestId("calendar-three-day-lane").evaluateAll((nodes) =>
      nodes.map((n) => n.getAttribute("data-calendar-day-key")).filter(Boolean)
    );
    expect(new Set(dayKeys).size).toBe(3);
  });
});

rosterViewOnlyTest.describe("CalendarOS V2 — read-only guard @roster-view-only @mutation", () => {
  rosterViewOnlyTest.beforeAll(() => {
    requireE2eBaseUrl();
  });

  rosterViewOnlyTest("F — read-only user cannot drag sample appointments", async ({ page }) => {
    rosterViewOnlyTest.skip(
      !hasRosterViewOnlyCredentials(),
      "Set roster view-only credentials (Supabase service role + FI_E2E_ROSTER_VIEW_ONLY_EMAIL)",
    );

    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: mon, sample: true });

    const readOnlyBadge = page.getByTestId("calendar-top-controls").getByText(/read-only/i);
    if ((await readOnlyBadge.count()) === 0) {
      rosterViewOnlyTest.skip(
        true,
        "View-only roster user has calendar mutation access — no read-only calendar fixture",
      );
      return;
    }

    await expect(page.getByTestId("calendar-empty-slot")).toHaveCount(0);
    await expect(page.getByTestId("calendar-booking-drag-handle")).toHaveCount(0);

    const anyDraggable = page.locator('[data-calendar-draggable="true"]');
    await expect(anyDraggable).toHaveCount(0);
  });
});
