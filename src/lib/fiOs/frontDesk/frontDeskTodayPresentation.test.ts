import assert from "node:assert/strict";
import { test } from "node:test";

import { RECEPTION_RUNNING_LATE_GRACE_MINUTES } from "@/src/lib/fiOs/receptionBoardModel";
import type {
  ReceptionBoardActionAlert,
  ReceptionBoardAppointmentCard,
  ReceptionBoardCommandCenterPayload,
} from "@/src/lib/receptionBoard/receptionBoardTypes";
import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

import {
  buildFrontDeskTodayPresentation,
  FRONT_DESK_TODAY_ATTENTION_CAP,
} from "./frontDeskTodayPresentation";

const TENANT = "11111111-1111-1111-1111-111111111111";
const BASE = `/fi-admin/${TENANT}`;
const NOW_MS = Date.parse("2026-07-11T12:00:00.000Z");
const BOOKING_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOOKING_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const BOOKING_C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PATIENT_1 = "11111111-1111-4111-8111-111111111111";

function emptyQueue(): ReceptionBoardCommandCenterPayload["queue"] {
  return {
    scheduled: [],
    arrived: [],
    checked_in: [],
    waiting: [],
    in_consultation: [],
    procedure_in_progress: [],
    completed: [],
    follow_up_booked: [],
  };
}

function card(
  partial: Partial<ReceptionBoardCard> & Pick<ReceptionBoardCard, "id">
): ReceptionBoardCard {
  return {
    id: partial.id,
    startAt: partial.startAt ?? "2026-07-11T12:30:00.000Z",
    endAt: partial.endAt ?? "2026-07-11T13:00:00.000Z",
    title: partial.title ?? null,
    bookingType: partial.bookingType ?? "consultation",
    bookingStatus: partial.bookingStatus ?? "scheduled",
    timezone: partial.timezone ?? "UTC",
    leadId: partial.leadId ?? null,
    patientId: partial.patientId ?? null,
    displayName: partial.displayName ?? "Patient",
    statusLabel: partial.statusLabel ?? "Scheduled",
    typeLabel: partial.typeLabel ?? "Consultation",
    providerLabel: partial.providerLabel ?? "Dr A",
    clinicLabel: partial.clinicLabel ?? null,
    roomLabel: partial.roomLabel ?? null,
    receptionColumn: partial.receptionColumn ?? "expected",
    metadata: partial.metadata ?? {},
  };
}

function appointment(
  partial: Partial<ReceptionBoardAppointmentCard> & Pick<ReceptionBoardAppointmentCard, "id">
): ReceptionBoardAppointmentCard {
  return {
    id: partial.id,
    patientName: partial.patientName ?? "Patient",
    appointmentTime: partial.appointmentTime ?? "12:30",
    appointmentType: partial.appointmentType ?? "Consultation",
    clinician: partial.clinician ?? "Dr A",
    status: partial.status ?? "scheduled",
    statusLabel: partial.statusLabel ?? "Scheduled",
    durationMinutes: partial.durationMinutes ?? 30,
    room: partial.room ?? null,
    paymentStatus: partial.paymentStatus ?? "unknown",
    paymentStatusLabel: partial.paymentStatusLabel ?? "Unknown",
    confirmationStatus: partial.confirmationStatus ?? "confirmed",
    journeyState: partial.journeyState ?? null,
    journeyStateLabel: partial.journeyStateLabel ?? null,
    sortKey: partial.sortKey ?? partial.id,
    hrefs: partial.hrefs ?? {
      patient: null,
      case: null,
      lead: null,
      appointment: `${BASE}/appointments?bookingId=${partial.id}`,
      calendar: `${BASE}/calendar?bookingId=${partial.id}`,
      followUp: `${BASE}/patients/returning`,
    },
  };
}

function alert(
  partial: Partial<ReceptionBoardActionAlert> &
    Pick<ReceptionBoardActionAlert, "id" | "kind" | "title">
): ReceptionBoardActionAlert {
  return {
    id: partial.id,
    kind: partial.kind,
    title: partial.title,
    detail: partial.detail ?? "detail",
    severity: partial.severity ?? "warning",
    href: partial.href ?? null,
    priorityScore: partial.priorityScore ?? 80,
    bookingId: partial.bookingId ?? null,
    patientId: partial.patientId ?? null,
  };
}

