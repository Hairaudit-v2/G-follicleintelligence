import { computeTomorrowOperationalWindow } from "@/src/lib/clinicOs/tomorrowBoardModel";
import type {
  AgendaBucket,
  DashboardBookingItem,
  ReceptionBoardCard,
  TenantActionCentre,
  TenantClinicToday,
  TenantLaunchControl,
  TenantOperationalDay,
  TenantPaymentCommercialKpis,
  TenantQuickStats,
  TenantRevenueCollections,
} from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

export type ClinicSnapshotCard = {
  id: string;
  label: string;
  value: number | string;
  detail: string;
  href: string;
};

export type AttentionPriorityItem = {
  id: string;
  label: string;
  detail: string;
  href: string;
  severity: "critical" | "warning" | "normal";
  priorityScore: number;
};

export type TimelineEntry = {
  id: string;
  timeLabel: string;
  sortKey: string;
  title: string;
  detail: string;
  href: string | null;
};

export type PerformanceKpi = {
  id: string;
  label: string;
  value: string;
  detail: string;
  href: string;
};

export type TomorrowPreviewLine = {
  id: string;
  text: string;
};

/** Exported so the Today-surface shadow diff (FI-UX-REBUILD-1D) can validate against the same definition. */
export const IN_CLINIC_COLUMNS = new Set(["arrived", "in_consultation", "in_treatment"]);

function formatConversion(rate: number | null, won: number, closed: number): string {
  if (rate == null || closed === 0) return "—";
  return `${Math.round(rate * 100)}%`;
}

function formatSlot(iso: string, tz: string | null): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: tz?.trim() || undefined,
  }).format(d);
}

function isInOperationalDay(iso: string, localStartIso: string, localEndIso: string): boolean {
  const t = Date.parse(iso);
  const a = Date.parse(localStartIso);
  const b = Date.parse(localEndIso);
  if (![t, a, b].every(Number.isFinite)) return iso >= localStartIso && iso < localEndIso;
  return t >= a && t < b;
}

export function countPatientsInClinicToday(cards: readonly ReceptionBoardCard[]): number {
  return cards.filter((c) => IN_CLINIC_COLUMNS.has(c.receptionColumn)).length;
}

function countUrgentAlerts(actionCentre: TenantActionCentre): number {
  return (
    actionCentre.surgeryReadinessAlerts +
    actionCentre.financialClearanceAttention +
    actionCentre.surgeryFinancialPaymentAttention
  );
}

function plural(count: number, singular: string, pluralForm?: string): string {
  if (count === 1) return `1 ${singular}`;
  return `${count} ${pluralForm ?? `${singular}s`}`;
}

export function buildClinicSnapshotCards(input: {
  base: string;
  clinicToday: TenantClinicToday;
  receptionCards: readonly ReceptionBoardCard[];
  paymentCommercialKpis: TenantPaymentCommercialKpis;
  revenueCollections: TenantRevenueCollections;
  quickStats: TenantQuickStats;
  actionCentre: TenantActionCentre;
}): ClinicSnapshotCard[] {
  const {
    base,
    clinicToday,
    receptionCards,
    paymentCommercialKpis,
    revenueCollections,
    quickStats,
    actionCentre,
  } = input;

  const outstandingPayments =
    paymentCommercialKpis.overduePaymentsCount +
    paymentCommercialKpis.depositsDueCount +
    revenueCollections.unpaidIssuedInvoiceCount;

  const cards: ClinicSnapshotCard[] = [
    {
      id: "patients_in_clinic",
      label: "Patients in clinic today",
      value: countPatientsInClinicToday(receptionCards),
      detail: "Currently on-site or in active care",
      href: `${base}/reception`,
    },
    {
      id: "surgeries_today",
      label: "Surgeries scheduled today",
      value: clinicToday.surgeries,
      detail: "Procedures on today’s clinic day",
      href: `${base}/surgery-os`,
    },
    {
      id: "consultations_today",
      label: "Consultations today",
      value: clinicToday.consultations,
      detail: "Consultation visits starting today",
      href: `${base}/calendar`,
    },
    {
      id: "outstanding_payments",
      label: "Outstanding payments",
      value: outstandingPayments,
      detail: "Deposits, overdue balances, and unpaid invoices",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "team_readiness",
      label: "Team readiness",
      value: quickStats.staffOnDutyToday,
      detail: "Clinical staff assigned on today’s schedule",
      href: `${base}/reception`,
    },
    {
      id: "urgent_alerts",
      label: "Urgent operational alerts",
      value: countUrgentAlerts(actionCentre),
      detail: "Surgery preparation and payment clearance items",
      href: `${base}/operations`,
    },
  ];

  return cards.slice(0, 6);
}

type AttentionCandidate = {
  id: string;
  count: number;
  priorityScore: number;
  severity: AttentionPriorityItem["severity"];
  label: (count: number) => string;
  detail: string;
  href: string;
};

