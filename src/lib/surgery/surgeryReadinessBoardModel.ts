/**
 * Pure model for Surgery Readiness Board V1.1 — explicit issues, severities, escalation, and manager filters.
 */

import { addDaysToCalendarDate, calendarDateStringFromInstant, zonedMidnightUtcMs } from "@/src/lib/calendar/calendarTimezone";

export const SURGERY_READINESS_ACTIVE_BOOKING_STATUSES = ["scheduled", "confirmed", "arrived"] as const;

export type SurgeryReadinessActiveBookingStatus = (typeof SURGERY_READINESS_ACTIVE_BOOKING_STATUSES)[number];

export function isActiveSurgeryBookingStatus(status: string): status is SurgeryReadinessActiveBookingStatus {
  const s = status.trim().toLowerCase();
  return (SURGERY_READINESS_ACTIVE_BOOKING_STATUSES as readonly string[]).includes(s);
}

/** Explicit readiness signals (no DB tables — derived from existing rows only). */
export type SurgeryReadinessIssueKind =
  | "missing_case_link"
  | "missing_pathology"
  | "abnormal_pathology"
  | "missing_consent_proxy"
  | "missing_surgery_plan"
  | "payment_not_connected"
  | "booking_unconfirmed"
  | "case_on_hold";

export type SurgeryReadinessIssueSeverity = "info" | "warning" | "high_risk";

export type SurgeryReadinessIssue = {
  kind: SurgeryReadinessIssueKind;
  severity: SurgeryReadinessIssueSeverity;
};

export const SURGERY_READINESS_ISSUE_LABEL: Record<SurgeryReadinessIssueKind, string> = {
  missing_case_link: "No linked SurgeryOS case",
  missing_pathology: "Blood pathology result on file",
  abnormal_pathology: "Pathology markers flagged abnormal",
  missing_consent_proxy: "Consultation / quote acceptance (consent proxy)",
  missing_surgery_plan: "Surgery plan incomplete or missing",
  payment_not_connected: "Payment tracking not connected",
  booking_unconfirmed: "Booking not confirmed",
  case_on_hold: "Surgery plan on hold",
};

export type SurgeryReadinessManagerFilter =
  | "all"
  | "ready"
  | "needs_attention"
  | "high_risk"
  | "missing_pathology"
  | "missing_consent"
  | "not_linked";

export type SurgeryReadinessBoardColumnId =
  | "ready"
  | "needs_attention"
  | "high_risk"
  | "missing_pathology"
  | "missing_consent"
  | "on_hold_not_linked";

export type SurgeryReadinessBoardWindow = {
  calendarTimezone: string;
  /** Tenant-local `YYYY-MM-DD` for “today”. */
  todayYmd: string;
  /** Inclusive end of the 14-day window (today + 13). */
  windowEndYmd: string;
  /** Half-open UTC range `[rangeStartIso, rangeEndIso)` for booking overlap queries. */
  rangeStartIso: string;
  rangeEndIso: string;
};

/**
 * 14 calendar days inclusive of today in the tenant operational timezone.
 */
export function computeSurgeryReadinessBoardWindow(now: Date, calendarTimezone: string): SurgeryReadinessBoardWindow {
  const tz = calendarTimezone.trim();
  const todayYmd = calendarDateStringFromInstant(now, tz);
  const windowEndYmd = addDaysToCalendarDate(todayYmd, 13, tz);
  const dayAfterEndYmd = addDaysToCalendarDate(windowEndYmd, 1, tz);
  const startMs = zonedMidnightUtcMs(todayYmd, tz);
  const endMs = zonedMidnightUtcMs(dayAfterEndYmd, tz);
  const rangeStartIso = (startMs != null ? new Date(startMs) : now).toISOString();
  const rangeEndIso = (endMs != null ? new Date(endMs) : new Date(now.getTime() + 14 * 86_400_000)).toISOString();
  return { calendarTimezone: tz, todayYmd, windowEndYmd, rangeStartIso, rangeEndIso };
}

