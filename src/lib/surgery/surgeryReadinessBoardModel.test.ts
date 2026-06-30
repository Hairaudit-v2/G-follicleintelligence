import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateSurgeryReadinessKpis,
  buildSurgeryReadinessIssues,
  calendarDaysUntilSurgery,
  cardMatchesManagerFilter,
  computeSurgeryReadinessBoardWindow,
  escalateSurgeryReadinessIssues,
  hasConsultationConsentSignal,
  maxSurgeryReadinessIssueSeverity,
  pickSurgeryReadinessPrimaryColumn,
} from "@/src/lib/surgery/surgeryReadinessBoardModel";

const surgeryDepositSatisfied = {
  status: "paid" as const,
  due_date: null as string | null,
  amount_expected: 1,
  amount_paid: 1,
};
const TODAY_YMD = "2026-06-10";

test("computeSurgeryReadinessBoardWindow: 14 inclusive days in Australia/Sydney", () => {
  const now = new Date("2026-06-10T14:00:00.000Z");
  const w = computeSurgeryReadinessBoardWindow(now, "Australia/Sydney");
  assert.equal(w.todayYmd, "2026-06-11");
  assert.equal(w.windowEndYmd, "2026-06-24");
  assert.ok(Date.parse(w.rangeStartIso) < Date.parse(w.rangeEndIso));
});

test("computeSurgeryReadinessBoardWindow: inclusive span is 14 calendar days in UTC", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const w = computeSurgeryReadinessBoardWindow(now, "UTC");
  assert.equal(w.todayYmd, "2026-06-10");
  assert.equal(w.windowEndYmd, "2026-06-23");
});

test("pickSurgeryReadinessPrimaryColumn: missing case_id → on_hold_not_linked", () => {
  const issues = buildSurgeryReadinessIssues({
    caseId: null,
    patientIdForPathology: null,
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: null,
    todayYmd: TODAY_YMD,
  });
  assert.equal(
    pickSurgeryReadinessPrimaryColumn({ issues, readinessBucket: "ready" }),
    "on_hold_not_linked"
  );
});

test("pickSurgeryReadinessPrimaryColumn: missing pathology before consent", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: false,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: false,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  const issues = escalateSurgeryReadinessIssues(raw, 10, "confirmed");
  assert.equal(
    pickSurgeryReadinessPrimaryColumn({ issues, readinessBucket: "needs_attention" }),
    "missing_pathology"
  );
});

test("pickSurgeryReadinessPrimaryColumn: missing consent when pathology satisfied", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: false,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  const issues = escalateSurgeryReadinessIssues(raw, 10, "confirmed");
  assert.equal(
    pickSurgeryReadinessPrimaryColumn({ issues, readinessBucket: "ready" }),
    "missing_consent"
  );
});

test("calendarDaysUntilSurgery: whole-day delta in tenant zone", () => {
  const tz = "UTC";
  assert.equal(calendarDaysUntilSurgery(tz, "2026-06-10", "2026-06-10T10:00:00.000Z"), 0);
  assert.equal(calendarDaysUntilSurgery(tz, "2026-06-10", "2026-06-12T08:00:00.000Z"), 2);
});

test("hasConsultationConsentSignal: accepted / converted statuses", () => {
  assert.equal(hasConsultationConsentSignal([{ status: "draft", quote_data: {} }]), false);
  assert.equal(hasConsultationConsentSignal([{ status: "accepted", quote_data: {} }]), true);
  assert.equal(
    hasConsultationConsentSignal([
      { status: "completed", quote_data: { quote_status: "Accepted by patient" } },
    ]),
    true
  );
});

test("V1.1: abnormal pathology is always high_risk severity", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 2,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  const abnormal = raw.find((i) => i.kind === "abnormal_pathology");
  assert.equal(abnormal?.severity, "high_risk");
  const escalated = escalateSurgeryReadinessIssues(raw, 30, "confirmed");
  assert.equal(escalated.find((i) => i.kind === "abnormal_pathology")?.severity, "high_risk");
  assert.equal(maxSurgeryReadinessIssueSeverity(escalated), "high_risk");
});

test("V1.1: missing pathology within 7 days escalates to high_risk", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: false,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  const at8 = escalateSurgeryReadinessIssues(raw, 8, "confirmed");
  assert.equal(at8.find((i) => i.kind === "missing_pathology")?.severity, "warning");
  const at7 = escalateSurgeryReadinessIssues(raw, 7, "confirmed");
  assert.equal(at7.find((i) => i.kind === "missing_pathology")?.severity, "high_risk");
});

