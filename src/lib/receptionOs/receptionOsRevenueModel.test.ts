import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ReceptionOsBoardPayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import {
  buildReceptionOsConversionScoreboard,
  buildReceptionOsLostRevenueAlerts,
  buildReceptionOsRevenueIntelligence,
  buildReceptionOsRevenueSubjects,
  conversionScoreboardVisibleForRole,
  detectReceptionOsFollowUpSlaBreaches,
  phase3WidgetsForRole,
  revenueIntelligenceAccessForRole,
  scoreReceptionOsRevenueSubject,
  type ReceptionOsRevenueSubjectSignals,
} from "@/src/lib/receptionOs/receptionOsRevenueModel";

function emptyBoard(overrides: Partial<ReceptionOsBoardPayload> = {}): ReceptionOsBoardPayload {
  return {
    tenantId: "11111111-1111-4111-8111-111111111111",
    tenantName: "Demo",
    loadedAt: "2026-06-19T10:00:00.000Z",
    operationalDay: {
      calendarTimezone: "Australia/Sydney",
      todayYmd: "2026-06-19",
      localStartIso: "2026-06-18T14:00:00.000Z",
      localEndIso: "2026-06-19T14:00:00.000Z",
    },
    viewer: { role: "clinic_manager", visibleWidgets: ["action_alerts"] },
    todaysPatients: [],
    communicationTimeline: [],
    consultationPipeline: {
      columns: {
        new_lead: [],
        consultation_booked: [],
        consultation_completed: [],
        quote_sent: [],
        deposit_pending: [],
        surgery_booked: [],
      },
      counts: {
        new_lead: 0,
        consultation_booked: 0,
        consultation_completed: 0,
        quote_sent: 0,
        deposit_pending: 0,
        surgery_booked: 0,
      },
    },
    outstandingDeposits: [],
    upcomingSurgeries: [],
    actionAlerts: [],
    intelligence: {
      policy: {
        canExportCompetencyData: false,
        canExportAuditData: false,
        canBuildProfessionalGraph: false,
        canSendToFiOs: false,
        requiresConsent: true,
        exportMode: "disabled",
      },
      hints: [],
      generatedAt: "2026-06-19T10:00:00.000Z",
    },
    ...overrides,
  } as ReceptionOsBoardPayload;
}

function subject(partial: Partial<ReceptionOsRevenueSubjectSignals>): ReceptionOsRevenueSubjectSignals {
  return {
    subjectId: "sub-1",
    label: "Alex Patient",
    pipelineColumn: "quote_sent",
    consultationCompleted: true,
    quoteSent: true,
    depositRequested: false,
    depositOverdue: false,
    upcomingSurgeryDate: null,
    surgeryPaymentComplete: false,
    communicationCount: 2,
    daysSinceLastCommunication: 1,
    leadStatus: "qualified",
    caseStatus: "linked",
    estimatedQuoteValue: 12_000,
    currency: "AUD",
    daysSinceConsultation: 2,
    hasPaymentLink: true,
    hrefs: {
      patient: "/fi-admin/t/patients/p1",
      case: null,
      lead: "/fi-admin/t/crm/leads/l1",
      consultation: "/fi-admin/t/consultations/c1",
    },
    ...partial,
  };
}