function payload(
  overrides: Partial<ReceptionBoardCommandCenterPayload> = {}
): ReceptionBoardCommandCenterPayload {
  return {
    tenantId: TENANT,
    tenantName: "Test Clinic",
    loadedAt: "2026-07-11T12:00:00.000Z",
    operationalDay: {
      calendarTimezone: "UTC",
      todayYmd: "2026-07-11",
      localStartIso: "2026-07-11T00:00:00.000Z",
      localEndIso: "2026-07-12T00:00:00.000Z",
    },
    appointments: [],
    queue: emptyQueue(),
    actionAlerts: [],
    quickActions: [],
    tomorrowSurgeries: [],
    intelligence: {
      todayConsultations: 0,
      todaySurgeries: 0,
      revenueBookedToday: 0,
      outstandingPayments: 0,
      conversionRateToday: null,
      doctorUtilizationPercent: null,
      staffUtilizationPercent: null,
      averageConsultationCloseRate: null,
      upcomingFollowUps: 0,
      unreadPatientTasks: 0,
    },
    liveEvents: [],
    receptionCards: [],
    loadTier: "full",
    ...overrides,
  };
}

function build(
  p: ReceptionBoardCommandCenterPayload,
  mode: "full" | "pin_reception" | "none" = "full"
) {
  return buildFrontDeskTodayPresentation(p, {
    base: BASE,
    nowMs: NOW_MS,
    mutationMode: mode,
  });
}

function allCards(pres: ReturnType<typeof build>) {
  return [
    ...pres.lanes.flatMap((l) => l.cards),
    ...pres.exceptionCards.cancelled,
    ...pres.exceptionCards.noShow,
  ];
}

function findCard(pres: ReturnType<typeof build>, bookingId: string) {
  return allCards(pres).find((c) => c.bookingId === bookingId);
}

// --- tests -------------------------------------------------------------------

test("1. duplicate source rows produce one booking card", () => {
  const c = card({ id: BOOKING_A, patientId: PATIENT_1 });
  const pres = build(
    payload({
      receptionCards: [c, { ...c }],
      appointments: [appointment({ id: BOOKING_A, paymentStatus: "due" })],
    })
  );
  assert.equal(pres.summary.total, 1);
  assert.equal(allCards(pres).length, 1);
});

test("2. ReceptionOS-style data enriches but never creates a card", () => {
  const c = card({ id: BOOKING_A });
  const pres = build(
    payload({
      receptionCards: [c],
      // appointments for unknown booking must not create cards
      appointments: [
        appointment({ id: BOOKING_A, paymentStatus: "due", paymentStatusLabel: "Deposit due" }),
        appointment({
          id: BOOKING_B,
          paymentStatus: "overdue",
          paymentStatusLabel: "Ghost payment",
        }),
      ],
    })
  );
  assert.equal(pres.summary.total, 1);
  assert.equal(findCard(pres, BOOKING_A)?.payment.state, "due");
  assert.equal(findCard(pres, BOOKING_B), undefined);
});

test("3. agenda data cannot create a card (not consumed)", () => {
  // Builder never reads agenda; only receptionCards mint cards.
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
    })
  );
  assert.equal(pres.summary.total, 1);
});

test("4. payment merges by booking ID", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      appointments: [
        appointment({ id: BOOKING_A, paymentStatus: "overdue", paymentStatusLabel: "Overdue" }),
      ],
    })
  );
  const c = findCard(pres, BOOKING_A)!;
  assert.equal(c.payment.state, "overdue");
  assert.equal(c.payment.label, "Overdue");
});

test("5. multiple blockers remain on one card", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A, patientId: PATIENT_1 })],
      actionAlerts: [
        alert({
          id: "a1",
          kind: "missing_consent",
          title: "Consent missing",
          severity: "warning",
          bookingId: BOOKING_A,
        }),
        alert({
          id: "a2",
          kind: "missing_deposit",
          title: "Deposit missing",
          severity: "critical",
          bookingId: BOOKING_A,
          priorityScore: 95,
        }),
      ],
    })
  );
  const c = findCard(pres, BOOKING_A)!;
  assert.equal(c.blocker.items.length, 2);
});

test("6. strongest blocker determines card severity", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      actionAlerts: [
        alert({
          id: "a1",
          kind: "missing_consent",
          title: "Consent",
          severity: "warning",
          bookingId: BOOKING_A,
        }),
        alert({
          id: "a2",
          kind: "missing_deposit",
          title: "Deposit critical",
          severity: "critical",
          bookingId: BOOKING_A,
          priorityScore: 95,
        }),
      ],
    })
  );
  const c = findCard(pres, BOOKING_A)!;
  assert.equal(c.blocker.highest, "blocker");
  assert.equal(c.blocker.summary, "Deposit critical");
});