export function buildAttentionPriorities(input: {
  base: string;
  actionCentre: TenantActionCentre;
  showCrmNav: boolean;
  maxItems?: number;
}): AttentionPriorityItem[] {
  const { base, actionCentre, showCrmNav, maxItems = 5 } = input;

  const candidates: AttentionCandidate[] = [
    {
      id: "financial_clearance",
      count: actionCentre.financialClearanceAttention,
      priorityScore: 100,
      severity: "critical",
      label: (n) =>
        plural(n, "surgery", "surgeries") + " need payment clearance before procedure day",
      detail: "Confirm financial clearance before upcoming procedures.",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "surgery_readiness",
      count: actionCentre.surgeryReadinessAlerts,
      priorityScore: 95,
      severity: "critical",
      label: (n) =>
        plural(n, "surgery", "surgeries") + " blocked by missing preparation requirements",
      detail: "Link cases and complete preparation before procedure day.",
      href: `${base}/cases`,
    },
    {
      id: "surgery_payment",
      count: actionCentre.surgeryFinancialPaymentAttention,
      priorityScore: 90,
      severity: "warning",
      label: (n) => plural(n, "upcoming surgery", "upcoming surgeries") + " need payment follow-up",
      detail: "Deposits or balances require confirmation before surgery.",
      href: `${base}/financial/invoices`,
    },
    {
      id: "consultations",
      count: actionCentre.consultationsAwaitingCompletion,
      priorityScore: 70,
      severity: "warning",
      label: (n) => plural(n, "consultation", "consultations") + " require completion",
      detail: "Draft, in progress, or quoted consultation workspaces.",
      href: `${base}/consultations`,
    },
    {
      id: "follow_ups",
      count: actionCentre.followUpsDue,
      priorityScore: 65,
      severity: "warning",
      label: (n) =>
        plural(n, "follow-up visit", "follow-up visits") + " require scheduling attention",
      detail: "Review visits due within the next two weeks.",
      href: `${base}/calendar`,
    },
    {
      id: "leads",
      count: actionCentre.leadsAwaitingContact,
      priorityScore: 55,
      severity: "normal",
      label: (n) => plural(n, "new enquiry", "new enquiries") + " awaiting contact",
      detail: "Open enquiries not yet worked by the team.",
      href: showCrmNav ? `${base}/crm` : `${base}/calendar`,
    },
    {
      id: "pathway_tasks",
      count: actionCentre.financialPathwayTasksAttention,
      priorityScore: 60,
      severity: "warning",
      label: (n) => plural(n, "payment pathway task", "payment pathway tasks") + " need review",
      detail: "Non-standard payment arrangements awaiting staff action.",
      href: `${base}/financial/pathway-inbox`,
    },
    {
      id: "finance_applications",
      count: actionCentre.financeApplicationsAttention,
      priorityScore: 58,
      severity: "warning",
      label: (n) => plural(n, "finance application", "finance applications") + " need attention",
      detail: "Financing applications awaiting documents or approval.",
      href: `${base}/financial/finance-applications`,
    },
  ];

  return candidates
    .filter((c) => c.count > 0)
    .sort((a, b) => b.priorityScore - a.priorityScore || b.count - a.count)
    .slice(0, maxItems)
    .map((c) => ({
      id: c.id,
      label: c.label(c.count),
      detail: c.detail,
      href: c.href,
      severity: c.severity,
      priorityScore: c.priorityScore,
    }));
}

const BUCKET_TIMELINE_LABEL: Record<AgendaBucket, string> = {
  consult: "Consultation scheduled",
  surgery: "Surgery begins",
  follow_up: "Follow-up appointment",
  other: "Appointment scheduled",
};

function timelineLabelForBooking(bucket: AgendaBucket, row: DashboardBookingItem): string {
  const status = String(row.booking_status ?? "")
    .trim()
    .toLowerCase();
  if (status === "arrived") return "Patient arrival confirmed";
  if (bucket === "surgery") return "Surgery begins";
  if (bucket === "consult") return "Consultation scheduled";
  if (bucket === "follow_up") return "Follow-up appointment";
  return BUCKET_TIMELINE_LABEL[bucket];
}