describe("receptionOsRevenueModel", () => {
  it("scores probability with confidence and weighted revenue", () => {
    const score = scoreReceptionOsRevenueSubject(subject({ pipelineColumn: "deposit_pending", depositRequested: true }));
    assert.ok(score.probabilityPercent >= 70);
    assert.ok(["low", "medium", "high"].includes(score.confidenceLevel));
    assert.equal(score.weightedRevenue, Math.round((12_000 * score.probabilityPercent) / 100));
    assert.ok(score.recommendedNextAction.length > 0);
  });

  it("reduces probability for overdue deposits and inactive leads", () => {
    const healthy = scoreReceptionOsRevenueSubject(subject({ depositOverdue: false, daysSinceLastCommunication: 1 }));
    const risky = scoreReceptionOsRevenueSubject(
      subject({ depositOverdue: true, daysSinceLastCommunication: 10 }),
    );
    assert.ok(risky.probabilityPercent < healthy.probabilityPercent);
    assert.ok(risky.riskFlags.includes("deposit_overdue"));
    assert.ok(risky.riskFlags.includes("lead_inactive"));
  });

  it("detects follow-up SLA breaches", () => {
    const breaches = detectReceptionOsFollowUpSlaBreaches([
      subject({ consultationCompleted: true, quoteSent: false, pipelineColumn: "consultation_completed" }),
      subject({ quoteSent: true, daysSinceLastCommunication: 3, pipelineColumn: "quote_sent" }),
      subject({ depositRequested: true, depositOverdue: true, pipelineColumn: "deposit_pending" }),
      subject({
        upcomingSurgeryDate: "2026-06-25",
        surgeryPaymentComplete: false,
        pipelineColumn: "surgery_booked",
      }),
      subject({ daysSinceLastCommunication: 8, pipelineColumn: "new_lead" }),
    ]);

    const kinds = breaches.map((b) => b.kind);
    assert.ok(kinds.includes("consultation_no_quote"));
    assert.ok(kinds.includes("quote_followup_sla_breach"));
    assert.ok(kinds.includes("deposit_overdue"));
    assert.ok(kinds.includes("surgery_booking_at_risk"));
    assert.ok(kinds.includes("patient_gone_cold"));
  });

  it("creates lost revenue alerts for high-value quotes and missing payment links", () => {
    const subjects = [
      subject({
        subjectId: "hv-1",
        estimatedQuoteValue: 15_000,
        quoteSent: true,
        daysSinceLastCommunication: 3,
        hasPaymentLink: true,
      }),
      subject({
        subjectId: "link-1",
        depositRequested: true,
        hasPaymentLink: false,
        pipelineColumn: "deposit_pending",
      }),
    ];
    const scores = subjects.map(scoreReceptionOsRevenueSubject);
    const alerts = buildReceptionOsLostRevenueAlerts({ subjects, scores, highValueQuoteThreshold: 10_000 });
    assert.ok(alerts.some((a) => a.kind === "high_value_quote_no_followup"));
    assert.ok(alerts.some((a) => a.kind === "missing_finance_payment_link"));
  });

  it("builds conversion scoreboard with projected and at-risk revenue", () => {
    const board = emptyBoard({
      consultationPipeline: {
        columns: {
          new_lead: [],
          consultation_booked: [],
          consultation_completed: [],
          quote_sent: [],
          deposit_pending: [],
          surgery_booked: [],
        },
        counts: {
          new_lead: 0,
          consultation_booked: 0,
          consultation_completed: 2,
          quote_sent: 1,
          deposit_pending: 0,
          surgery_booked: 0,
        },
      },
    });
    const subjects = [subject({ estimatedQuoteValue: 10_000 }), subject({ subjectId: "sub-2", estimatedQuoteValue: 8_000 })];
    const scores = subjects.map(scoreReceptionOsRevenueSubject);
    const revenueRiskAlerts = buildReceptionOsLostRevenueAlerts({ subjects, scores });
    const scoreboard = buildReceptionOsConversionScoreboard({
      board,
      scores,
      revenueRiskAlerts,
      depositsCollectedToday: 2,
      surgeryBookingsCreatedToday: 1,
    });

    assert.equal(scoreboard.depositsCollectedToday, 2);
    assert.equal(scoreboard.surgeryBookingsCreatedToday, 1);
    assert.ok(scoreboard.projectedWeightedRevenue > 0);
    assert.ok(scoreboard.atRiskRevenue >= 0);
  });

  it("builds subjects from board pipeline and communication timeline", () => {
    const board = emptyBoard({
      communicationTimeline: [
        {
          id: "comm-1",
          kind: "sms",
          direction: "outbound",
          subject: null,
          preview: "Follow up",
          patientOrLeadLabel: "Alex",
          contactAt: "2026-06-18T10:00:00.000Z",
          hrefs: { patient: null, case: null, lead: "/fi-admin/t/crm/leads/l1" },
        },
      ],
      consultationPipeline: {
        columns: {
          new_lead: [],
          consultation_booked: [],
          consultation_completed: [],
          quote_sent: [
            {
              id: "consult:c1",
              patientOrLeadLabel: "Alex Patient",
              column: "quote_sent",
              detailLine: "Send deposit link",
              hrefs: {
                lead: "/fi-admin/t/crm/leads/l1",
                patient: null,
                consultation: "/fi-admin/t/consultations/c1",
                case: null,
              },
            },
          ],
          deposit_pending: [],
          surgery_booked: [],
        },
        counts: {
          new_lead: 0,
          consultation_booked: 0,
          consultation_completed: 0,
          quote_sent: 1,
          deposit_pending: 0,
          surgery_booked: 0,
        },
      },
    });

    const subjects = buildReceptionOsRevenueSubjects({ board });
    assert.equal(subjects.length, 1);
    assert.equal(subjects[0]?.communicationCount, 1);
    assert.equal(subjects[0]?.quoteSent, true);
  });

  it("composes full revenue intelligence payload", () => {
    const payload = buildReceptionOsRevenueIntelligence({
      board: emptyBoard(),
      depositsCollectedToday: 1,
    });
    assert.ok(payload.revenueSummary);
    assert.ok(payload.conversionScoreboard);
    assert.ok(Array.isArray(payload.revenueRiskAlerts));
  });

  it("gates widget visibility by role", () => {
    assert.equal(revenueIntelligenceAccessForRole("clinic_manager"), "full");
    assert.equal(revenueIntelligenceAccessForRole("admin"), "full");
    assert.equal(revenueIntelligenceAccessForRole("consultant"), "summary");
    assert.equal(revenueIntelligenceAccessForRole("receptionist"), "none");

    assert.equal(conversionScoreboardVisibleForRole("consultant"), true);
    assert.equal(conversionScoreboardVisibleForRole("receptionist"), false);

    assert.deepEqual(phase3WidgetsForRole("admin"), ["revenue_intelligence", "conversion_scoreboard"]);
    assert.deepEqual(phase3WidgetsForRole("consultant"), ["conversion_scoreboard"]);
    assert.deepEqual(phase3WidgetsForRole("receptionist"), []);
  });
});
