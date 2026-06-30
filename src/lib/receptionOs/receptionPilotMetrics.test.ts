import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RECEPTION_USAGE_EVENT_KINDS,
  sanitizeOperationalMetadata,
  sanitizeReceptionUsageEventContext,
} from "@/src/lib/receptionOs/receptionUsageEventModel";
import {
  assertReceptionPilotFeedbackTenantScope,
  RECEPTION_PILOT_FEEDBACK_KINDS,
  sanitizeReceptionPilotFeedbackContext,
} from "@/src/lib/receptionOs/receptionPilotFeedbackModel";
import {
  aggregateReceptionPilotMetrics,
  buildReceptionPilotManagerScores,
  receptionPilotManagerWidgetVisible,
} from "@/src/lib/receptionOs/receptionPilotMetricsModel";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PROFILE = "22222222-2222-4222-8222-222222222222";

describe("receptionUsageEventModel", () => {
  it("accepts all Phase 7 event kinds", () => {
    assert.equal(RECEPTION_USAGE_EVENT_KINDS.length, 9);
    assert.ok(RECEPTION_USAGE_EVENT_KINDS.includes("dashboard_viewed"));
    assert.ok(RECEPTION_USAGE_EVENT_KINDS.includes("refresh_failed"));
  });

  it("strips sensitive metadata keys", () => {
    const sanitized = sanitizeOperationalMetadata({
      action: "preview",
      smsBody: "secret message",
      patientName: "Alex",
      channel: "sms",
    });
    assert.equal(sanitized.action, "preview");
    assert.equal(sanitized.channel, "sms");
    assert.equal(sanitized.smsBody, undefined);
    assert.equal(sanitized.patientName, undefined);
  });

  it("sanitizes usage context fields", () => {
    const ctx = sanitizeReceptionUsageEventContext({
      operatingMode: "live_clinic",
      widgetKey: "action_alerts",
      sourceRefId: "alert-1",
      metadata: { templateKey: "deposit_reminder" },
    });
    assert.equal(ctx.operatingMode, "live_clinic");
    assert.equal(ctx.widgetKey, "action_alerts");
    assert.equal(ctx.sourceRefId, "alert-1");
  });
});

describe("receptionPilotFeedbackModel", () => {
  it("accepts all feedback kinds", () => {
    assert.equal(RECEPTION_PILOT_FEEDBACK_KINDS.length, 4);
    assert.ok(RECEPTION_PILOT_FEEDBACK_KINDS.includes("workflow_friction"));
  });

  it("truncates feedback notes", () => {
    const ctx = sanitizeReceptionPilotFeedbackContext({
      note: "x".repeat(600),
      widgetKey: "daily_brief",
    });
    assert.equal(ctx.note?.length, 500);
  });
});