test("V1.1: missing consent proxy within 7 days escalates to high_risk", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: false,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  assert.equal(
    escalateSurgeryReadinessIssues(raw, 8, "confirmed").find(
      (i) => i.kind === "missing_consent_proxy"
    )?.severity,
    "warning"
  );
  assert.equal(
    escalateSurgeryReadinessIssues(raw, 7, "confirmed").find(
      (i) => i.kind === "missing_consent_proxy"
    )?.severity,
    "high_risk"
  );
});

test("V1.1: unconfirmed surgery (scheduled) within 3 days escalates booking_unconfirmed to high_risk", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "scheduled",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: surgeryDepositSatisfied,
    todayYmd: TODAY_YMD,
  });
  assert.equal(
    escalateSurgeryReadinessIssues(raw, 4, "scheduled").find(
      (i) => i.kind === "booking_unconfirmed"
    )?.severity,
    "warning"
  );
  assert.equal(
    escalateSurgeryReadinessIssues(raw, 3, "scheduled").find(
      (i) => i.kind === "booking_unconfirmed"
    )?.severity,
    "high_risk"
  );
});

test("V1.1: missing case link matches Not Linked manager filter", () => {
  const issues = buildSurgeryReadinessIssues({
    caseId: null,
    patientIdForPathology: null,
    hasPathologyResult: false,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: false,
    hasSurgeryPlanRow: false,
    surgeryPlanningComplete: false,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: null,
    todayYmd: TODAY_YMD,
  });
  const primary = pickSurgeryReadinessPrimaryColumn({ issues, readinessBucket: null });
  assert.equal(primary, "on_hold_not_linked");
  assert.equal(cardMatchesManagerFilter(issues, primary, "not_linked"), true);
  assert.equal(cardMatchesManagerFilter(issues, primary, "missing_pathology"), false);
});

test("V1.1: no manual payment tracking row stays info and does not force high_risk", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: null,
    todayYmd: TODAY_YMD,
  });
  const pay = raw.find((i) => i.kind === "no_payment_tracking");
  assert.equal(pay?.severity, "info");
  const escalated = escalateSurgeryReadinessIssues(raw, 0, "confirmed");
  assert.equal(escalated.find((i) => i.kind === "no_payment_tracking")?.severity, "info");
  assert.equal(maxSurgeryReadinessIssueSeverity(escalated), "info");
  assert.equal(cardMatchesManagerFilter(escalated, "ready", "high_risk"), false);
});

test("pending tracked surgery deposit adds surgery_deposit_pending (not no_payment_tracking)", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: {
      status: "pending",
      due_date: "2026-06-20",
      amount_expected: 500,
      amount_paid: 0,
    },
    todayYmd: TODAY_YMD,
  });
  assert.ok(raw.some((i) => i.kind === "surgery_deposit_pending"));
  assert.equal(
    raw.some((i) => i.kind === "no_payment_tracking"),
    false
  );
});

test("paid tracked surgery deposit clears deposit collection issues", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: {
      status: "paid",
      due_date: null,
      amount_expected: 100,
      amount_paid: 100,
    },
    todayYmd: TODAY_YMD,
  });
  assert.equal(
    raw.some((i) => i.kind === "surgery_deposit_pending"),
    false
  );
  assert.equal(
    raw.some((i) => i.kind === "no_payment_tracking"),
    false
  );
});

test("surgery_deposit_pending escalates to high_risk within 7 days of surgery", () => {
  const raw = buildSurgeryReadinessIssues({
    caseId: "c1",
    patientIdForPathology: "p1",
    hasPathologyResult: true,
    abnormalPathologyMarkerCount: 0,
    hasConsentProxy: true,
    hasSurgeryPlanRow: true,
    surgeryPlanningComplete: true,
    bookingStatus: "confirmed",
    surgeryPlanPlanningStatus: null,
    surgeryPaymentRecord: {
      status: "pending",
      due_date: "2026-06-20",
      amount_expected: 500,
      amount_paid: 0,
    },
    todayYmd: TODAY_YMD,
  });
  const at8 = escalateSurgeryReadinessIssues(raw, 8, "confirmed");
  assert.equal(at8.find((i) => i.kind === "surgery_deposit_pending")?.severity, "warning");
  const at6 = escalateSurgeryReadinessIssues(raw, 6, "confirmed");
  assert.equal(at6.find((i) => i.kind === "surgery_deposit_pending")?.severity, "high_risk");
});

test("aggregateSurgeryReadinessKpis: includes manual deposit counters", () => {
  const kpis = aggregateSurgeryReadinessKpis(
    {
      ready: [{}],
      needs_attention: [{}, {}],
      high_risk: [],
      missing_pathology: [{}],
      missing_consent: [],
      on_hold_not_linked: [],
    },
    { tracked: 3, pending: 1 }
  );
  assert.equal(kpis.upcomingNext14Days, 4);
  assert.equal(kpis.surgeryPaymentRecordsTracked, 3);
  assert.equal(kpis.surgeryDepositsPending, 1);
});