export function buildTodayTimeline(input: {
  base: string;
  operationalDay: TenantOperationalDay;
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>;
  paymentCommercialKpis: TenantPaymentCommercialKpis;
  maxItems?: number;
}): TimelineEntry[] {
  const { base, operationalDay, agendaByBucket, paymentCommercialKpis, maxItems = 12 } = input;
  const { localStartIso, localEndIso, calendarTimezone } = operationalDay;

  const appointmentEntries: TimelineEntry[] = (
    ["consult", "surgery", "follow_up", "other"] as AgendaBucket[]
  )
    .flatMap((bucket) =>
      agendaByBucket[bucket]
        .filter((row) => isInOperationalDay(row.start_at, localStartIso, localEndIso))
        .map((row) => ({
          id: `appt-${row.id}`,
          timeLabel: formatSlot(row.start_at, row.timezone ?? calendarTimezone),
          sortKey: row.start_at,
          title: timelineLabelForBooking(bucket, row),
          detail: row.title?.trim() || "Scheduled visit",
          href: row.case_id
            ? `${base}/cases/${row.case_id}`
            : row.patient_id
              ? `${base}/patients/${row.patient_id}`
              : row.lead_id
                ? `${base}/crm/leads/${row.lead_id}`
                : `${base}/calendar`,
        }))
    )
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const entries = [...appointmentEntries];

  if (
    paymentCommercialKpis.depositsDueCount > 0 ||
    paymentCommercialKpis.overduePaymentsCount > 0
  ) {
    const paymentCount =
      paymentCommercialKpis.depositsDueCount + paymentCommercialKpis.overduePaymentsCount;
    entries.push({
      id: "payment-due",
      timeLabel: "Today",
      sortKey: `${localEndIso}`,
      title: "Payment collection due",
      detail: plural(paymentCount, "payment item", "payment items") + " awaiting collection",
      href: `${base}/financial/dashboard`,
    });
  }

  return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).slice(0, maxItems);
}

export function buildPerformanceKpis(input: {
  base: string;
  quickStats: TenantQuickStats;
  launchControl: TenantLaunchControl;
  actionCentre: TenantActionCentre;
  paymentCommercialKpis: TenantPaymentCommercialKpis;
}): PerformanceKpi[] {
  const { base, quickStats, launchControl, actionCentre, paymentCommercialKpis } = input;

  const conversion = formatConversion(
    quickStats.conversionRateLast30d,
    quickStats.conversionWonLast30d,
    quickStats.conversionClosedLast30d
  );

  const surgeriesThisWeek = launchControl.surgeriesThisWeek;
  const readinessBlocked = actionCentre.surgeryReadinessAlerts;
  const procedureReadiness =
    surgeriesThisWeek > 0
      ? `${Math.round(((surgeriesThisWeek - Math.min(readinessBlocked, surgeriesThisWeek)) / surgeriesThisWeek) * 100)}%`
      : "—";

  const activeJourneys = quickStats.openConsultations + actionCentre.followUpsDue;

  return [
    {
      id: "conversion",
      label: "Consultation conversion",
      value: conversion,
      detail: "Enquiries converted to booked care · 30 days",
      href: `${base}/crm`,
    },
    {
      id: "procedure_readiness",
      label: "Procedure readiness",
      value: procedureReadiness,
      detail: "This week’s surgeries without preparation blocks",
      href: `${base}/surgery-os`,
    },
    {
      id: "revenue_today",
      label: "Revenue collected today",
      value: String(paymentCommercialKpis.depositsPaidTodayCount),
      detail: "Deposits recorded for today’s clinic day",
      href: `${base}/financial/dashboard`,
    },
    {
      id: "active_journeys",
      label: "Patients in active care",
      value: String(activeJourneys),
      detail: "Open consultations and follow-ups in progress",
      href: `${base}/patients`,
    },
  ].slice(0, 4);
}

export function buildTomorrowPreview(input: {
  operationalDay: TenantOperationalDay;
  agendaByBucket: Record<AgendaBucket, DashboardBookingItem[]>;
  paymentCommercialKpis: TenantPaymentCommercialKpis;
  now?: Date;
}): TomorrowPreviewLine[] {
  const { operationalDay, agendaByBucket, paymentCommercialKpis, now = new Date() } = input;
  const window = computeTomorrowOperationalWindow(now, operationalDay.calendarTimezone);

  const tomorrowSurgeries = agendaByBucket.surgery.filter((row) =>
    isInOperationalDay(row.start_at, window.localStartIso, window.localEndIso)
  );
  const missingPrep = tomorrowSurgeries.filter((row) => !row.case_id?.trim()).length;
  const awaitingPayment = paymentCommercialKpis.depositsDueCount;

  const lines: TomorrowPreviewLine[] = [
    {
      id: "surgeries",
      text:
        plural(tomorrowSurgeries.length, "surgery scheduled", "surgeries scheduled") + " tomorrow",
    },
  ];

  if (missingPrep > 0) {
    lines.push({
      id: "prep",
      text: plural(missingPrep, "preparation item missing", "preparation items missing"),
    });
  }

  if (awaitingPayment > 0) {
    lines.push({
      id: "payment",
      text: plural(
        awaitingPayment,
        "patient awaiting payment confirmation",
        "patients awaiting payment confirmation"
      ),
    });
  }

  return lines.slice(0, 3);
}