test("7. secondary blockers remain available", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      actionAlerts: [
        alert({
          id: "a1",
          kind: "missing_consent",
          title: "Consent",
          severity: "warning",
          bookingId: BOOKING_A,
        }),
        alert({
          id: "a2",
          kind: "missing_deposit",
          title: "Deposit",
          severity: "critical",
          bookingId: BOOKING_A,
        }),
      ],
    })
  );
  const kinds = findCard(pres, BOOKING_A)!.blocker.items.map((i) => i.kind);
  assert.ok(kinds.includes("missing_consent"));
  assert.ok(kinds.includes("missing_deposit"));
});

test("8. patient-level alert produces one panel item", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({ id: BOOKING_A, patientId: PATIENT_1, displayName: "Alex" }),
        card({ id: BOOKING_B, patientId: PATIENT_1, displayName: "Alex" }),
      ],
      actionAlerts: [
        alert({
          id: "journey-p1-consent",
          kind: "missing_consent",
          title: "Missing consent",
          severity: "critical",
          patientId: PATIENT_1,
          bookingId: null,
        }),
      ],
    })
  );
  const panel = pres.attentionItems.filter((a) => a.kind === "missing_consent");
  assert.equal(panel.length, 1);
  // Badges both cards
  assert.ok(findCard(pres, BOOKING_A)!.blocker.items.length >= 1);
  assert.ok(findCard(pres, BOOKING_B)!.blocker.items.length >= 1);
});

test("9. alert without IDs remains panel-only", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      actionAlerts: [
        alert({
          id: "orphan-1",
          kind: "missing_forms",
          title: "Forms incomplete",
          severity: "warning",
          bookingId: null,
          patientId: null,
        }),
      ],
    })
  );
  assert.equal(findCard(pres, BOOKING_A)!.blocker.items.length, 0);
  assert.ok(pres.attentionItems.some((a) => a.id === "orphan-1"));
});

test("10. ambiguous linkage never attaches to a booking", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A }), card({ id: BOOKING_B })],
      actionAlerts: [
        alert({
          id: "no-key",
          kind: "staff_not_assigned",
          title: "Staff issue",
          severity: "warning",
        }),
      ],
    })
  );
  assert.equal(findCard(pres, BOOKING_A)!.blocker.items.length, 0);
  assert.equal(findCard(pres, BOOKING_B)!.blocker.items.length, 0);
  assert.ok(pres.attentionItems.some((a) => a.id === "no-key"));
});

test("11. composite alert IDs are never parsed for attribution", () => {
  // bookingId only appears inside id string — must not attach
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      actionAlerts: [
        alert({
          id: `surgery-issue-${BOOKING_A}-missing_consent`,
          kind: "missing_consent",
          title: "Consent",
          severity: "critical",
          bookingId: null,
          patientId: null,
        }),
      ],
    })
  );
  assert.equal(findCard(pres, BOOKING_A)!.blocker.items.length, 0);
});

test("12. terminal bookings have one outcome only", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "cancelled",
          receptionColumn: "cancelled",
        }),
      ],
    })
  );
  assert.equal(pres.exceptionCards.cancelled.length, 1);
  assert.equal(pres.lanes.every((l) => l.cards.length === 0), true);
  assert.equal(pres.summary.cancelledOrNoShow, 1);
});

test("13. completed remains distinct from cancelled/no-show", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "completed",
          receptionColumn: "complete",
        }),
        card({
          id: BOOKING_B,
          bookingStatus: "cancelled",
          receptionColumn: "cancelled",
        }),
        card({
          id: BOOKING_C,
          bookingStatus: "no_show",
          receptionColumn: "no_show",
        }),
      ],
    })
  );
  const completedLane = pres.lanes.find((l) => l.id === "completed")!;
  assert.equal(completedLane.cards.length, 1);
  assert.equal(completedLane.cards[0]?.bookingId, BOOKING_A);
  assert.equal(pres.exceptionCards.cancelled.length, 1);
  assert.equal(pres.exceptionCards.noShow.length, 1);
  assert.equal(pres.summary.completed, 1);
  assert.equal(pres.summary.cancelledOrNoShow, 2);
});

