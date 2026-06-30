import assert from "node:assert/strict";
import test from "node:test";

import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import {
  buildReceptionFlowBoardItems,
  buildReceptionPriorities,
  buildReceptionSnapshotCards,
  receptionFlowLaneForCard,
} from "@/src/lib/fiAdmin/receptionBoardPresentation";

function card(
  partial: Partial<ReceptionBoardCard> & Pick<ReceptionBoardCard, "id" | "receptionColumn">
): ReceptionBoardCard {
  return {
    startAt: "2026-06-23T09:00:00.000Z",
    endAt: "2026-06-23T10:00:00.000Z",
    title: null,
    bookingType: "consultation",
    bookingStatus: "scheduled",
    timezone: "Australia/Sydney",
    leadId: null,
    patientId: null,
    displayName: "Test Patient",
    statusLabel: "Scheduled",
    typeLabel: "Consultation",
    providerLabel: "Dr Test",
    clinicLabel: null,
    roomLabel: null,
    metadata: {},
    ...partial,
  };
}

test("receptionFlowLaneForCard: expected future → arriving_soon", () => {
  const now = Date.parse("2026-06-23T08:00:00.000Z");
  const lane = receptionFlowLaneForCard(
    card({ id: "a", receptionColumn: "expected", startAt: "2026-06-23T10:00:00.000Z" }),
    now
  );
  assert.equal(lane, "arriving_soon");
});

test("receptionFlowLaneForCard: overdue expected → waiting", () => {
  const now = Date.parse("2026-06-23T10:30:00.000Z");
  const lane = receptionFlowLaneForCard(
    card({ id: "b", receptionColumn: "expected", startAt: "2026-06-23T09:00:00.000Z" }),
    now
  );
  assert.equal(lane, "waiting");
});

test("buildReceptionSnapshotCards returns six cards", () => {
  const cards = [
    card({ id: "1", receptionColumn: "expected" }),
    card({ id: "2", receptionColumn: "arrived" }),
    card({ id: "3", receptionColumn: "in_consultation" }),
  ];
  const snapshot = buildReceptionSnapshotCards("/fi-admin/t", cards, {
    depositsDueCount: 1,
    depositsPaidTodayCount: 0,
    overduePaymentsCount: 2,
  });
  assert.equal(snapshot.length, 6);
  assert.equal(snapshot[0].label, "Expected arrivals");
  assert.equal(snapshot[0].value, 1);
});

test("buildReceptionPriorities ranks overdue check-in highest", () => {
  const now = Date.parse("2026-06-23T11:00:00.000Z");
  const cards = [
    card({ id: "1", receptionColumn: "expected", startAt: "2026-06-23T09:00:00.000Z" }),
  ];
  const items = buildReceptionPriorities(
    "/fi-admin/t",
    cards,
    { depositsDueCount: 0, depositsPaidTodayCount: 0, overduePaymentsCount: 0 },
    {
      leadsAwaitingContact: 0,
      consultationsAwaitingCompletion: 0,
      followUpsDue: 0,
      surgeryReadinessAlerts: 0,
      surgeryFinancialPaymentAttention: 0,
      financialPathwayTasksAttention: 0,
      financeApplicationsAttention: 0,
      superReleaseApplicationsAttention: 0,
      internationalTransferApplicationsAttention: 0,
      financialClearanceAttention: 0,
    },
    5,
    now
  );
  assert.ok(items.length > 0);
  assert.equal(items[0].id, "check_in_overdue");
});

test("buildReceptionFlowBoardItems excludes cancelled", () => {
  const lanes = buildReceptionFlowBoardItems([
    card({ id: "1", receptionColumn: "cancelled" }),
    card({ id: "2", receptionColumn: "arrived" }),
  ]);
  assert.equal(lanes.checked_in.length, 1);
  assert.equal(lanes.arriving_soon.length, 0);
});
