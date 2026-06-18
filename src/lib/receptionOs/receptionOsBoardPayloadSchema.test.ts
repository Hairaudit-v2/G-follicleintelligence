import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import {
  parseReceptionOsBoardPayload,
  parseReceptionOsCommandCentrePayload,
  receptionOsApiResponseSchema,
  receptionOsBoardPayloadSchema,
  receptionOsCommandCentrePayloadSchema,
} from "@/src/lib/receptionOs/receptionOsBoardPayloadSchema";

const samplePayload = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  tenantName: "Demo Clinic",
  loadedAt: "2026-06-19T10:00:00.000Z",
  operationalDay: {
    calendarTimezone: "Australia/Sydney",
    todayYmd: "2026-06-19",
    localStartIso: "2026-06-18T14:00:00.000Z",
    localEndIso: "2026-06-19T14:00:00.000Z",
  },
  viewer: {
    role: "receptionist",
    visibleWidgets: ["todays_patients", "communication_timeline", "action_alerts", "upcoming_surgery"],
  },
  todaysPatients: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      patientName: "Alex Patient",
      appointmentType: "Consultation",
      appointmentTime: "09:30",
      status: "confirmed",
      statusLabel: "Confirmed",
      clinician: "Dr Smith",
      hrefs: {
        patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
        case: null,
        lead: null,
        appointment: "/fi-admin/11111111-1111-4111-8111-111111111111/appointments?bookingId=22222222-2222-4222-8222-222222222222",
      },
    },
  ],
  communicationTimeline: [
    {
      id: "33333333-3333-4333-8333-333333333333",
      kind: "sms",
      direction: "outbound",
      subject: null,
      preview: "See you today",
      patientOrLeadLabel: "Alex Patient",
      contactAt: "2026-06-19T08:00:00.000Z",
      hrefs: { patient: null, case: null, lead: "/fi-admin/11111111-1111-4111-8111-111111111111/crm/leads/l1" },
    },
  ],
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
  outstandingDeposits: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      patientLabel: "Alex Patient",
      context: "consultation",
      amountExpected: 500,
      amountPaid: 0,
      currency: "AUD",
      dueDate: "2026-06-01",
      isOverdue: true,
      statusLabel: "Overdue",
      severity: "critical",
      hrefs: { patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1", case: null, lead: null },
    },
  ],
  upcomingSurgeries: [
    {
      bookingId: "55555555-5555-4555-8555-555555555555",
      patientLabel: "Alex Patient",
      surgeryDate: "2026-06-25",
      surgeryTime: "08:00",
      daysUntil: 6,
      staffAssigned: "Dr Smith",
      paymentComplete: false,
      consentComplete: true,
      readinessStatus: "Needs attention",
      readinessPercent: 70,
      severity: "warning",
      hrefs: {
        case: "/fi-admin/11111111-1111-4111-8111-111111111111/cases/c1",
        patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
        calendar: "/fi-admin/11111111-1111-4111-8111-111111111111/calendar",
      },
    },
  ],
  actionAlerts: [
    {
      id: "alert-1",
      kind: "missing_deposit",
      title: "Overdue deposit",
      detail: "Alex Patient · AUD 500 due",
      severity: "critical",
      href: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
      hrefs: {
        patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
        case: null,
        lead: null,
        consultation: null,
      },
    },
  ],
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
  dailyBrief: {
    todayPatientCount: 1,
    outstandingDepositCount: 1,
    overdueDepositCount: 1,
    surgeryNext14Count: 1,
    surgeryRiskCount: 1,
    followUpNeededCount: 0,
    openTaskCount: 0,
    alertsBySeverity: { info: 0, warning: 0, critical: 1, blocked: 0 },
    projectedOperationalRisk: "critical",
    summaryLines: ["1 patient scheduled today"],
  },
  receptionTasks: [],
  suggestedOperatingMode: "live_clinic",
  revenueSummary: {
    totalWeightedRevenue: 4500,
    totalAtRiskRevenue: 12000,
    currency: "AUD",
    scoredSubjectCount: 2,
    averageProbabilityPercent: 42,
    topOpportunities: [
      {
        subjectId: "consult:c1",
        label: "Alex Patient",
        probabilityPercent: 58,
        confidenceLevel: "medium",
        weightedRevenue: 6960,
        currency: "AUD",
        riskFlags: ["quote_followup_gap"],
        recommendedNextAction: "Follow up on sent quote — no contact in 48+ hours.",
        hrefs: {
          patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
          case: null,
          lead: null,
          consultation: null,
        },
      },
    ],
  },
  conversionScoreboard: {
    consultsCompletedToday: 1,
    quotesSentToday: 0,
    depositsCollectedToday: 0,
    surgeryBookingsCreatedToday: 0,
    projectedWeightedRevenue: 4500,
    atRiskRevenue: 12000,
    currency: "AUD",
  },
  revenueRiskAlerts: [
    {
      id: "sla-deposit-overdue-dep-1",
      kind: "deposit_overdue",
      title: "Deposit overdue",
      detail: "Alex Patient · deposit past due date",
      severity: "critical",
      estimatedRevenueAtRisk: 500,
      currency: "AUD",
      href: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
      hrefs: {
        patient: "/fi-admin/11111111-1111-4111-8111-111111111111/patients/p1",
        case: null,
        lead: null,
        consultation: null,
      },
      recommendedAction: "Collect deposit or reschedule commitment.",
    },
  ],
  endOfDayCloseout: {
    operatingDate: "2026-06-19",
    riskSummary: "1 critical and 0 failed communications flagged for closeout.",
    itemCounts: {
      info: 0,
      warning: 0,
      critical: 1,
      blocked: 0,
      total: 1,
      failed_communications: 0,
    },
    checklist: [],
    failedCommunications: [],
    canCloseDay: false,
    existingCloseoutId: null,
    existingCloseoutNotes: null,
    closedAt: null,
  },
  systemStatus: {
    dryRunEnabled: true,
    emailSendEnabled: false,
    smsSendEnabled: false,
    providerMode: "dry_run",
    resendConfigured: false,
    twilioConfigured: false,
    pilotModeActive: true,
    pilotBanner: {
      variant: "warning",
      title: "ReceptionOS clinic pilot — no external messages will be sent",
      message: "Pilot mode active.",
    },
    lastPayloadLoadedAt: "2026-06-19T10:00:00.000Z",
    failedSendsToday: 0,
    closeoutStatus: "open",
    closeoutOperatingDate: "2026-06-19",
    envChecklist: [],
  },
  pilotMetrics: {
    visible: false,
    summary: null,
    managerScores: null,
  },
  pilotReview: {
    visible: false,
    periodDays: 14,
    report: null,
  },
  ownerValue: {
    visible: false,
    dashboard: null,
  },
  demoMode: {
    active: false,
    maskAmounts: false,
    usingSampleData: false,
    canToggle: false,
  },
  moduleHealth: {
    coreBoardLoaded: true,
    unavailableModules: [],
  },
} as const;