/** True when `instant` falls on a calendar day in `[todayYmd, windowEndYmd]` in `tz`. */
export function isInstantInTenantInclusiveDayWindow(
  instantMs: number,
  tz: string,
  todayYmd: string,
  windowEndYmd: string
): boolean {
  const ymd = calendarDateStringFromInstant(new Date(instantMs), tz);
  return ymd >= todayYmd && ymd <= windowEndYmd;
}

/** Whole calendar days from tenant “today” to the surgery local day (negative if surgery is in the past). */
export function calendarDaysUntilSurgery(tz: string, todayYmd: string, surgeryStartIso: string): number {
  const surgeryYmd = calendarDateStringFromInstant(new Date(surgeryStartIso), tz);
  const t0 = zonedMidnightUtcMs(todayYmd, tz);
  const t1 = zonedMidnightUtcMs(surgeryYmd, tz);
  if (t0 == null || t1 == null) return 0;
  return Math.round((t1 - t0) / 86_400_000);
}

export type ConsultationConsentInput = {
  status: string;
  quote_data: Record<string, unknown>;
};

/**
 * CRM / ConsultationOS proxy for “procedure consent documented” when no dedicated surgery-consent table exists.
 */
export function hasConsultationConsentSignal(rows: ConsultationConsentInput[]): boolean {
  for (const r of rows) {
    const st = r.status.trim().toLowerCase();
    if (st === "accepted" || st === "converted_to_case") return true;
    const raw = r.quote_data?.quote_status;
    const qs = typeof raw === "string" ? raw.trim().toLowerCase() : "";
    if (qs.includes("accept")) return true;
  }
  return false;
}

export type BuildSurgeryReadinessIssuesInput = {
  caseId: string | null;
  /** `fi_patients.id` when resolvable (booking or case). */
  patientIdForPathology: string | null;
  hasPathologyResult: boolean;
  abnormalPathologyMarkerCount: number;
  hasConsentProxy: boolean;
  /** Row exists on `fi_case_surgery_plans`. */
  hasSurgeryPlanRow: boolean;
  /** From worklist readiness: surgery planning section complete. */
  surgeryPlanningComplete: boolean;
  bookingStatus: string;
  surgeryPlanPlanningStatus: string | null;
};

/**
 * Base severities before days-to-surgery escalation.
 * Payment is always **info** and never blocking.
 */
export function buildSurgeryReadinessIssues(input: BuildSurgeryReadinessIssuesInput): SurgeryReadinessIssue[] {
  const issues: SurgeryReadinessIssue[] = [{ kind: "payment_not_connected", severity: "info" }];

  if (!input.caseId?.trim()) {
    issues.push({ kind: "missing_case_link", severity: "warning" });
    return issues;
  }

  if (input.abnormalPathologyMarkerCount > 0) {
    issues.push({ kind: "abnormal_pathology", severity: "high_risk" });
  }

  const pid = input.patientIdForPathology?.trim() || null;
  if (pid && !input.hasPathologyResult) {
    issues.push({ kind: "missing_pathology", severity: "warning" });
  }

  if (!input.hasConsentProxy) {
    issues.push({ kind: "missing_consent_proxy", severity: "warning" });
  }

  if (!input.hasSurgeryPlanRow || !input.surgeryPlanningComplete) {
    issues.push({ kind: "missing_surgery_plan", severity: "warning" });
  }

  const planSt = input.surgeryPlanPlanningStatus?.trim().toLowerCase() ?? "";
  if (planSt === "on_hold") {
    issues.push({ kind: "case_on_hold", severity: "warning" });
  }

  const bst = input.bookingStatus.trim().toLowerCase();
  if (bst === "scheduled") {
    issues.push({ kind: "booking_unconfirmed", severity: "warning" });
  }

  return issues;
}

/**
 * Days-to-surgery escalation (V1.1). Abnormal pathology is already `high_risk` in {@link buildSurgeryReadinessIssues}.
 */
