/**
 * ReceptionOS — pure model for front-desk command centre widgets.
 * Composes signals from bookings, CRM, consultations, payments, and surgery readiness.
 */

import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import type { ConsultationConversionBoardColumnId } from "@/src/lib/consultations/consultationConversionBoardModel";
import type { PaymentRecordRow } from "@/src/lib/payments/paymentRecordModel";
import {
  computeEffectivePaymentStatus,
  paymentRecordNeedsCollection,
} from "@/src/lib/payments/paymentRecordModel";

/** ReceptionOS operational persona for widget visibility (maps from workspace profiles + tenant roles). */
export const RECEPTION_OS_VIEWER_ROLES = [
  "receptionist",
  "admin",
  "consultant",
  "clinic_manager",
] as const;
export type ReceptionOsViewerRole = (typeof RECEPTION_OS_VIEWER_ROLES)[number];

export const RECEPTION_OS_WIDGET_KEYS = [
  "todays_patients",
  "communication_timeline",
  "consultation_pipeline",
  "outstanding_deposits",
  "upcoming_surgery",
  "action_alerts",
] as const;
export type ReceptionOsWidgetKey = (typeof RECEPTION_OS_WIDGET_KEYS)[number];

export const RECEPTION_OS_SEVERITIES = ["info", "warning", "critical", "blocked"] as const;
export type ReceptionOsSeverity = (typeof RECEPTION_OS_SEVERITIES)[number];

export const RECEPTION_OS_SEVERITY_LABELS: Record<ReceptionOsSeverity, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
  blocked: "Blocked",
};

export const RECEPTION_OS_PIPELINE_COLUMN_IDS = [
  "new_lead",
  "consultation_booked",
  "consultation_completed",
  "quote_sent",
  "deposit_pending",
  "surgery_booked",
] as const;
export type ReceptionOsPipelineColumnId = (typeof RECEPTION_OS_PIPELINE_COLUMN_IDS)[number];

export const RECEPTION_OS_PIPELINE_COLUMN_LABELS: Record<ReceptionOsPipelineColumnId, string> = {
  new_lead: "New lead",
  consultation_booked: "Consultation booked",
  consultation_completed: "Consultation completed",
  quote_sent: "Quote sent",
  deposit_pending: "Deposit pending",
  surgery_booked: "Surgery booked",
};

export const RECEPTION_OS_ALERT_KINDS = [
  "missing_deposit",
  "no_follow_up_after_consultation",
  "missing_forms",
  "surgery_risk",
] as const;
export type ReceptionOsAlertKind = (typeof RECEPTION_OS_ALERT_KINDS)[number];

export const RECEPTION_OS_ALERT_LABELS: Record<ReceptionOsAlertKind, string> = {
  missing_deposit: "Missing deposit",
  no_follow_up_after_consultation: "No follow-up after consultation",
  missing_forms: "Missing forms",
  surgery_risk: "Upcoming surgery risk",
};

export const RECEPTION_OS_DEFAULT_REFRESH_MS = 30_000;

/**
 * Default ReceptionOS widget stacks per persona (workspace profile defaults).
 * Used by {@link visibleWidgetsForReceptionOsRole} and staff workspace assignment UX.
 */
export const RECEPTION_OS_PERSONA_WIDGET_DEFAULTS: Record<
  ReceptionOsViewerRole,
  readonly ReceptionOsWidgetKey[]
> = {
  receptionist: ["todays_patients", "communication_timeline", "action_alerts", "upcoming_surgery"],
  consultant: [
    "todays_patients",
    "communication_timeline",
    "consultation_pipeline",
    "action_alerts",
  ],
  clinic_manager: RECEPTION_OS_WIDGET_KEYS,
  admin: RECEPTION_OS_WIDGET_KEYS,
};

/** Maps FI OS workspace profiles to ReceptionOS operational personas. */
export const RECEPTION_OS_WORKSPACE_PROFILE_TO_PERSONA: Partial<
  Record<FiWorkspaceProfileKey, ReceptionOsViewerRole>
> = {
  reception: "receptionist",
  consultant: "consultant",
  clinic_manager: "clinic_manager",
  director: "admin",
  platform_admin: "admin",
};

export function resolveReceptionOsPersonaFromWorkspaceProfile(
  profile: FiWorkspaceProfileKey
): ReceptionOsViewerRole | null {
  return RECEPTION_OS_WORKSPACE_PROFILE_TO_PERSONA[profile] ?? null;
}

/** Maps conversion-board column + deposit state to ReceptionOS pipeline lane. */
export function mapConversionColumnToReceptionPipeline(input: {
  conversionColumn: ConsultationConversionBoardColumnId;
  depositNeedsCollection: boolean;
  surgeryBooked: boolean;
}): ReceptionOsPipelineColumnId {
  if (input.surgeryBooked || input.conversionColumn === "surgery_booked") return "surgery_booked";
  if (input.depositNeedsCollection) return "deposit_pending";
  if (
    input.conversionColumn === "quote_sent" ||
    input.conversionColumn === "quote_accepted" ||
    input.conversionColumn === "quote_drafted"
  ) {
    return "quote_sent";
  }
  if (input.conversionColumn === "consultation_completed") return "consultation_completed";
  if (input.conversionColumn === "consultation_booked") return "consultation_booked";
  return "new_lead";
}

