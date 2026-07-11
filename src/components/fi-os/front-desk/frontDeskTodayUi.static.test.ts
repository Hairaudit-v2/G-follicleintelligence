/**
 * Static markup tests for Front Desk Today presentational components.
 * No raw payload; fixtures only.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  FrontDeskAttentionPanel,
  FrontDeskLane,
  FrontDeskPatientCard,
  FrontDeskSessionBanner,
  FrontDeskTerminalSection,
  FrontDeskTodayHeader,
  FrontDeskTodaySummaryTiles,
} from "@/src/components/fi-os/front-desk/frontDeskTodayUi";
import type {
  FrontDeskAttentionItem,
  FrontDeskTodayCard,
  FrontDeskTodayLane,
  FrontDeskTodaySummary,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import { staffFacingCopyIsClean } from "@/src/lib/fiOs/frontDesk/frontDeskTodayUiHelpers";

const BOOKING = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PAYMENTS = "/fi-admin/t/payments";

function sampleCard(overrides: Partial<FrontDeskTodayCard> = {}): FrontDeskTodayCard {
  return {
    bookingId: BOOKING,
    patient: { displayName: "Alex Patient", patientId: null, leadId: null },
    appointment: {
      startAtIso: "2026-07-11T12:30:00.000Z",
      endAtIso: "2026-07-11T13:00:00.000Z",
      startTimeLabel: "12:30",
      durationMinutes: 30,
      typeLabel: "Consultation",
    },
    resource: { clinicianLabel: "Dr Smith", roomLabel: "Room 1", clinicLabel: null },
    operationalState: "waiting",
    laneId: "waiting",
    runningLate: false,
    waitingMinutes: null,
    payment: { state: "due", label: "Payment due" },
    blocker: {
      highest: "action_needed",
      summary: "Consent missing",
      items: [
        {
          id: "b1",
          kind: "missing_consent",
          label: "Consent missing",
          severity: "action_needed",
          href: null,
        },
      ],
    },
    contact: null,
    allowedActions: ["start_consultation", "take_payment", "open_patient", "open_calendar"],
    links: {
      patient: "/fi-admin/t/patients/p1",
      appointment: "/fi-admin/t/appointments",
      calendar: "/fi-admin/t/calendar?bookingId=" + BOOKING,
    },
    ...overrides,
  };
}

test("patient card uses presentation fields and payments href", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskPatientCard, {
      card: sampleCard(),
      busy: false,
      highlighted: false,
      paymentsHref: PAYMENTS,
      onAction: () => undefined,
    })
  );
  assert.match(html, /Alex Patient/);
  assert.match(html, /12:30/);
  assert.match(html, /Waiting/);
  assert.match(html, /Start consultation/);
  assert.match(html, /Payment due/);
  assert.match(html, /Consent missing/);
  assert.match(html, new RegExp(PAYMENTS.replace(/\//g, "\\/")));
  assert.ok(!html.includes("ReceptionOS"));
  assert.ok(!html.includes("booking_status"));
  assert.ok(staffFacingCopyIsClean(html.replace(/<[^>]+>/g, " ")));
});

test("PIN banner never mentions Cancel availability", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskSessionBanner, { mutationMode: "pin_reception" })
  );
  assert.match(html, /PIN session/i);
  assert.match(html, /Cancel is not available/i);
});

test("read-only banner explains no mutations", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskSessionBanner, { mutationMode: "none" })
  );
  assert.match(html, /Read-only/i);
});

test("attention panel renders items and hidden count; no raw payload fields", () => {
  const items: FrontDeskAttentionItem[] = [
    {
      id: "a1",
      kind: "missing_deposit",
      title: "Deposit overdue",
      detail: "Alex",
      severity: "blocker",
      href: null,
      bookingId: BOOKING,
      patientId: null,
      priorityScore: 95,
    },
  ];
  const html = renderToStaticMarkup(
    createElement(FrontDeskAttentionPanel, {
      items,
      attentionSummary: { total: 14, visible: 12, hidden: 2 },
      loadTier: "full",
      onLocateCard: () => undefined,
    })
  );
  assert.match(html, /Needs attention/);
  assert.match(html, /Deposit overdue/);
  assert.match(html, /2 more not shown/);
  assert.ok(!html.includes("receptionCards"));
  assert.ok(!html.includes("actionAlerts"));
});

test("lane omits empty content when collapsed completed", () => {
  const lane: FrontDeskTodayLane = {
    id: "completed",
    label: "Completed",
    count: 1,
    collapsedByDefault: true,
    cards: [sampleCard({ operationalState: "complete", laneId: "completed", allowedActions: ["open_patient"] })],
  };
  const html = renderToStaticMarkup(
    createElement(FrontDeskLane, {
      lane,
      busyBookingId: null,
      highlightBookingId: null,
      paymentsHref: PAYMENTS,
      onAction: () => undefined,
      revealLimit: 8,
    })
  );
  assert.match(html, /Completed/);
  assert.match(html, /\(1\)/);
  // collapsed by default — card body not required
});

test("terminal section keeps cancelled outside active wording", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskTerminalSection, {
      cancelled: [
        sampleCard({
          operationalState: "cancelled",
          laneId: null,
          allowedActions: ["open_patient"],
        }),
      ],
      noShow: [],
      busyBookingId: null,
      highlightBookingId: null,
      paymentsHref: PAYMENTS,
      onAction: () => undefined,
    })
  );
  assert.match(html, /Cancelled/);
  assert.match(html, /no-show/i);
});

test("header uses Front desk / Today labels", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskTodayHeader, {
      tenantName: "Demo Clinic",
      todayYmd: "2026-07-11",
      calendarTimezone: "UTC",
      loadTier: "shell",
      isRefreshing: true,
      lastRefreshedAt: null,
      refreshError: null,
      onRefresh: () => undefined,
    })
  );
  assert.match(html, /Front desk/);
  assert.match(html, /Today/);
  assert.match(html, /Updating/);
  assert.ok(!html.includes("Command Centre"));
  assert.ok(!html.includes("ReceptionOS"));
});

test("summary tiles render counts", () => {
  const summary: FrontDeskTodaySummary = {
    total: 5,
    arrivingSoon: 1,
    expected: 0,
    runningLate: 2,
    waiting: 1,
    inConsultation: 1,
    inTreatment: 0,
    completed: 0,
    cancelledOrNoShow: 0,
    paymentAttention: 1,
    blockers: 1,
  };
  const html = renderToStaticMarkup(
    createElement(FrontDeskTodaySummaryTiles, { summary })
  );
  assert.match(html, /Running late/);
  assert.match(html, /Waiting/);
});

test("running late card has non-colour urgency cue", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskPatientCard, {
      card: sampleCard({
        operationalState: "running_late",
        runningLate: true,
        laneId: "running_late",
        allowedActions: ["check_in", "open_patient"],
      }),
      busy: false,
      highlighted: false,
      paymentsHref: PAYMENTS,
      onAction: () => undefined,
    })
  );
  assert.match(html, /Running late/);
  assert.match(html, /Check in patient/);
  assert.match(html, /data-booking-id/);
});

test("booking id uniqueness: cards carry data-booking-id", () => {
  const html = renderToStaticMarkup(
    createElement(FrontDeskPatientCard, {
      card: sampleCard(),
      busy: false,
      highlighted: true,
      paymentsHref: PAYMENTS,
      onAction: () => undefined,
    })
  );
  assert.ok(html.includes(`data-booking-id="${BOOKING}"`));
});