export function escalateSurgeryReadinessIssues(
  issues: SurgeryReadinessIssue[],
  daysUntil: number,
  bookingStatus: string
): SurgeryReadinessIssue[] {
  const bst = bookingStatus.trim().toLowerCase();
  return issues.map((it) => {
    if (it.kind === "missing_pathology" && daysUntil <= 7) {
      return { ...it, severity: "high_risk" };
    }
    if (it.kind === "missing_consent_proxy" && daysUntil <= 7) {
      return { ...it, severity: "high_risk" };
    }
    if (it.kind === "booking_unconfirmed" && bst === "scheduled" && daysUntil <= 3) {
      return { ...it, severity: "high_risk" };
    }
    return it;
  });
}

export function maxSurgeryReadinessIssueSeverity(issues: SurgeryReadinessIssue[]): SurgeryReadinessIssueSeverity {
  let rank = 0;
  for (const it of issues) {
    const r = it.severity === "high_risk" ? 3 : it.severity === "warning" ? 2 : 1;
    if (r > rank) rank = r;
  }
  return rank >= 3 ? "high_risk" : rank === 2 ? "warning" : "info";
}

export function hasIssueKind(issues: SurgeryReadinessIssue[], kind: SurgeryReadinessIssueKind): boolean {
  return issues.some((i) => i.kind === kind);
}

export function hasHighRiskSeverity(issues: SurgeryReadinessIssue[]): boolean {
  return issues.some((i) => i.severity === "high_risk");
}

export type PickPrimaryColumnInput = {
  issues: SurgeryReadinessIssue[];
  readinessBucket: "ready" | "in_progress" | "needs_attention" | null;
};

/**
 * Single swimlane column per card (V1.1 — driven by escalated issues + readiness).
 */
export function pickSurgeryReadinessPrimaryColumn(input: PickPrimaryColumnInput): SurgeryReadinessBoardColumnId {
  const { issues } = input;
  if (hasIssueKind(issues, "missing_case_link")) return "on_hold_not_linked";
  if (hasHighRiskSeverity(issues)) return "high_risk";
  if (hasIssueKind(issues, "missing_pathology")) return "missing_pathology";
  if (hasIssueKind(issues, "missing_consent_proxy")) return "missing_consent";

  const structural =
    hasIssueKind(issues, "missing_surgery_plan") ||
    hasIssueKind(issues, "case_on_hold") ||
    hasIssueKind(issues, "booking_unconfirmed");

  if (input.readinessBucket === "needs_attention" || input.readinessBucket === "in_progress" || structural) {
    return "needs_attention";
  }
  if (input.readinessBucket === "ready") return "ready";
  return "needs_attention";
}

export function cardMatchesManagerFilter(
  issues: SurgeryReadinessIssue[],
  primaryColumn: SurgeryReadinessBoardColumnId,
  filter: SurgeryReadinessManagerFilter
): boolean {
  if (filter === "all") return true;
  if (filter === "ready") return primaryColumn === "ready";
  if (filter === "needs_attention") return primaryColumn === "needs_attention";
  if (filter === "high_risk") return hasHighRiskSeverity(issues);
  if (filter === "missing_pathology") return hasIssueKind(issues, "missing_pathology");
  if (filter === "missing_consent") return hasIssueKind(issues, "missing_consent_proxy");
  if (filter === "not_linked") return hasIssueKind(issues, "missing_case_link");
  return true;
}

export type SurgeryReadinessKpis = {
  upcomingNext14Days: number;
  ready: number;
  needsAttention: number;
  highRisk: number;
  missingPathology: number;
  missingConsent: number;
  /** Billing not integrated — KPI copy only. */
  paymentTrackingInfoOnly: true;
};

export function aggregateSurgeryReadinessKpis(columns: Record<SurgeryReadinessBoardColumnId, unknown[]>): SurgeryReadinessKpis {
  return {
    upcomingNext14Days: Object.values(columns).reduce((a, r) => a + r.length, 0),
    ready: columns.ready.length,
    needsAttention: columns.needs_attention.length,
    highRisk: columns.high_risk.length,
    missingPathology: columns.missing_pathology.length,
    missingConsent: columns.missing_consent.length,
    paymentTrackingInfoOnly: true,
  };
}
