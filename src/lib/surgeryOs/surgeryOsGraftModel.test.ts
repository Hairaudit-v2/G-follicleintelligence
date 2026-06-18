import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assessGraftReconciliationGate,
  buildGraftSummaryExport,
  buildGraftTotalsFromSession,
  canAcquireGraftCountSessionLock,
  computeAverageHairsPerGraft,
  computeConfirmedTrayTotals,
  computeGraftProgressPercent,
  computeRemainingGrafts,
  deriveGraftAlerts,
  deriveReconciliationStatus,
  deriveTrayReviewStatusForEvent,
  isSurgeryStatusEligibleForGraftCounting,
  shouldBlockSurgeryPhaseForGraftReconciliation,
  validateGraftCorrection,
  validateGraftCountUpdate,
  computeGraftCompositionTotal,
  computeTrayHairTotal,
  deriveTrayReviewStatuses,
  requiresLargeCorrectionNote,
  computeGraftCorrectionMagnitude,
  graftEventTypeToTimelineKind,
} from "@/src/lib/surgeryOs/surgeryOsGraftModel";

describe("surgeryOsGraftModel", () => {
  it("computes remaining grafts as extracted − implanted − discarded", () => {
    assert.equal(computeRemainingGrafts(3000, 2800, 50), 150);
    assert.equal(computeRemainingGrafts(1000, 1000, 0), 0);
  });

  it("computes average hairs per graft", () => {
    assert.equal(computeAverageHairsPerGraft(5000, 2500), 2);
    assert.equal(computeAverageHairsPerGraft(0, 100), null);
    assert.equal(computeAverageHairsPerGraft(100, 0), null);
  });

  it("computes graft progress percent capped at 100", () => {
    assert.equal(computeGraftProgressPercent(1500, 3000), 50);
    assert.equal(computeGraftProgressPercent(3500, 3000), 100);
    assert.equal(computeGraftProgressPercent(100, null), null);
  });

  it("blocks negative count deltas", () => {
    const result = validateGraftCountUpdate({
      currentExtracted: 100,
      currentImplanted: 50,
      currentDiscarded: 10,
      deltaExtracted: -5,
      deltaImplanted: 0,
      deltaDiscarded: 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "negative_count");
  });

  it("blocks over-implantation", () => {
    const result = validateGraftCountUpdate({
      currentExtracted: 100,
      currentImplanted: 90,
      currentDiscarded: 0,
      deltaExtracted: 0,
      deltaImplanted: 20,
      deltaDiscarded: 0,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "over_implantation");
  });

  it("detects reconciliation mismatch when remaining is non-zero", () => {
    assert.equal(deriveReconciliationStatus(1000, 900, 50, 50, false), "mismatch");
    assert.equal(deriveReconciliationStatus(1000, 950, 50, 0, false), "balanced");
    assert.equal(deriveReconciliationStatus(1000, 950, 50, 0, true), "completed");
  });

  it("buildGraftTotalsFromSession derives remaining and average", () => {
    const totals = buildGraftTotalsFromSession({
      targetGrafts: 3000,
      extractedGrafts: 1000,
      implantedGrafts: 800,
      discardedGrafts: 50,
      singles: 200,
      doubles: 300,
      triples: 100,
      multiples: 50,
      totalHairs: 1300,
    });
    assert.equal(totals.remainingGrafts, 150);
    assert.equal(totals.averageHairsPerGraft, 2);
  });

  it("deriveGraftAlerts surfaces mismatch and low hairs warnings", () => {
    const totals = buildGraftTotalsFromSession({
      targetGrafts: 3000,
      extractedGrafts: 1000,
      implantedGrafts: 800,
      discardedGrafts: 50,
      singles: 1000,
      doubles: 0,
      triples: 0,
      multiples: 0,
      totalHairs: 1500,
    });
    const alerts = deriveGraftAlerts({
      surgeryId: "00000000-0000-4000-8000-000000000001",
      patientLabel: "Test",
      procedurePhase: "implantation",
      totals,
      reconciliationStatus: "mismatch",
      href: null,
    });
    assert.ok(alerts.some((a) => a.kind === "graft_extracted_implanted_mismatch"));
    assert.ok(alerts.some((a) => a.kind === "graft_average_hairs_low"));
  });

  it("validateGraftCorrection blocks negative absolute counts", () => {
    const result = validateGraftCorrection({ extracted: -1, implanted: 0, discarded: 0 });
    assert.equal(result.ok, false);
  });

  it("maps graft event types to procedure timeline kinds", () => {
    assert.equal(graftEventTypeToTimelineKind("tray_count"), "tray_count_recorded");
    assert.equal(graftEventTypeToTimelineKind("tray_confirmed"), "tray_count_recorded");
    assert.equal(graftEventTypeToTimelineKind("graft_reconciliation"), "graft_reconciliation_completed");
    assert.equal(graftEventTypeToTimelineKind("correction"), "graft_correction");
    assert.equal(graftEventTypeToTimelineKind("count_update"), "graft_count_update");
  });

  it("computes tray hair totals from composition", () => {
    assert.equal(
      computeTrayHairTotal({ singles: 10, doubles: 5, triples: 2, multiples: 1 }),
      10 + 10 + 6 + 4,
    );
  });

  it("requires note for large corrections", () => {
    const magnitude = computeGraftCorrectionMagnitude({
      previous: { extracted: 1000, implanted: 900, discarded: 50 },
      next: { extracted: 1000, implanted: 850, discarded: 50 },
    });
    assert.equal(magnitude, 50);
    assert.equal(requiresLargeCorrectionNote(magnitude), true);
    assert.equal(requiresLargeCorrectionNote(5), false);
  });

  it("derives tray review status from confirm/reject events", () => {
    const statuses = deriveTrayReviewStatuses([
      {
        id: "tray-1",
        eventType: "tray_count",
        note: "Tray #1",
        createdAt: "2026-06-19T10:00:00.000Z",
      },
      {
        id: "review-1",
        eventType: "tray_confirmed",
        note: "Confirmed: Tray #1",
        createdAt: "2026-06-19T10:05:00.000Z",
      },
    ]);
    assert.equal(statuses.get("tray-1"), "confirmed");
  });

  it("excludes rejected trays from confirmed tray totals", () => {
    const totals = computeConfirmedTrayTotals([
      {
        eventType: "tray_count",
        reviewStatus: "confirmed",
        singles: 10,
        doubles: 5,
        triples: 0,
        multiples: 0,
        totalHairs: 20,
        deltaDiscarded: 1,
      },
      {
        eventType: "tray_count",
        reviewStatus: "rejected",
        singles: 99,
        doubles: 0,
        triples: 0,
        multiples: 0,
        totalHairs: 99,
        deltaDiscarded: 0,
      },
      {
        eventType: "tray_count",
        reviewStatus: "pending",
        singles: 50,
        doubles: 0,
        triples: 0,
        multiples: 0,
        totalHairs: 50,
        deltaDiscarded: 0,
      },
    ]);
    assert.equal(totals.singles, 10);
    assert.equal(totals.doubles, 5);
    assert.equal(totals.trayCount, 1);
    assert.equal(totals.damaged, 1);
  });

  it("blocks duplicate session lock acquisition for another device", () => {
    const nowMs = Date.parse("2026-06-19T12:00:00.000Z");
    assert.equal(
      canAcquireGraftCountSessionLock({
        lockDeviceId: "device-a",
        lockHeldAt: "2026-06-19T11:30:00.000Z",
        requestingDeviceId: "device-b",
        nowMs,
      }),
      false,
    );
    assert.equal(
      canAcquireGraftCountSessionLock({
        lockDeviceId: "device-a",
        lockHeldAt: "2026-06-19T11:30:00.000Z",
        requestingDeviceId: "device-a",
        nowMs,
      }),
      true,
    );
  });

  it("allows lock takeover when stale", () => {
    const nowMs = Date.parse("2026-06-19T16:00:00.000Z");
    assert.equal(
      canAcquireGraftCountSessionLock({
        lockDeviceId: "device-a",
        lockHeldAt: "2026-06-19T10:00:00.000Z",
        requestingDeviceId: "device-b",
        nowMs,
      }),
      true,
    );
  });

  it("assesses reconciliation gate before recovery/complete", () => {
    const blocked = assessGraftReconciliationGate({
      extractedGrafts: 1000,
      implantedGrafts: 950,
      discardedGrafts: 40,
      remainingGrafts: 10,
      reconciliationStatus: "mismatch",
      pendingTrayCount: 2,
      requireCompleted: true,
    });
    assert.equal(blocked.ok, false);
    if (!blocked.ok) {
      assert.ok(blocked.reasons.some((r) => r.includes("awaiting nurse review")));
      assert.ok(blocked.reasons.some((r) => r.includes("reconciliation")));
    }

    const open = assessGraftReconciliationGate({
      extractedGrafts: 1000,
      implantedGrafts: 950,
      discardedGrafts: 50,
      remainingGrafts: 0,
      reconciliationStatus: "completed",
      pendingTrayCount: 0,
      requireCompleted: true,
    });
    assert.equal(open.ok, true);
  });

  it("blocks completed/cancelled surgeries unless admin override", () => {
    assert.equal(isSurgeryStatusEligibleForGraftCounting("in_progress"), true);
    assert.equal(isSurgeryStatusEligibleForGraftCounting("completed"), false);
    assert.equal(isSurgeryStatusEligibleForGraftCounting("completed", { allowAdminOverride: true }), true);
  });

  it("requires graft reconciliation before recovery or complete phases", () => {
    assert.equal(shouldBlockSurgeryPhaseForGraftReconciliation("recovery"), true);
    assert.equal(shouldBlockSurgeryPhaseForGraftReconciliation("complete"), true);
    assert.equal(shouldBlockSurgeryPhaseForGraftReconciliation("implantation"), false);
  });

  it("builds export shape with tray and reconciliation metadata", () => {
    const totals = buildGraftTotalsFromSession({
      targetGrafts: 3000,
      extractedGrafts: 1000,
      implantedGrafts: 980,
      discardedGrafts: 20,
      singles: 400,
      doubles: 300,
      triples: 200,
      multiples: 100,
      totalHairs: 2100,
    });
    const exported = buildGraftSummaryExport({
      tenantName: "Test Clinic",
      patientLabel: "Patient A",
      surgeryId: "00000000-0000-4000-8000-000000000001",
      exportedAt: "2026-06-19T18:00:00.000Z",
      totals,
      reconciliationStatus: "completed",
      reconciledAt: "2026-06-19T17:00:00.000Z",
      reconciledByLabel: "Dr Smith",
      reconciliationNote: "Balanced in theatre",
      events: [
        {
          eventType: "tray_count",
          reviewStatus: "confirmed",
          singles: 10,
          doubles: 0,
          triples: 0,
          multiples: 0,
          totalHairs: 10,
          deltaDiscarded: 0,
        },
        {
          eventType: "correction",
          reviewStatus: null,
          singles: null,
          doubles: null,
          triples: null,
          multiples: null,
          totalHairs: null,
          deltaDiscarded: 0,
        },
      ],
    });
    assert.equal(exported.targetGrafts, 3000);
    assert.equal(exported.trayCounts.confirmed, 1);
    assert.equal(exported.correctionCount, 1);
    assert.equal(exported.reconciledByLabel, "Dr Smith");
  });

  it("surfaces pending tray and correction alerts", () => {
    const totals = buildGraftTotalsFromSession({
      targetGrafts: 3000,
      extractedGrafts: 1000,
      implantedGrafts: 800,
      discardedGrafts: 50,
      singles: 1000,
      doubles: 0,
      triples: 0,
      multiples: 0,
      totalHairs: 1500,
    });
    const alerts = deriveGraftAlerts({
      surgeryId: "00000000-0000-4000-8000-000000000001",
      patientLabel: "Test",
      procedurePhase: "implantation",
      totals,
      reconciliationStatus: "mismatch",
      href: null,
      pendingTrayCount: 2,
      recentCorrectionMagnitude: 25,
    });
    assert.ok(alerts.some((a) => a.kind === "graft_pending_tray_review"));
    assert.ok(alerts.some((a) => a.kind === "graft_correction_above_threshold"));
  });

  it("prevents re-review of already reviewed trays", () => {
    const events = [
      {
        id: "tray-1",
        eventType: "tray_count" as const,
        note: "Tray #1",
        createdAt: "2026-06-19T10:00:00.000Z",
      },
      {
        id: "review-1",
        eventType: "tray_rejected" as const,
        note: "Rejected: Tray #1",
        createdAt: "2026-06-19T10:05:00.000Z",
      },
    ];
    assert.equal(deriveTrayReviewStatusForEvent("tray-1", events), "rejected");
  });
});
