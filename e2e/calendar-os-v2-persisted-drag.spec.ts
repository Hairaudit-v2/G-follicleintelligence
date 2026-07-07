import { expect } from "@playwright/test";

import { authenticatedTest } from "./fixtures/auth";
import { e2eTenantId, requireE2eBaseUrl } from "./fixtures/baseUrl";
import {
  bookingCard,
  dragBookingCard,
  expectBookingDraggable,
  expectErrorToast,
  expectSingleBookingCard,
  expectSuccessToast,
} from "./helpers/calendarInteraction";
import {
  cancelPersistedCalendarBookings,
  fetchAppointmentStartAt,
  hasPersistedCalendarSeedEnv,
  seedPersistedCalendarBlocker,
  seedPersistedCalendarConsultation,
} from "./helpers/calendarPersistedBookingSeed";
import { allowsMutations } from "./helpers/credentials";
import { CalendarE2ePage } from "./pages/calendar.page";

/**
 * CalendarOS V2 — server-persisted drag reschedule (@mutation).
 *
 * Creates a real fi_bookings row (no ?sample=1), drags in V2 day view, asserts PATCH +
 * reload persistence. SMOKETEST-* titles only — throwaway demo tenant required.
 *
 * Requires:
 *   FI_E2E_BASE_URL, FI_E2E_TENANT_ID, FI_E2E_DEMO_ADMIN_* , FI_E2E_ALLOW_MUTATIONS=1
 *   NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or FI_E2E_CALENDAR_LEAD_ID)
 *
 * Run:
 *   FI_E2E_BASE_URL=https://<host> FI_E2E_ALLOW_MUTATIONS=1 \
 *     pnpm exec playwright test e2e/calendar-os-v2-persisted-drag.spec.ts --project=chromium-authenticated
 */

authenticatedTest.beforeAll(() => {
  requireE2eBaseUrl();
});

authenticatedTest.describe("CalendarOS V2 — persisted drag @authenticated @mutation", () => {
  const tenantId = e2eTenantId();
  const cleanupIds: string[] = [];

  authenticatedTest.beforeEach((_fixtures, testInfo) => {
    authenticatedTest.skip(
      !allowsMutations(),
      "Set FI_E2E_ALLOW_MUTATIONS=1 on a throwaway demo tenant",
    );
    authenticatedTest.skip(
      !hasPersistedCalendarSeedEnv(),
      "Set Supabase admin env or FI_E2E_CALENDAR_LEAD_ID for persisted calendar seed",
    );
    testInfo.setTimeout(180_000);
  });

  authenticatedTest.afterEach(async ({ request }) => {
    await cancelPersistedCalendarBookings({ tenantId, request, bookingIds: [...cleanupIds] });
    cleanupIds.length = 0;
  });

  authenticatedTest("I — real FI booking drag persists after reload", async ({ page, request }) => {
    const seed = await seedPersistedCalendarConsultation({ tenantId, request });
    cleanupIds.push(seed.bookingId);

    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: seed.dayKey, sample: false });
    await expect(page.getByTestId("calendar-v2-day-view")).toBeVisible({ timeout: 25_000 });

    await expectBookingDraggable(page, seed.bookingId, true);
    const startBefore = await fetchAppointmentStartAt(request, tenantId, seed.bookingId, seed.dayKey);
    expect(startBefore, "seeded booking should be visible to appointments API").toBeTruthy();

    const card = bookingCard(page, seed.bookingId);
    await expect(card).toBeVisible({ timeout: 20_000 });
    const cardTextBefore = (await card.textContent()) ?? "";

    const dropZone = page.getByTestId("calendar-drop-zone").filter({ has: card }).first();
    await dragBookingCard(page, seed.bookingId, dropZone, { x: 40, y: 280 });
    await expectSuccessToast(page, /appointment moved/i);
    await expectSingleBookingCard(page, seed.bookingId);

    const startAfterDrag = await fetchAppointmentStartAt(request, tenantId, seed.bookingId, seed.dayKey);
    expect(startAfterDrag).toBeTruthy();
    expect(startAfterDrag).not.toEqual(startBefore);

    const cardTextAfterDrag = (await card.textContent()) ?? "";
    expect(cardTextAfterDrag).not.toEqual(cardTextBefore);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("calendar-v2-day-view")).toBeVisible({ timeout: 25_000 });
    await expect(bookingCard(page, seed.bookingId)).toBeVisible({ timeout: 20_000 });
    await expectSingleBookingCard(page, seed.bookingId);

    const startAfterReload = await fetchAppointmentStartAt(request, tenantId, seed.bookingId, seed.dayKey);
    expect(startAfterReload).toEqual(startAfterDrag);
  });

  authenticatedTest("I-b — overlap drag on real booking rolls back", async ({ page, request }) => {
    const consult = await seedPersistedCalendarConsultation({ tenantId, request, slotHourUtc: 8 });
    cleanupIds.push(consult.bookingId);

    const blockerStart = new Date(Date.parse(consult.startAt) + 2 * 60 * 60_000).toISOString();
    const blockerEnd = new Date(Date.parse(blockerStart) + 45 * 60_000).toISOString();
    const blocker = await seedPersistedCalendarBlocker({
      tenantId,
      request,
      dayKey: consult.dayKey,
      startAt: blockerStart,
      endAt: blockerEnd,
      staffId: consult.staffId,
    });
    cleanupIds.push(blocker.bookingId);

    const calendar = new CalendarE2ePage(page);
    await calendar.gotoCalendar({ v2: true, view: "day", dateAnchor: consult.dayKey, sample: false });
    await expect(page.getByTestId("calendar-v2-day-view")).toBeVisible({ timeout: 25_000 });

    const startBefore = await fetchAppointmentStartAt(request, tenantId, consult.bookingId, consult.dayKey);
    expect(startBefore).toBeTruthy();

    const consultCard = bookingCard(page, consult.bookingId);
    const blockerCard = bookingCard(page, blocker.bookingId);
    await expect(consultCard).toBeVisible({ timeout: 20_000 });
    await expect(blockerCard).toBeVisible({ timeout: 20_000 });

    const blockerZone = page.getByTestId("calendar-drop-zone").filter({ has: blockerCard }).first();
    const boxBefore = await consultCard.boundingBox();

    await dragBookingCard(page, consult.bookingId, blockerZone, { x: 30, y: 30 });
    await expectErrorToast(page, /scheduling conflict|overlap|not available/i);

    const startAfter = await fetchAppointmentStartAt(request, tenantId, consult.bookingId, consult.dayKey);
    expect(startAfter).toEqual(startBefore);

    const boxAfter = await consultCard.boundingBox();
    expect(boxAfter?.y).toBeCloseTo(boxBefore?.y ?? 0, 0);
    await expectSingleBookingCard(page, consult.bookingId);
    await expectSingleBookingCard(page, blocker.bookingId);
  });
});
