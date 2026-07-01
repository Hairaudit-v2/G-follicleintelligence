import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ReceptionBoardCard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import {
  assertReceptionBoardTenantScope,
  buildIntelligenceMetrics,
  buildQueueBoard,
  mapCardToOperationalStatus,
  mapOperationalStatusToQueueColumn,
  nextFlowActionForQueueColumn,
  readinessToneFromPercent,
  sortActionAlerts,
} from "./receptionBoardCore";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function card(partial: Partial<ReceptionBoardCard> & Pick<ReceptionBoardCard, "id" | "receptionColumn">): ReceptionBoardCard {
  return {
    id: partial.id,
    startAt: partial.startAt ?? "2026-07-02T09:00:00.000Z",
    endAt: partial.endAt ?? "2026-07-02T09:30:00.000Z",
    title: partial.title ?? null,
    bookingType: partial.bookingType ?? "consultation",
    bookingStatus: partial.bookingStatus ?? "scheduled",
    timezone: partial.timezone ?? "UTC",
    leadId: partial.leadId ?? null,
    patientId: partial.patientId ?? null,
    displayName: partial.displayName ?? "Test Patient",
    statusLabel: partial.statusLabel ?? "Scheduled",
    typeLabel: partial.typeLabel ?? "Consultation",
    providerLabel: partial.providerLabel ?? "Dr Smith",
    clinicLabel: partial.clinicLabel ?? null,
    roomLabel: partial.roomLabel ?? null,
    receptionColumn: partial.receptionColumn,
    metadata: partial.metadata ?? {},
  };
}

describe("receptionBoardCore", () => {
  it("maps expected bookings to scheduled or waiting based on time", () => {
    const future = card({
      id: "22222222-2222-4222-8222-222222222222",
      receptionColumn: "expected",
      bookingStatus: "scheduled",
      startAt: "2099-01-01T09:00:00.000Z",
    });
    const overdue = card({
      id: "33333333-3333-4333-8333-333333333333",
      receptionColumn: "expected",
      bookingStatus: "confirmed",
      startAt: "2020-01-01T09:00:00.000Z",
    });
    assert.equal(mapCardToOperationalStatus(future), "scheduled");
    assert.equal(mapCardToOperationalStatus(overdue), "waiting");
  });

  it("maps clinical phases to queue columns", () => {
    assert.equal(mapOperationalStatusToQueueColumn("in_consultation"), "in_consultation");
    assert.equal(mapOperationalStatusToQueueColumn("in_procedure"), "procedure_in_progress");
    assert.equal(mapOperationalStatusToQueueColumn("checked_in"), "checked_in");
    assert.equal(mapOperationalStatusToQueueColumn("cancelled"), null);
  });

  it("suggests flow actions per queue column", () => {
    assert.equal(nextFlowActionForQueueColumn("scheduled"), "mark_arrived");
    assert.equal(nextFlowActionForQueueColumn("checked_in"), "start_consultation");
    assert.equal(nextFlowActionForQueueColumn("in_consultation"), "start_treatment");
    assert.equal(nextFlowActionForQueueColumn("procedure_in_progress"), "complete");
    assert.equal(nextFlowActionForQueueColumn("completed"), null);
  });

  it("builds tenant-scoped queue buckets", () => {
    const cards = [
      card({
        id: "44444444-4444-4444-8444-444444444444",
        receptionColumn: "expected",
        startAt: "2099-06-01T10:00:00.000Z",
      }),
      card({
        id: "55555555-5555-4555-8555-555555555555",
        receptionColumn: "arrived",
        bookingStatus: "arrived",
      }),
      card({
        id: "66666666-6666-4666-8666-666666666666",
        receptionColumn: "in_consultation",
        bookingStatus: "arrived",
        metadata: { fi_reception_flow_phase: "consultation" },
      }),
    ];
    const queue = buildQueueBoard(cards, {
      base: `/fi-admin/${TENANT}`,
      tz: "UTC",
      caseByBooking: new Map(),
      nowMs: Date.now(),
    });
    assert.equal(queue.scheduled.length, 1);
    assert.equal(queue.checked_in.length, 1);
    assert.equal(queue.in_consultation.length, 1);
    assert.equal(queue.scheduled[0]?.hrefs.appointment.includes(TENANT), true);
  });

  it("sorts alerts by severity and priority", () => {
    const sorted = sortActionAlerts([
      {
        id: "a",
        kind: "missing_forms",
        title: "Forms",
        detail: "x",
        severity: "info",
        href: null,
        priorityScore: 10,
      },
      {
        id: "b",
        kind: "missing_deposit",
        title: "Deposit",
        detail: "x",
        severity: "critical",
        href: null,
        priorityScore: 95,
      },
    ]);
    assert.equal(sorted[0]?.id, "b");
  });

  it("derives intelligence metrics from today's cards", () => {
    const metrics = buildIntelligenceMetrics({
      cards: [
        card({
          id: "77777777-7777-4777-8777-777777777777",
          receptionColumn: "in_consultation",
          bookingType: "consultation",
          bookingStatus: "arrived",
          metadata: { fi_reception_flow_phase: "consultation" },
        }),
        card({
          id: "88888888-8888-4888-8888-888888888888",
          receptionColumn: "expected",
          bookingType: "surgery",
        }),
      ],
    });
    assert.equal(metrics.todayConsultations, 1);
    assert.equal(metrics.todaySurgeries, 1);
    assert.ok(metrics.doctorUtilizationPercent != null);
  });

  it("color codes readiness percentage", () => {
    assert.equal(readinessToneFromPercent(95), "green");
    assert.equal(readinessToneFromPercent(80), "yellow");
    assert.equal(readinessToneFromPercent(50), "red");
  });

  it("rejects cross-tenant payload refresh", () => {
    assert.throws(
      () => assertReceptionBoardTenantScope(TENANT, OTHER),
      /tenant mismatch/
    );
  });
});