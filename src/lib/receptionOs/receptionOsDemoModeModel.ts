/**
 * ReceptionOS Phase 8 — demo mode anonymisation and sample data (pure).
 */

import type { ReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsBoardModel.types";
import type { ReceptionOsPilotBanner } from "@/src/lib/receptionOs/receptionOsPilotStatusModel";

export type ReceptionOsDemoModeState = {
  active: boolean;
  maskAmounts: boolean;
  usingSampleData: boolean;
  canToggle: boolean;
};

const DEMO_PATIENT_NAMES = [
  "Alex Morgan",
  "Jordan Lee",
  "Sam Taylor",
  "Casey Wright",
  "Riley Chen",
  "Morgan Patel",
] as const;

const EMAIL_PATTERN = /[\w.+-]+@[\w.-]+\.\w+/g;
const PHONE_PATTERN = /(\+?\d[\d\s().-]{7,}\d)/g;

export function envTruthy(value: string | undefined): boolean {
  if (!value) return false;
  const v = value.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

export function resolveReceptionOsDemoModeFromEnv(): { envActive: boolean; maskAmounts: boolean } {
  return {
    envActive: envTruthy(process.env.RECEPTION_OS_DEMO_MODE),
    maskAmounts: envTruthy(process.env.RECEPTION_OS_DEMO_MASK_AMOUNTS),
  };
}

export function resolveReceptionOsDemoModeState(input: {
  envActive: boolean;
  maskAmounts: boolean;
  demoRequested: boolean;
  canToggle: boolean;
}): ReceptionOsDemoModeState {
  const active = input.envActive || (input.canToggle && input.demoRequested);
  return {
    active,
    maskAmounts: active && (input.maskAmounts || input.envActive),
    usingSampleData: false,
    canToggle: input.canToggle,
  };
}

export function buildReceptionOsDemoBanner(
  state: Pick<ReceptionOsDemoModeState, "maskAmounts" | "usingSampleData">
): ReceptionOsPilotBanner {
  const amountNote = state.maskAmounts ? " Dollar amounts are masked." : "";
  const sampleNote = state.usingSampleData ? " Showing sample records — no live clinic data." : "";
  return {
    variant: "info",
    title: "Demo Mode",
    message: `Patient names are anonymised and contact details are hidden for external demonstrations.${amountNote}${sampleNote} Live sends remain disabled by default.`,
  };
}

export function anonymizeDisplayLabel(label: string, index: number): string {
  const trimmed = label.trim();
  if (!trimmed) return DEMO_PATIENT_NAMES[index % DEMO_PATIENT_NAMES.length] ?? "Demo Patient";
  if (/^lead\b/i.test(trimmed) || /^patient\b/i.test(trimmed)) {
    return DEMO_PATIENT_NAMES[index % DEMO_PATIENT_NAMES.length] ?? "Demo Patient";
  }
  return DEMO_PATIENT_NAMES[index % DEMO_PATIENT_NAMES.length] ?? "Demo Patient";
}

export function redactContactText(text: string | null | undefined): string | null {
  if (text == null) return null;
  let out = text.replace(EMAIL_PATTERN, "[email hidden]");
  out = out.replace(PHONE_PATTERN, "[phone hidden]");
  return out;
}

export function maskCurrencyAmount(amount: number, maskAmounts: boolean): number {
  if (!maskAmounts) return amount;
  if (amount <= 0) return 0;
  if (amount < 500) return 500;
  if (amount < 2000) return 2000;
  if (amount < 5000) return 5000;
  if (amount < 10000) return 10000;
  return 15000;
}

function boardHasOperationalData(payload: ReceptionOsCommandCentrePayload): boolean {
  return (
    payload.todaysPatients.length > 0 ||
    payload.communicationTimeline.length > 0 ||
    payload.outstandingDeposits.length > 0 ||
    payload.upcomingSurgeries.length > 0 ||
    payload.actionAlerts.length > 0 ||
    payload.receptionTasks.length > 0
  );
}

export function buildReceptionOsDemoSamplePayload(
  payload: ReceptionOsCommandCentrePayload
): ReceptionOsCommandCentrePayload {
  const tenantId = payload.tenantId;
  const base = `/fi-admin/${tenantId}`;
  const today = payload.operationalDay.todayYmd;

  return {
    ...payload,
    todaysPatients: [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
        patientName: "Alex Morgan",
        appointmentType: "Hair transplant consultation",
        appointmentTime: "09:30",
        status: "confirmed",
        statusLabel: "Confirmed",
        clinician: "Dr Smith",
        hrefs: {
          patient: null,
          case: null,
          lead: null,
          appointment: `${base}/calendar`,
        },
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
        patientName: "Jordan Lee",
        appointmentType: "Pre-op review",
        appointmentTime: "11:00",
        status: "checked_in",
        statusLabel: "Checked in",
        clinician: "Dr Jones",
        hrefs: {
          patient: null,
          case: null,
          lead: null,
          appointment: `${base}/calendar`,
        },
      },
    ],
    communicationTimeline: [
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
        kind: "sms",
        direction: "outbound",
        subject: null,
        preview: "Appointment reminder sent (demo)",
        patientOrLeadLabel: "Alex Morgan",
        contactAt: `${today}T08:15:00.000Z`,
        hrefs: { patient: null, case: null, lead: null },
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2",
        kind: "email",
        direction: "outbound",
        subject: "Deposit reminder",
        preview: "Friendly deposit follow-up (demo)",
        patientOrLeadLabel: "Jordan Lee",
        contactAt: `${today}T07:45:00.000Z`,
        hrefs: { patient: null, case: null, lead: null },
      },
    ],
    outstandingDeposits: [
      {
        id: "cccccccc-cccc-4ccc-8ccc-ccccccccccc1",
        patientLabel: "Sam Taylor",
        context: "FUE procedure deposit",
        amountExpected: 2500,
        amountPaid: 0,
        currency: payload.revenueSummary.currency,
        dueDate: today,
        isOverdue: true,
        statusLabel: "Overdue",
        severity: "critical",
        paymentLink: null,
        hrefs: { patient: null, case: null, lead: null },
      },
    ],
    upcomingSurgeries: [
      {
        bookingId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        patientLabel: "Casey Wright",
        surgeryDate: today,
        surgeryTime: "14:00",
        daysUntil: 3,
        staffAssigned: "Theatre team A",
        paymentComplete: true,
        consentComplete: false,
        readinessStatus: "Pre-op forms pending",
        readinessPercent: 72,
        severity: "warning",
        hrefs: { case: null, patient: null, calendar: `${base}/calendar` },
      },
    ],
    actionAlerts: [
      {
        id: "demo-alert-deposit",
        kind: "missing_deposit",
        title: "Outstanding deposit — Sam Taylor",
        detail: "Deposit overdue before surgery booking (demo record).",
        severity: "critical",
        href: null,
        hrefs: { patient: null, case: null, lead: null, consultation: null },
      },
    ],
    receptionTasks: [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1",
        title: "Chase deposit — Sam Taylor",
        description: "Follow up on overdue deposit before surgery date.",
        sourceType: "system",
        severity: "critical",
        status: "open",
        ownerFiUserId: null,
        dueAt: null,
        patientId: null,
        caseId: null,
        leadId: null,
        bookingId: null,
        paymentId: null,
        consultationId: null,
        sourceAlertKind: "missing_deposit",
        sourceRefId: "demo-alert-deposit",
        resolutionNotes: null,
        internalNotes: null,
        snoozedUntil: null,
        createdAt: payload.loadedAt,
        updatedAt: payload.loadedAt,
      },
    ],
    dailyBrief: {
      ...payload.dailyBrief,
      todayPatientCount: 2,
      outstandingDepositCount: 1,
      overdueDepositCount: 1,
      surgeryNext14Count: 1,
      surgeryRiskCount: 1,
      followUpNeededCount: 1,
      openTaskCount: 1,
      projectedOperationalRisk: "warning",
      summaryLines: [
        "2 patients scheduled today (demo).",
        "1 overdue deposit needs follow-up.",
        "1 surgery readiness item open.",
      ],
    },
  };
}