export function depositRecordIsOutstanding(
  record: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid">,
  todayYmd: string
): boolean {
  return paymentRecordNeedsCollection(record, todayYmd);
}

export function depositIsOverdue(
  record: Pick<PaymentRecordRow, "status" | "due_date">,
  todayYmd: string
): boolean {
  const eff = computeEffectivePaymentStatus(record, todayYmd);
  return eff === "overdue" || eff === "overdue_derived";
}

export function depositSeverity(input: {
  isOverdue: boolean;
  dueDate: string | null;
  todayYmd: string;
}): ReceptionOsSeverity {
  if (input.isOverdue) return "critical";
  if (input.dueDate?.trim() && input.dueDate.trim() <= input.todayYmd.trim()) return "warning";
  return "info";
}

export function surgeryReadinessSeverity(input: {
  readinessStatus: string;
  paymentComplete: boolean;
  consentComplete: boolean;
  daysUntil: number;
}): ReceptionOsSeverity {
  const status = input.readinessStatus.trim().toLowerCase();
  if (status.includes("high risk") || status.includes("blocked")) return "blocked";
  if (!input.paymentComplete && !input.consentComplete && input.daysUntil <= 3) return "critical";
  if (!input.paymentComplete || !input.consentComplete) return "warning";
  if (status.includes("needs attention")) return "warning";
  if (status.includes("ready")) return "info";
  return "info";
}

/** True when surgery should surface in Action Required alerts. */
export function surgeryItemNeedsRiskAlert(input: {
  readinessStatus: string;
  paymentComplete: boolean;
  consentComplete: boolean;
  daysUntil: number;
}): boolean {
  const sev = surgeryReadinessSeverity(input);
  return sev === "critical" || sev === "blocked" || sev === "warning";
}

export function alertSeverityForContext(input: {
  kind: ReceptionOsAlertKind;
  daysSinceConsultation?: number | null;
  isOverdueDeposit?: boolean;
  surgeryReadinessStatus?: string;
}): ReceptionOsSeverity {
  switch (input.kind) {
    case "missing_deposit":
      return input.isOverdueDeposit ? "critical" : "warning";
    case "no_follow_up_after_consultation":
      if ((input.daysSinceConsultation ?? 0) >= 7) return "critical";
      if ((input.daysSinceConsultation ?? 0) >= 3) return "warning";
      return "info";
    case "missing_forms":
      return "warning";
    case "surgery_risk": {
      const st = (input.surgeryReadinessStatus ?? "").trim().toLowerCase();
      if (st.includes("high risk")) return "blocked";
      return "critical";
    }
    default:
      return "info";
  }
}

export function compareReceptionOsSeverity(a: ReceptionOsSeverity, b: ReceptionOsSeverity): number {
  const rank: Record<ReceptionOsSeverity, number> = {
    info: 1,
    warning: 2,
    critical: 3,
    blocked: 4,
  };
  return rank[b] - rank[a];
}

/** Widget visibility by ReceptionOS persona — sourced from {@link RECEPTION_OS_PERSONA_WIDGET_DEFAULTS}. */
export function visibleWidgetsForReceptionOsRole(
  role: ReceptionOsViewerRole
): readonly ReceptionOsWidgetKey[] {
  return RECEPTION_OS_PERSONA_WIDGET_DEFAULTS[role] ?? RECEPTION_OS_WIDGET_KEYS;
}

export function isReceptionOsViewerRole(v: string): v is ReceptionOsViewerRole {
  return (RECEPTION_OS_VIEWER_ROLES as readonly string[]).includes(v);
}

export function isReceptionOsSeverity(v: string): v is ReceptionOsSeverity {
  return (RECEPTION_OS_SEVERITIES as readonly string[]).includes(v);
}

export function alertSeverityRank(kind: ReceptionOsAlertKind): number {
  switch (kind) {
    case "surgery_risk":
      return 4;
    case "missing_deposit":
      return 3;
    case "no_follow_up_after_consultation":
      return 2;
    case "missing_forms":
      return 1;
    default:
      return 0;
  }
}

/** Ensures cross-tenant rows are never merged into a tenant payload. */
export function assertReceptionOsTenantRowScope(
  expectedTenantId: string,
  rowTenantId: string,
  entity: string
): void {
  const expected = expectedTenantId.trim();
  const actual = rowTenantId.trim();
  if (!expected || !actual || expected !== actual) {
    throw new Error(
      `ReceptionOS tenant scope violation for ${entity}: expected ${expected}, got ${actual || "empty"}.`
    );
  }
}

export function primaryRecordHref(hrefs: {
  patient?: string | null;
  case?: string | null;
  lead?: string | null;
  consultation?: string | null;
  appointment?: string | null;
  calendar?: string | null;
}): string | null {
  return (
    hrefs.patient ??
    hrefs.case ??
    hrefs.lead ??
    hrefs.consultation ??
    hrefs.appointment ??
    hrefs.calendar ??
    null
  );
}