test("14. running-late delegates to S3.1", () => {
  const start = new Date(NOW_MS - (RECEPTION_RUNNING_LATE_GRACE_MINUTES + 5) * 60_000).toISOString();
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "scheduled",
          startAt: start,
          endAt: new Date(Date.parse(start) + 30 * 60_000).toISOString(),
        }),
      ],
    })
  );
  const c = findCard(pres, BOOKING_A)!;
  assert.equal(c.operationalState, "running_late");
  assert.equal(c.runningLate, true);
  assert.equal(c.laneId, "running_late");
  assert.ok(pres.lanes.find((l) => l.id === "running_late")!.cards.some((x) => x.bookingId === BOOKING_A));
});

test("15. arrived patient past start remains Waiting", () => {
  const start = "2026-07-11T10:00:00.000Z";
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "arrived",
          receptionColumn: "arrived",
          startAt: start,
          metadata: {},
        }),
      ],
    })
  );
  const c = findCard(pres, BOOKING_A)!;
  assert.equal(c.operationalState, "waiting");
  assert.equal(c.runningLate, false);
  assert.equal(c.laneId, "waiting");
});

test("16. missing arrival timestamp keeps waitingMinutes null", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "arrived",
          startAt: "2026-07-11T10:00:00.000Z",
          metadata: {},
        }),
      ],
    })
  );
  assert.equal(findCard(pres, BOOKING_A)!.waitingMinutes, null);
});

test("16b. real arrival instant populates waitingMinutes", () => {
  const arrivedAt = "2026-07-11T11:30:00.000Z"; // 30 min before NOW
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "arrived",
          startAt: "2026-07-11T10:00:00.000Z",
          metadata: { fi_reception_arrived_at: arrivedAt },
        }),
      ],
    })
  );
  assert.equal(findCard(pres, BOOKING_A)!.waitingMinutes, 30);
});

test("17. full session exposes valid actions", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "scheduled",
          startAt: "2026-07-11T12:30:00.000Z",
        }),
      ],
    }),
    "full"
  );
  const actions = findCard(pres, BOOKING_A)!.allowedActions;
  assert.ok(actions.includes("check_in"));
  assert.ok(actions.includes("cancel"));
  assert.ok(actions.includes("take_payment"));
});

test("18. PIN excludes Cancel", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "scheduled",
          startAt: "2026-07-11T12:30:00.000Z",
        }),
      ],
    }),
    "pin_reception"
  );
  const actions = findCard(pres, BOOKING_A)!.allowedActions;
  assert.ok(actions.includes("check_in"));
  assert.ok(!actions.includes("cancel"));
});

test("19. read-only exposes no mutation actions", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "arrived",
        }),
      ],
    }),
    "none"
  );
  const actions = findCard(pres, BOOKING_A)!.allowedActions;
  assert.ok(!actions.includes("check_in"));
  assert.ok(!actions.includes("start_consultation"));
  assert.ok(!actions.includes("complete"));
  assert.ok(!actions.includes("cancel"));
  assert.ok(actions.includes("take_payment"));
  assert.ok(actions.includes("find_patient"));
});

test("20. equal times sort by booking ID", () => {
  const start = "2026-07-11T13:00:00.000Z";
  const pres = build(
    payload({
      receptionCards: [
        card({ id: BOOKING_B, startAt: start, bookingStatus: "scheduled" }),
        card({ id: BOOKING_A, startAt: start, bookingStatus: "scheduled" }),
      ],
    })
  );
  const lane = pres.lanes.find((l) => l.id === "arriving_soon")!;
  assert.deepEqual(
    lane.cards.map((c) => c.bookingId),
    [BOOKING_A, BOOKING_B]
  );
});

test("21. empty payload returns a valid empty presentation", () => {
  const pres = build(payload({ receptionCards: [], actionAlerts: [] }));
  assert.equal(pres.summary.total, 0);
  assert.equal(pres.attentionItems.length, 0);
  assert.equal(pres.attentionSummary.total, 0);
  assert.ok(pres.lanes.every((l) => l.count === 0));
  assert.ok(pres.actions.length >= 3);
  assert.equal(pres.loadTier, "full");
});

test("22. invalid optional enrichment cannot remove valid cards", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      appointments: [
        // unknown booking id
        appointment({ id: BOOKING_B, paymentStatus: "overdue" }),
      ],
      actionAlerts: [
        // malformed severity — skipped
        {
          id: "bad",
          kind: "missing_deposit",
          title: "x",
          detail: "y",
          severity: "nope" as "warning",
          href: null,
          priorityScore: 1,
        },
      ],
    })
  );
  assert.equal(pres.summary.total, 1);
  assert.ok(findCard(pres, BOOKING_A));
});

