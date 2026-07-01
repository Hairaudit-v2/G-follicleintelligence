import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildExtractionVelocity } from "@/src/lib/surgeryOs/extractionVelocityCore";
import { buildGraftIntelligence } from "@/src/lib/surgeryOs/graftIntelligenceCore";
import { buildLiveProcedureTimeline } from "@/src/lib/surgeryOs/liveProcedureTimelineCore";
import { buildSurgicalRiskDetection } from "@/src/lib/surgeryOs/surgicalRiskDetectionCore";
import { buildTransectionMonitoring } from "@/src/lib/surgeryOs/transectionMonitoringCore";

const surgeryId = "00000000-0000-4000-8000-000000000043";

describe("surgicalRiskDetectionCore", () => {
  it("returns no active risks when signals are healthy", () => {
    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      extractionVelocity: buildExtractionVelocity({
        surgeryId,
        patientLabel: "Jordan Patient",
        extractedGrafts: 500,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T09:00:00.000Z" }],
        graftEvents: [
          { occurredAt: "2026-07-01T09:20:00.000Z", deltaExtracted: 250 },
          { occurredAt: "2026-07-01T09:40:00.000Z", deltaExtracted: 250 },
        ],
        now: new Date("2026-07-01T10:00:00.000Z"),
      }),
      transectionMonitoring: buildTransectionMonitoring({
        surgeryId,
        patientLabel: "Jordan Patient",
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 99,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 1,
            note: "partial transection",
          },
        ],
      }),
    });

    assert.equal(snapshot.summary, "No active procedural risks detected.");
    assert.equal(snapshot.totalRisks, 0);
  });

  it("detects extraction slowing", () => {
    const extractionVelocity = buildExtractionVelocity({
      surgeryId,
      patientLabel: "Jordan Patient",
      extractedGrafts: 800,
      events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T08:00:00.000Z" }],
      graftEvents: [
        { occurredAt: "2026-07-01T08:20:00.000Z", deltaExtracted: 400 },
        { occurredAt: "2026-07-01T08:40:00.000Z", deltaExtracted: 200 },
        { occurredAt: "2026-07-01T09:40:00.000Z", deltaExtracted: 100 },
        { occurredAt: "2026-07-01T10:00:00.000Z", deltaExtracted: 100 },
      ],
      now: new Date("2026-07-01T10:30:00.000Z"),
    });

    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      extractionVelocity,
    });

    assert.ok(snapshot.detectedRisks.some((r) => /Extraction velocity dropped/i.test(r.title)));
  });

  it("detects high transection rate", () => {
    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      transectionMonitoring: buildTransectionMonitoring({
        surgeryId,
        patientLabel: "Jordan Patient",
        trayEvents: [
          {
            eventType: "tray_count",
            reviewStatus: "confirmed",
            singles: 90,
            doubles: 0,
            triples: 0,
            multiples: 0,
            deltaDiscarded: 10,
            note: "full transection",
          },
        ],
      }),
    });

    assert.ok(snapshot.detectedRisks.some((r) => /Transection rate above safe threshold/i.test(r.title)));
  });

  it("detects procedure delay from live timeline", () => {
    const liveTimeline = buildLiveProcedureTimeline({
      surgery: {
        surgeryId,
        patientLabel: "Jordan Patient",
        status: "in_progress",
        procedurePhase: "implantation",
        scheduledStartAt: "2026-07-01T08:00:00.000Z",
        scheduledEndAt: "2026-07-01T16:00:00.000Z",
        actualStartAt: "2026-07-01T08:15:00.000Z",
        actualEndAt: null,
      },
      events: [{ eventKind: "implantation_started", occurredAt: "2026-07-01T09:00:00.000Z" }],
      now: new Date("2026-07-01T16:42:00.000Z"),
    });

    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      liveTimeline,
    });

    assert.ok(snapshot.detectedRisks.some((r) => /Procedure running .* behind/i.test(r.title)));
  });

  it("detects inconsistent graft counts", () => {
    const graftIntelligence = buildGraftIntelligence({
      surgeryId,
      patientLabel: "Jordan Patient",
      targetGrafts: 3000,
      extractedGrafts: 1000,
      implantedGrafts: 1100,
      discardedGrafts: 0,
      remainingGrafts: -100,
      singles: 1000,
      doubles: 0,
      triples: 0,
      multiples: 0,
      totalHairs: 1000,
      averageHairsPerGraft: 1,
      reconciliationStatus: "mismatch",
      pendingTrayCount: 0,
    });

    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      graftIntelligence,
    });

    assert.ok(snapshot.detectedRisks.some((r) => r.title === "Graft count inconsistency"));
    assert.ok(snapshot.detectedRisks.every((r) => r.recommendation.length > 0));
  });

  it("generates recommendations for each detected risk", () => {
    const snapshot = buildSurgicalRiskDetection({
      surgeryId,
      patientLabel: "Jordan Patient",
      extractionVelocity: buildExtractionVelocity({
        surgeryId,
        patientLabel: "Jordan Patient",
        extractedGrafts: 800,
        events: [{ eventKind: "extraction_started", occurredAt: "2026-07-01T08:00:00.000Z" }],
        graftEvents: [
          { occurredAt: "2026-07-01T08:20:00.000Z", deltaExtracted: 400 },
          { occurredAt: "2026-07-01T08:40:00.000Z", deltaExtracted: 200 },
          { occurredAt: "2026-07-01T09:40:00.000Z", deltaExtracted: 100 },
          { occurredAt: "2026-07-01T10:00:00.000Z", deltaExtracted: 100 },
        ],
        now: new Date("2026-07-01T10:30:00.000Z"),
      }),
    });

    assert.ok(snapshot.detectedRisks.length > 0);
    assert.ok(snapshot.detectedRisks.every((r) => r.recommendation.trim().length > 0));
  });
});