describe("receptionPilotMetricsModel", () => {
  it("restricts pilot manager widget to admin and clinic_manager", () => {
    assert.equal(receptionPilotManagerWidgetVisible("admin"), true);
    assert.equal(receptionPilotManagerWidgetVisible("clinic_manager"), true);
    assert.equal(receptionPilotManagerWidgetVisible("receptionist"), false);
    assert.equal(receptionPilotManagerWidgetVisible("consultant"), false);
  });

  it("aggregates daily metrics from usage events and operational counts", () => {
    const summary = aggregateReceptionPilotMetrics({
      periodStart: "2026-06-19T00:00:00.000Z",
      periodEnd: "2026-06-20T00:00:00.000Z",
      usageEvents: [
        {
          eventKind: "dashboard_viewed",
          profileId: PROFILE,
          widgetKey: null,
          createdAt: "2026-06-19T09:00:00.000Z",
          metadata: {},
        },
        {
          eventKind: "widget_viewed",
          profileId: PROFILE,
          widgetKey: "action_alerts",
          createdAt: "2026-06-19T09:05:00.000Z",
          metadata: {},
        },
        {
          eventKind: "widget_viewed",
          profileId: PROFILE,
          widgetKey: "action_alerts",
          createdAt: "2026-06-19T10:00:00.000Z",
          metadata: {},
        },
      ],
      feedbackRows: [
        { feedbackKind: "wrong_alert", createdAt: "2026-06-19T11:00:00.000Z" },
        { feedbackKind: "useful", createdAt: "2026-06-19T11:05:00.000Z" },
      ],
      tasksCreatedInPeriod: 3,
      tasksResolvedInPeriod: 2,
      avgTaskResolutionMinutes: 45,
      unresolvedCriticalRisks: 1,
      communicationsDrafted: 1,
      communicationsSent: 0,
      communicationsDryRun: 2,
      closeoutsCompleted: 0,
    });

    assert.equal(summary.dailyActiveUsers, 1);
    assert.equal(summary.tasksCreated, 3);
    assert.equal(summary.tasksResolved, 2);
    assert.equal(summary.averageTaskResolutionMinutes, 45);
    assert.equal(summary.mostUsedWidgets[0]?.widgetKey, "action_alerts");
    assert.equal(summary.mostUsedWidgets[0]?.viewCount, 2);
    assert.equal(summary.topFeedbackIssues[0]?.feedbackKind, "wrong_alert");
    assert.equal(
      summary.topFeedbackIssues.some((i) => i.feedbackKind === "useful"),
      false
    );
  });

  it("builds manager scores from summary and feedback", () => {
    const summary = aggregateReceptionPilotMetrics({
      periodStart: "2026-06-19T00:00:00.000Z",
      periodEnd: "2026-06-20T00:00:00.000Z",
      usageEvents: [
        {
          eventKind: "dashboard_viewed",
          profileId: PROFILE,
          widgetKey: null,
          createdAt: "2026-06-19T09:00:00.000Z",
          metadata: {},
        },
      ],
      feedbackRows: [{ feedbackKind: "workflow_friction", createdAt: "2026-06-19T10:00:00.000Z" }],
      tasksCreatedInPeriod: 2,
      tasksResolvedInPeriod: 1,
      avgTaskResolutionMinutes: 30,
      unresolvedCriticalRisks: 2,
      communicationsDrafted: 0,
      communicationsSent: 0,
      communicationsDryRun: 1,
      closeoutsCompleted: 1,
    });

    const scores = buildReceptionPilotManagerScores(summary, [
      { feedbackKind: "workflow_friction" },
      { feedbackKind: "useful" },
    ]);

    assert.ok(scores.adoptionScore >= 0 && scores.adoptionScore <= 100);
    assert.ok(scores.workflowCompletionScore >= 0 && scores.workflowCompletionScore <= 100);
    assert.ok(scores.riskClosureScore >= 0 && scores.riskClosureScore <= 100);
    assert.equal(scores.feedbackCount, 2);
    assert.equal(scores.topFrictionPoints[0]?.label, "Workflow friction");
  });

  it("enforces tenant scope on feedback rows", () => {
    assert.throws(
      () => assertReceptionPilotFeedbackTenantScope(TENANT, "99999999-9999-4999-8999-999999999999"),
      /tenant scope violation/
    );
  });
});

describe("receptionUsageEvents safe failure mode", () => {
  it("wraps inserts in try/catch so tracking never throws", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/receptionOs/receptionUsageEvents.server.ts", "utf8");
    assert.match(src, /try \{/);
    assert.match(src, /catch/);
    assert.match(src, /trackReceptionUsageEventSafe/);
    assert.doesNotMatch(src, /throw new Error/);
  });
});

describe("Phase 1–7 regression guard", () => {
  it("keeps command centre loader additive for Phase 7 metrics", async () => {
    const { readFileSync } = await import("node:fs");
    const loader = readFileSync(
      "src/lib/receptionOs/receptionOsCommandCentreLoader.server.ts",
      "utf8"
    );
    assert.match(loader, /loadReceptionOsBoardPayload/);
    assert.match(loader, /loadReceptionPilotMetricsForCommandCentre/);
    assert.match(loader, /loadReceptionPhase8PayloadForCommandCentre/);
    assert.doesNotMatch(
      readFileSync("src/lib/receptionOs/receptionOsBoardLoader.server.ts", "utf8"),
      /fi_reception_usage_events/
    );
  });
});