describe("receptionOsBoardPayloadSchema", () => {
  it("parses a valid API payload shape", () => {
    const parsed = parseReceptionOsCommandCentrePayload(samplePayload);
    assert.equal(parsed.tenantId, samplePayload.tenantId);
    assert.equal(parsed.viewer.role, "receptionist");
    assert.equal(parsed.outstandingDeposits[0]?.severity, "critical");
    assert.equal(parsed.upcomingSurgeries[0]?.severity, "warning");
    assert.equal(parsed.dailyBrief.todayPatientCount, 1);
    assert.equal(parsed.suggestedOperatingMode, "live_clinic");
    assert.equal(parsed.revenueSummary.scoredSubjectCount, 2);
    assert.equal(parsed.conversionScoreboard.consultsCompletedToday, 1);
    assert.equal(parsed.revenueRiskAlerts[0]?.kind, "deposit_overdue");
  });

  it("parses V1 board subset without phase 2/3 fields via board schema", () => {
    const {
      dailyBrief: _d,
      receptionTasks: _t,
      suggestedOperatingMode: _m,
      revenueSummary: _r,
      conversionScoreboard: _c,
      revenueRiskAlerts: _a,
      endOfDayCloseout: _e,
      systemStatus: _s,
      pilotMetrics: _p,
      pilotReview: _pr,
      ownerValue: _ov,
      demoMode: _dm,
      moduleHealth: _mh,
      ...v1
    } = samplePayload;
    const parsed = parseReceptionOsBoardPayload(v1);
    assert.equal(parsed.tenantId, samplePayload.tenantId);
  });

  it("validates API envelope", () => {
    const envelope = receptionOsApiResponseSchema.parse({ data: samplePayload });
    assert.ok(receptionOsCommandCentrePayloadSchema.safeParse(envelope.data).success);
  });

  it("rejects invalid severity values", () => {
    const bad = {
      ...samplePayload,
      actionAlerts: [{ ...samplePayload.actionAlerts[0], severity: "high" }],
    };
    assert.equal(receptionOsBoardPayloadSchema.safeParse(bad).success, false);
  });
});

describe("reception board regression guard", () => {
  it("keeps legacy /reception board on tenant operational dashboard loader", () => {
    const receptionPage = readFileSync("app/(fi-admin)/fi-admin/[tenantId]/reception/page.tsx", "utf8");
    assert.match(receptionPage, /loadTenantOperationalDashboard/);
    assert.match(receptionPage, /ReceptionBoardClient/);
    assert.doesNotMatch(receptionPage, /loadReceptionOsBoardPayload/);
    assert.doesNotMatch(receptionPage, /ReceptionOsDashboard/);
  });

  it("routes ReceptionOS command centre separately from kanban reception board", () => {
    const receptionOsPage = readFileSync("app/(fi-admin)/fi-admin/[tenantId]/reception-os/page.tsx", "utf8");
    assert.match(receptionOsPage, /loadReceptionOsCommandCentrePayload/);
    assert.match(receptionOsPage, /ReceptionOsDashboard/);
    assert.doesNotMatch(receptionOsPage, /ReceptionBoardClient/);
    assert.doesNotMatch(receptionOsPage, /loadTenantOperationalDashboard/);
  });

  it("keeps V1 board loader isolated from command centre wrapper", () => {
    const loader = readFileSync("src/lib/receptionOs/receptionOsBoardLoader.server.ts", "utf8");
    assert.doesNotMatch(loader, /fi_reception_tasks/);
    assert.doesNotMatch(loader, /receptionOsRevenueModel/);
    const wrapper = readFileSync("src/lib/receptionOs/receptionOsCommandCentreLoader.server.ts", "utf8");
    assert.match(wrapper, /loadReceptionOsBoardPayload/);
    assert.match(wrapper, /loadOpenReceptionTasksForTenant/);
    assert.match(wrapper, /buildReceptionOsRevenueIntelligence/);
  });
});