export function applyReceptionOsDemoMode(
  payload: ReceptionOsCommandCentrePayload,
  state: ReceptionOsDemoModeState
): ReceptionOsCommandCentrePayload {
  if (!state.active) return payload;

  let working = payload;
  let usingSampleData = false;

  if (!boardHasOperationalData(payload)) {
    working = buildReceptionOsDemoSamplePayload(payload);
    usingSampleData = true;
  }

  let nameIndex = 0;
  const nextName = () => anonymizeDisplayLabel("", nameIndex++);

  const maskAmt = (n: number) => maskCurrencyAmount(n, state.maskAmounts);

  const todaysPatients = working.todaysPatients.map((p) => ({
    ...p,
    patientName: nextName(),
    hrefs: { ...p.hrefs, patient: null, case: null, lead: null },
  }));

  const communicationTimeline = working.communicationTimeline.map((ev) => ({
    ...ev,
    patientOrLeadLabel: nextName(),
    preview: redactContactText(ev.preview),
    subject: redactContactText(ev.subject),
    hrefs: { patient: null, case: null, lead: null },
  }));

  const outstandingDeposits = working.outstandingDeposits.map((d) => ({
    ...d,
    patientLabel: nextName(),
    amountExpected: maskAmt(d.amountExpected),
    amountPaid: maskAmt(d.amountPaid),
    paymentLink: null,
    hrefs: { patient: null, case: null, lead: null },
  }));

  const upcomingSurgeries = working.upcomingSurgeries.map((s) => ({
    ...s,
    patientLabel: nextName(),
    hrefs: { ...s.hrefs, patient: null, case: null },
  }));

  const consultationPipeline = {
    columns: Object.fromEntries(
      Object.entries(working.consultationPipeline.columns).map(([col, cards]) => [
        col,
        cards.map((card) => ({
          ...card,
          patientOrLeadLabel: nextName(),
          hrefs: { lead: null, patient: null, consultation: null, case: null },
        })),
      ])
    ) as ReceptionOsCommandCentrePayload["consultationPipeline"]["columns"],
    counts: working.consultationPipeline.counts,
  };

  const actionAlerts = working.actionAlerts.map((a) => ({
    ...a,
    title: redactContactText(a.title) ?? a.title,
    detail: redactContactText(a.detail) ?? a.detail,
    href: null,
    hrefs: { patient: null, case: null, lead: null, consultation: null },
  }));

  const receptionTasks = working.receptionTasks.map((t) => ({
    ...t,
    title: redactContactText(t.title) ?? t.title,
    description: null,
    resolutionNotes: null,
    internalNotes: null,
    patientId: null,
    caseId: null,
    leadId: null,
    bookingId: null,
    paymentId: null,
    consultationId: null,
  }));

  const revenueSummary = {
    ...working.revenueSummary,
    totalWeightedRevenue: maskAmt(working.revenueSummary.totalWeightedRevenue),
    totalAtRiskRevenue: maskAmt(working.revenueSummary.totalAtRiskRevenue),
    topOpportunities: working.revenueSummary.topOpportunities.map((o) => ({
      ...o,
      label: nextName(),
      weightedRevenue: maskAmt(o.weightedRevenue),
      hrefs: { patient: null, case: null, lead: null, consultation: null },
    })),
  };

  const conversionScoreboard = {
    ...working.conversionScoreboard,
    projectedWeightedRevenue: maskAmt(working.conversionScoreboard.projectedWeightedRevenue),
    atRiskRevenue: maskAmt(working.conversionScoreboard.atRiskRevenue),
  };

  const revenueRiskAlerts = working.revenueRiskAlerts.map((a) => ({
    ...a,
    title: redactContactText(a.title) ?? a.title,
    detail: redactContactText(a.detail) ?? a.detail,
    estimatedRevenueAtRisk:
      a.estimatedRevenueAtRisk != null ? maskAmt(a.estimatedRevenueAtRisk) : null,
    href: null,
    hrefs: { patient: null, case: null, lead: null, consultation: null },
  }));

  const endOfDayCloseout = {
    ...working.endOfDayCloseout,
    failedCommunications: working.endOfDayCloseout.failedCommunications.map((fc) => ({
      ...fc,
      toAddress: null,
      errorMessage: redactContactText(fc.errorMessage),
      leadId: null,
      patientId: null,
    })),
  };

  const demoBanner = buildReceptionOsDemoBanner({
    maskAmounts: state.maskAmounts,
    usingSampleData,
  });

  return {
    ...working,
    todaysPatients,
    communicationTimeline,
    consultationPipeline,
    outstandingDeposits,
    upcomingSurgeries,
    actionAlerts,
    receptionTasks,
    revenueSummary,
    conversionScoreboard,
    revenueRiskAlerts,
    endOfDayCloseout,
    demoMode: {
      active: true,
      maskAmounts: state.maskAmounts,
      usingSampleData,
      canToggle: state.canToggle,
    },
    systemStatus: {
      ...working.systemStatus,
      pilotBanner: demoBanner,
    },
  };
}

export const RECEPTION_OS_EXPORT_SENSITIVE_KEYS = [
  "patientName",
  "patientLabel",
  "patientOrLeadLabel",
  "preview",
  "smsBody",
  "emailBody",
  "email",
  "phone",
  "toAddress",
  "resolutionNotes",
  "internalNotes",
  "note",
  "subject",
] as const;

export function assertNoSensitiveExportKeys(obj: unknown, path = "root"): void {
  if (obj == null || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((item, i) => assertNoSensitiveExportKeys(item, `${path}[${i}]`));
    return;
  }
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if ((RECEPTION_OS_EXPORT_SENSITIVE_KEYS as readonly string[]).includes(key)) {
      throw new Error(`Sensitive export key "${key}" at ${path}`);
    }
    assertNoSensitiveExportKeys(value, `${path}.${key}`);
  }
}
