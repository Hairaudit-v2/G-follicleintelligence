import assert from "node:assert/strict";
import { test } from "node:test";

import type { FrontDeskTodayCard } from "@/src/lib/fiOs/frontDesk/frontDeskTodayPresentation.types";
import {
  FRONT_DESK_OPERATIONAL_STATE_LABELS,
  frontDeskCardActionLabel,
  frontDeskPatientsSearchHref,
  frontDeskPaymentsHref,
  isFrontDeskFlowActionId,
  mapFrontDeskCardActionToFlowAction,
  orderFrontDeskCardActions,
  staffFacingCopyIsClean,
} from "@/src/lib/fiOs/frontDesk/frontDeskTodayUiHelpers";

function card(
  partial: Partial<FrontDeskTodayCard> &
    Pick<FrontDeskTodayCard, "bookingId" | "operationalState" | "allowedActions">
): FrontDeskTodayCard {
  return {
    bookingId: partial.bookingId,
    patient: partial.patient ?? {
      displayName: "Alex",
      patientId: null,
      leadId: null,
    },
    appointment: partial.appointment ?? {
      startAtIso: "2026-07-11T12:30:00.000Z",
      endAtIso: "2026-07-11T13:00:00.000Z",
      startTimeLabel: "12:30",
      durationMinutes: 30,
      typeLabel: "Consultation",
    },
    resource: partial.resource ?? {
      clinicianLabel: "Dr A",
      roomLabel: null,
      clinicLabel: null,
    },
    operationalState: partial.operationalState,
    laneId: partial.laneId ?? "arriving_soon",
    runningLate: partial.runningLate ?? false,
    waitingMinutes: partial.waitingMinutes ?? null,
    payment: partial.payment ?? { state: "unknown", label: "Payment unknown" },
    blocker: partial.blocker ?? { highest: null, summary: null, items: [] },
    contact: null,
    allowedActions: partial.allowedActions,
    links: partial.links ?? {
      patient: null,
      appointment: "/fi-admin/t/appointments",
      calendar: "/fi-admin/t/calendar",
    },
  };
}

test("primary action: arriving soon → check_in", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "arriving_soon",
      allowedActions: ["check_in", "no_show", "cancel", "open_patient", "take_payment"],
    })
  );
  assert.equal(ordered.primary, "check_in");
  assert.ok(!ordered.secondary.includes("check_in"));
});

test("primary action: waiting → start_consultation", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "waiting",
      allowedActions: ["start_consultation", "start_treatment", "complete", "open_patient"],
    })
  );
  assert.equal(ordered.primary, "start_consultation");
});

test("primary action: in treatment → complete", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "in_treatment",
      allowedActions: ["complete", "open_patient"],
    })
  );
  assert.equal(ordered.primary, "complete");
});

test("payment due elevates take_payment in secondary", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "waiting",
      allowedActions: ["start_consultation", "open_patient", "take_payment"],
      payment: { state: "overdue", label: "Overdue" },
    })
  );
  assert.equal(ordered.primary, "start_consultation");
  assert.equal(ordered.secondary[0], "take_payment");
});

test("PIN-style allowedActions never invent cancel", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "arriving_soon",
      allowedActions: ["check_in", "no_show", "take_payment", "open_patient"],
    })
  );
  assert.ok(!ordered.secondary.includes("cancel"));
  assert.notEqual(ordered.primary, "cancel");
});

test("read-only allowedActions are navigation only", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "waiting",
      allowedActions: ["take_payment", "find_patient", "open_patient", "open_calendar"],
    })
  );
  assert.ok(!isFrontDeskFlowActionId(ordered.primary!));
});

test("map card actions to existing flow kinds", () => {
  assert.equal(mapFrontDeskCardActionToFlowAction("check_in"), "mark_arrived");
  assert.equal(mapFrontDeskCardActionToFlowAction("start_consultation"), "start_consultation");
  assert.equal(mapFrontDeskCardActionToFlowAction("cancel"), "cancel");
  assert.equal(mapFrontDeskCardActionToFlowAction("take_payment"), null);
});

test("payments href is always /payments", () => {
  assert.equal(
    frontDeskPaymentsHref("11111111-1111-1111-1111-111111111111"),
    "/fi-admin/11111111-1111-1111-1111-111111111111/payments"
  );
});

test("patients search uses q= contract", () => {
  const href = frontDeskPatientsSearchHref("11111111-1111-1111-1111-111111111111", "Alex Chen");
  assert.equal(
    href,
    "/fi-admin/11111111-1111-1111-1111-111111111111/patients?q=Alex%20Chen"
  );
});

test("operational state labels are staff-clean", () => {
  for (const label of Object.values(FRONT_DESK_OPERATIONAL_STATE_LABELS)) {
    assert.ok(staffFacingCopyIsClean(label), label);
  }
  for (const id of [
    "check_in",
    "start_consultation",
    "complete",
    "take_payment",
  ] as const) {
    assert.ok(staffFacingCopyIsClean(frontDeskCardActionLabel(id)));
  }
  assert.equal(staffFacingCopyIsClean("ReceptionOS"), false);
  assert.equal(staffFacingCopyIsClean("Front desk"), true);
});

test("does not invent actions missing from allowedActions", () => {
  const ordered = orderFrontDeskCardActions(
    card({
      bookingId: "a",
      operationalState: "waiting",
      allowedActions: ["open_patient"],
    })
  );
  assert.equal(ordered.primary, "open_patient");
  assert.deepEqual(ordered.secondary, []);
});