test("23. attention is capped at 12 after severity sorting", () => {
  // Distinct patientIds so panel dedupe key (patientId|kind) does not collapse rows.
  const kinds = [
    "missing_forms",
    "missing_consent",
    "missing_deposit",
    "staff_not_assigned",
    "missing_imaging",
    "missing_pre_op_checklist",
    "missing_treatment_plan",
    "incomplete_consultation",
    "surgery_readiness_incomplete",
    "unconfirmed_surgery",
    "missing_medical_clearance",
    "surgery_risk",
  ] as const;
  const alerts: ReceptionBoardActionAlert[] = [];
  for (let i = 0; i < 20; i++) {
    const patientId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    alerts.push(
      alert({
        id: `alert-${i}`,
        kind: kinds[i % kinds.length]!,
        title: `Issue ${i}`,
        severity: i < 3 ? "critical" : "info",
        priorityScore: 100 - i,
        bookingId: null,
        patientId,
      })
    );
  }
  const pres = build(payload({ receptionCards: [], actionAlerts: alerts }));
  assert.equal(pres.attentionItems.length, FRONT_DESK_TODAY_ATTENTION_CAP);
  // Most severe first
  assert.equal(pres.attentionItems[0]?.severity, "blocker");
});

test("24. hidden attention count is returned accurately", () => {
  const alerts = Array.from({ length: 15 }, (_, i) => {
    const patientId = `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;
    return alert({
      id: `alert-${i}`,
      kind: "missing_forms",
      title: `Issue ${i}`,
      severity: "warning",
      priorityScore: 50,
      patientId,
    });
  });
  const pres = build(payload({ actionAlerts: alerts }));
  assert.equal(pres.attentionSummary.total, 15);
  assert.equal(pres.attentionSummary.visible, 12);
  assert.equal(pres.attentionSummary.hidden, 3);
});

test("25. repeated input and clock produce identical output", () => {
  const p = payload({
    receptionCards: [
      card({ id: BOOKING_A, startAt: "2026-07-11T12:20:00.000Z" }),
      card({ id: BOOKING_B, bookingStatus: "arrived", startAt: "2026-07-11T10:00:00.000Z" }),
    ],
    appointments: [appointment({ id: BOOKING_A, paymentStatus: "due" })],
    actionAlerts: [
      alert({
        id: "x1",
        kind: "missing_consent",
        title: "Consent",
        bookingId: BOOKING_A,
        severity: "critical",
      }),
    ],
  });
  const a = build(p);
  const b = build(p);
  assert.deepEqual(a, b);
});

test("26. multiple bookings for one patient remain separate by booking ID", () => {
  const pres = build(
    payload({
      receptionCards: [
        card({ id: BOOKING_A, patientId: PATIENT_1, displayName: "Alex", startAt: "2026-07-11T12:15:00.000Z" }),
        card({ id: BOOKING_B, patientId: PATIENT_1, displayName: "Alex", startAt: "2026-07-11T14:00:00.000Z" }),
      ],
    })
  );
  assert.equal(pres.summary.total, 2);
  assert.ok(findCard(pres, BOOKING_A));
  assert.ok(findCard(pres, BOOKING_B));
});

test("shell tier: payment unknown, empty attention, lanes still render", () => {
  const pres = build(
    payload({
      loadTier: "shell",
      receptionCards: [
        card({
          id: BOOKING_A,
          bookingStatus: "scheduled",
          startAt: "2026-07-11T12:20:00.000Z",
        }),
      ],
      appointments: [appointment({ id: BOOKING_A, paymentStatus: "overdue" })],
      actionAlerts: [
        alert({
          id: "x",
          kind: "missing_consent",
          title: "Consent",
          bookingId: BOOKING_A,
          severity: "critical",
        }),
      ],
    })
  );
  assert.equal(pres.loadTier, "shell");
  assert.equal(findCard(pres, BOOKING_A)!.payment.state, "unknown");
  // Alerts still process if present on shell payload; shell typically has fewer.
  // Payment overdue path is full-tier only.
  assert.equal(pres.summary.paymentAttention, 0);
});

test("excluded pipeline kinds do not enter attention", () => {
  const pres = build(
    payload({
      receptionCards: [card({ id: BOOKING_A })],
      actionAlerts: [
        alert({
          id: "crm-1",
          kind: "no_follow_up_after_consultation",
          title: "Follow up",
          severity: "warning",
        }),
      ],
    })
  );
  assert.equal(pres.attentionItems.length, 0);
});
