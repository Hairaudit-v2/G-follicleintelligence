/**
 * Pure FinancialOS Accounts Receivable engine (Phase 4) — safe for unit tests without DB.
 * Classifies receivables, calculates risk, recommends actions, and builds case/event payloads.
 */

import type { FiInvoiceKind } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents } from "@/src/lib/revenueOs/revenueInvoiceModel";

export const FI_AR_RECEIVABLE_TYPES = [
  "consultation_invoice",
  "surgery_deposit",
  "surgery_balance",
  "treatment_package",
  "subscription",
  "cancellation_fee",
] as const;
export type FiArReceivableType = (typeof FI_AR_RECEIVABLE_TYPES)[number];

export const FI_AR_RISK_LEVELS = ["low", "medium", "high", "critical"] as const;
export type FiArRiskLevel = (typeof FI_AR_RISK_LEVELS)[number];

export const FI_AR_CASE_STATUSES = [
  "open",
  "reminder_sent",
  "call_required",
  "payment_plan",
  "escalated",
  "resolved",
  "written_off",
] as const;
export type FiArCaseStatus = (typeof FI_AR_CASE_STATUSES)[number];

export const FI_AR_EVENT_KINDS = [
  "ar_case_opened",
  "reminder_sent",
  "sms_sent",
  "call_logged",
  "payment_plan_created",
  "patient_replied",
  "escalated",
  "resolved",
  "written_off",
] as const;
export type FiArEventKind = (typeof FI_AR_EVENT_KINDS)[number];

export const FI_AR_REMINDER_CHANNELS = ["email", "sms", "phone"] as const;
export type FiArReminderChannel = (typeof FI_AR_REMINDER_CHANNELS)[number];

export const FI_AR_TERMINAL_STATUSES: readonly FiArCaseStatus[] = ["resolved", "written_off"];

export const FI_AR_OPEN_STATUSES: readonly FiArCaseStatus[] = [
  "open",
  "reminder_sent",
  "call_required",
  "payment_plan",
  "escalated",
];

export const FI_AR_HIGH_VALUE_THRESHOLD_CENTS = 500_000;

export type FiAccountsReceivableCaseRow = {
  id: string;
  tenant_id: string;
  patient_id: string | null;
  case_id: string | null;
  invoice_id: string | null;
  lead_id: string | null;
  clinic_id: string | null;
  assigned_fi_user_id: string | null;
  receivable_type: FiArReceivableType;
  original_amount_cents: number;
  outstanding_amount_cents: number;
  days_overdue: number;
  risk_level: FiArRiskLevel;
  status: FiArCaseStatus;
  next_action_at: string | null;
  last_contacted_at: string | null;
  source_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
};

export type FiAccountsReceivableEventRow = {
  id: string;
  tenant_id: string;
  ar_case_id: string;
  event_kind: FiArEventKind;
  actor_fi_user_id: string | null;
  detail: Record<string, unknown>;
  created_at: string;
};

export type FiCaseArDisplayStatus =
  | "no_ar_issue"
  | "open_ar_case"
  | "high_risk_overdue"
  | "payment_plan_active"
  | "resolved";

export const FI_CASE_AR_DISPLAY_LABELS: Record<FiCaseArDisplayStatus, string> = {
  no_ar_issue: "No AR issue",
  open_ar_case: "Open AR case",
  high_risk_overdue: "High risk overdue",
  payment_plan_active: "Payment plan active",
  resolved: "Resolved",
};

export type ClassifyReceivableTypeInput = {
  invoice_kind: FiInvoiceKind;
  metadata?: Record<string, unknown> | null;
};

/**
 * Maps invoice kind / metadata to AR receivable type.
 */
export function classifyReceivableType(input: ClassifyReceivableTypeInput): FiArReceivableType {
  const meta = input.metadata ?? {};
  const metaType = typeof meta.ar_receivable_type === "string" ? meta.ar_receivable_type.trim() : "";
  if (FI_AR_RECEIVABLE_TYPES.includes(metaType as FiArReceivableType)) {
    return metaType as FiArReceivableType;
  }
  if (typeof meta.receivable_type === "string" && FI_AR_RECEIVABLE_TYPES.includes(meta.receivable_type.trim() as FiArReceivableType)) {
    return meta.receivable_type.trim() as FiArReceivableType;
  }
  if (meta.subscription === true || meta.source === "subscription") return "subscription";
  if (meta.cancellation_fee === true || meta.source === "cancellation_fee") return "cancellation_fee";
  if (meta.treatment_package === true || meta.source === "treatment_package") return "treatment_package";

  switch (input.invoice_kind) {
    case "consultation_quote":
      return "consultation_invoice";
    case "surgery_deposit":
      return "surgery_deposit";
    case "surgery_balance":
      return "surgery_balance";
    default:
      return "treatment_package";
  }
}

export function calculateDaysOverdue(args: {
  due_date: string | null;
  outstanding_amount_cents: number;
  todayYmd: string;
}): number {
  const due = args.due_date?.trim();
  if (!due || args.outstanding_amount_cents <= 0) return 0;
  if (due >= args.todayYmd) return 0;
  const dueMs = Date.parse(`${due}T00:00:00.000Z`);
  const todayMs = Date.parse(`${args.todayYmd}T00:00:00.000Z`);
  if (!Number.isFinite(dueMs) || !Number.isFinite(todayMs) || todayMs <= dueMs) return 0;
  return Math.floor((todayMs - dueMs) / 86_400_000);
}

export type CalculateReceivableRiskLevelInput = {
  receivable_type: FiArReceivableType;
  days_overdue: number;
  outstanding_amount_cents: number;
};

/**
 * Risk engine — deposit overdue < 2 days = medium; surgery balance > 7 days = high;
 * balance > 14 days = critical; high-value (>$5k) overdue escalates to high/critical.
 */
export function calculateReceivableRiskLevel(input: CalculateReceivableRiskLevelInput): FiArRiskLevel {
  const days = Math.max(0, Math.floor(input.days_overdue));
  const outstanding = Math.max(0, Math.floor(input.outstanding_amount_cents));
  if (days <= 0 || outstanding <= 0) return "low";

  const highValue = outstanding >= FI_AR_HIGH_VALUE_THRESHOLD_CENTS;

  if (input.receivable_type === "surgery_deposit") {
    if (days < 2) return "medium";
    if (days < 7) return "high";
    return "critical";
  }

  if (input.receivable_type === "surgery_balance" || input.receivable_type === "consultation_invoice") {
    if (days > 14) return "critical";
    if (days > 7) return "high";
    if (highValue) return days >= 7 ? "critical" : "high";
    if (days >= 1) return "medium";
    return "low";
  }

  if (days > 14) return "critical";
  if (days > 7) return "high";
  if (highValue && days >= 3) return days > 14 ? "critical" : "high";
  if (days >= 1) return "medium";
  return "low";
}

export type RecommendNextArActionInput = {
  receivable_type: FiArReceivableType;
  risk_level: FiArRiskLevel;
  status: FiArCaseStatus;
  days_overdue: number;
  outstanding_amount_cents: number;
};

export type RecommendNextArActionResult = {
  action: string;
  suggested_status: FiArCaseStatus;
  days_until_next_action: number;
};

export function recommendNextArAction(input: RecommendNextArActionInput): RecommendNextArActionResult {
  if (FI_AR_TERMINAL_STATUSES.includes(input.status)) {
    return { action: "No action — case closed", suggested_status: input.status, days_until_next_action: 0 };
  }

  if (input.status === "payment_plan") {
    return { action: "Monitor payment plan instalments", suggested_status: "payment_plan", days_until_next_action: 7 };
  }

  if (input.risk_level === "critical" || input.days_overdue > 14) {
    return { action: "Escalate — senior collections call", suggested_status: "escalated", days_until_next_action: 1 };
  }

  if (input.risk_level === "high" || input.days_overdue > 7) {
    return { action: "Phone call required", suggested_status: "call_required", days_until_next_action: 2 };
  }

  if (input.receivable_type === "surgery_deposit" && input.days_overdue >= 1) {
    return { action: "Send deposit reminder", suggested_status: "reminder_sent", days_until_next_action: 1 };
  }

  if (input.status === "open" && input.days_overdue >= 1) {
    return { action: "Send payment reminder", suggested_status: "reminder_sent", days_until_next_action: 3 };
  }

  return { action: "Monitor — not yet overdue", suggested_status: input.status, days_until_next_action: 7 };
}

function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function computeNextActionAtIso(todayYmd: string, daysUntil: number): string {
  const days = Math.max(0, Math.floor(daysUntil));
  const targetYmd = ymdAddDays(todayYmd, days);
  return `${targetYmd}T09:00:00.000Z`;
}

export type BuildAccountsReceivableCaseInput = {
  tenant_id: string;
  patient_id?: string | null;
  case_id?: string | null;
  invoice_id?: string | null;
  lead_id?: string | null;
  clinic_id?: string | null;
  assigned_fi_user_id?: string | null;
  receivable_type: FiArReceivableType;
  original_amount_cents: number;
  outstanding_amount_cents: number;
  days_overdue: number;
  risk_level: FiArRiskLevel;
  status?: FiArCaseStatus;
  next_action_at?: string | null;
  last_contacted_at?: string | null;
  source_metadata?: Record<string, unknown>;
  todayYmd: string;
};

export function buildAccountsReceivableCase(input: BuildAccountsReceivableCaseInput): Omit<
  FiAccountsReceivableCaseRow,
  "id" | "created_at" | "updated_at" | "resolved_at"
> & { resolved_at: string | null } {
  const outstanding = Math.max(0, Math.floor(input.outstanding_amount_cents));
  const original = Math.max(0, Math.floor(input.original_amount_cents));
  const daysOverdue = Math.max(0, Math.floor(input.days_overdue));
  const status = input.status ?? "open";

  const recommendation = recommendNextArAction({
    receivable_type: input.receivable_type,
    risk_level: input.risk_level,
    status,
    days_overdue: daysOverdue,
    outstanding_amount_cents: outstanding,
  });

  const nextActionAt =
    input.next_action_at?.trim() ||
    (FI_AR_TERMINAL_STATUSES.includes(status) ? null : computeNextActionAtIso(input.todayYmd, recommendation.days_until_next_action));

  return {
    tenant_id: input.tenant_id.trim(),
    patient_id: input.patient_id?.trim() || null,
    case_id: input.case_id?.trim() || null,
    invoice_id: input.invoice_id?.trim() || null,
    lead_id: input.lead_id?.trim() || null,
    clinic_id: input.clinic_id?.trim() || null,
    assigned_fi_user_id: input.assigned_fi_user_id?.trim() || null,
    receivable_type: input.receivable_type,
    original_amount_cents: original,
    outstanding_amount_cents: outstanding,
    days_overdue: daysOverdue,
    risk_level: input.risk_level,
    status,
    next_action_at: nextActionAt,
    last_contacted_at: input.last_contacted_at?.trim() || null,
    source_metadata: input.source_metadata && typeof input.source_metadata === "object" ? { ...input.source_metadata } : {},
    resolved_at: FI_AR_TERMINAL_STATUSES.includes(status) ? new Date().toISOString() : null,
  };
}

export type BuildAccountsReceivableEventInput = {
  tenant_id: string;
  ar_case_id: string;
  event_kind: FiArEventKind;
  actor_fi_user_id?: string | null;
  detail?: Record<string, unknown>;
};

export function buildAccountsReceivableEvent(input: BuildAccountsReceivableEventInput): Omit<
  FiAccountsReceivableEventRow,
  "id" | "created_at"
> {
  return {
    tenant_id: input.tenant_id.trim(),
    ar_case_id: input.ar_case_id.trim(),
    event_kind: input.event_kind,
    actor_fi_user_id: input.actor_fi_user_id?.trim() || null,
    detail: input.detail && typeof input.detail === "object" ? { ...input.detail } : {},
  };
}

export type DeriveArCaseFromInvoiceInput = {
  tenant_id: string;
  todayYmd: string;
  invoice: {
    id: string;
    patient_id: string | null;
    case_id: string | null;
    lead_id: string | null;
    clinic_id: string | null;
    invoice_kind: FiInvoiceKind;
    total_cents: number;
    amount_paid_cents: number;
    remaining_balance_cents?: number;
    due_date: string | null;
    metadata?: Record<string, unknown>;
    title?: string | null;
  };
  trigger?: "invoice_overdue" | "deposit_deadline_missed" | "payment_mismatch" | "manual";
};

export function deriveArCaseFromInvoice(input: DeriveArCaseFromInvoiceInput): Omit<
  FiAccountsReceivableCaseRow,
  "id" | "created_at" | "updated_at"
> | null {
  const outstanding = Math.max(
    0,
    input.invoice.remaining_balance_cents ??
      invoiceBalanceDueCents({
        total_cents: input.invoice.total_cents,
        amount_paid_cents: input.invoice.amount_paid_cents,
      }),
  );
  if (outstanding <= 0) return null;

  const receivableType = classifyReceivableType({
    invoice_kind: input.invoice.invoice_kind,
    metadata: input.invoice.metadata,
  });
  const daysOverdue = calculateDaysOverdue({
    due_date: input.invoice.due_date,
    outstanding_amount_cents: outstanding,
    todayYmd: input.todayYmd,
  });

  if (daysOverdue <= 0 && input.trigger !== "payment_mismatch" && input.trigger !== "manual") {
    return null;
  }

  const riskLevel = calculateReceivableRiskLevel({
    receivable_type: receivableType,
    days_overdue: daysOverdue,
    outstanding_amount_cents: outstanding,
  });

  const built = buildAccountsReceivableCase({
    tenant_id: input.tenant_id,
    patient_id: input.invoice.patient_id,
    case_id: input.invoice.case_id,
    invoice_id: input.invoice.id,
    lead_id: input.invoice.lead_id,
    clinic_id: input.invoice.clinic_id,
    receivable_type: receivableType,
    original_amount_cents: input.invoice.total_cents,
    outstanding_amount_cents: outstanding,
    days_overdue: daysOverdue,
    risk_level: riskLevel,
    todayYmd: input.todayYmd,
    source_metadata: {
      trigger: input.trigger ?? "invoice_overdue",
      invoice_kind: input.invoice.invoice_kind,
      invoice_title: input.invoice.title ?? null,
      due_date: input.invoice.due_date,
    },
  });

  return built;
}

export function arCaseDedupeKey(tenantId: string, invoiceId: string, receivableType: FiArReceivableType): string {
  return `${tenantId.trim()}:${invoiceId.trim()}:${receivableType}`;
}

export function isOpenArCaseStatus(status: FiArCaseStatus): boolean {
  return FI_AR_OPEN_STATUSES.includes(status);
}

export type ApplyPaymentToArCaseInput = {
  case: Pick<FiAccountsReceivableCaseRow, "outstanding_amount_cents" | "status" | "original_amount_cents">;
  payment_amount_cents: number;
  todayYmd: string;
  receivable_type: FiArReceivableType;
  days_overdue: number;
};

export type ApplyPaymentToArCaseResult = {
  outstanding_amount_cents: number;
  status: FiArCaseStatus;
  resolved: boolean;
  risk_level: FiArRiskLevel;
};

export function applyPaymentToArCase(input: ApplyPaymentToArCaseInput): ApplyPaymentToArCaseResult {
  const paid = Math.max(0, Math.floor(input.payment_amount_cents));
  const prevOutstanding = Math.max(0, Math.floor(input.case.outstanding_amount_cents));
  const nextOutstanding = Math.max(0, prevOutstanding - paid);

  if (nextOutstanding <= 0) {
    return {
      outstanding_amount_cents: 0,
      status: "resolved",
      resolved: true,
      risk_level: "low",
    };
  }

  const riskLevel = calculateReceivableRiskLevel({
    receivable_type: input.receivable_type,
    days_overdue: input.days_overdue,
    outstanding_amount_cents: nextOutstanding,
  });

  const status = input.case.status === "payment_plan" ? "payment_plan" : input.case.status;

  return {
    outstanding_amount_cents: nextOutstanding,
    status,
    resolved: false,
    risk_level: riskLevel,
  };
}

export type BuildReminderDraftInput = {
  receivable_type: FiArReceivableType;
  channel: FiArReminderChannel;
  patient_name?: string | null;
  outstanding_amount_cents: number;
  currency?: string;
  days_overdue: number;
  invoice_title?: string | null;
};

export type FiArReminderDraft = {
  reminder_channel: FiArReminderChannel;
  reminder_template_key: string;
  reminder_body_preview: string;
  /** Phase 4 — drafts only; no live delivery. */
  delivery_mode: "draft_only";
};

const REMINDER_TEMPLATE_KEYS: Record<FiArReceivableType, Record<FiArReminderChannel, string>> = {
  consultation_invoice: {
    email: "ar_consultation_invoice_email_v1",
    sms: "ar_consultation_invoice_sms_v1",
    phone: "ar_consultation_invoice_phone_script_v1",
  },
  surgery_deposit: {
    email: "ar_surgery_deposit_email_v1",
    sms: "ar_surgery_deposit_sms_v1",
    phone: "ar_surgery_deposit_phone_script_v1",
  },
  surgery_balance: {
    email: "ar_surgery_balance_email_v1",
    sms: "ar_surgery_balance_sms_v1",
    phone: "ar_surgery_balance_phone_script_v1",
  },
  treatment_package: {
    email: "ar_treatment_package_email_v1",
    sms: "ar_treatment_package_sms_v1",
    phone: "ar_treatment_package_phone_script_v1",
  },
  subscription: {
    email: "ar_subscription_email_v1",
    sms: "ar_subscription_sms_v1",
    phone: "ar_subscription_phone_script_v1",
  },
  cancellation_fee: {
    email: "ar_cancellation_fee_email_v1",
    sms: "ar_cancellation_fee_sms_v1",
    phone: "ar_cancellation_fee_phone_script_v1",
  },
};

export function buildReminderDraft(input: BuildReminderDraftInput): FiArReminderDraft {
  const currency = (input.currency ?? "AUD").toUpperCase();
  const amount = (Math.max(0, input.outstanding_amount_cents) / 100).toFixed(2);
  const name = input.patient_name?.trim() || "there";
  const title = input.invoice_title?.trim() || "your invoice";

  const templateKey = REMINDER_TEMPLATE_KEYS[input.receivable_type][input.channel];

  let bodyPreview: string;
  if (input.channel === "phone") {
    bodyPreview = `Call script draft: Hi ${name}, this is [Clinic] regarding ${title}. Your outstanding balance is ${currency} ${amount} (${input.days_overdue} days overdue). [Draft only — not sent.]`;
  } else if (input.channel === "sms") {
    bodyPreview = `[DRAFT SMS] Hi ${name}, reminder: ${currency} ${amount} outstanding on ${title}. Reply or call us to arrange payment.`;
  } else {
    bodyPreview = `[DRAFT EMAIL] Subject: Payment reminder — ${title}\n\nDear ${name},\n\nThis is a friendly reminder that ${currency} ${amount} remains outstanding (${input.days_overdue} days overdue).\n\n[Draft only — no email sent in Phase 4.]`;
  }

  return {
    reminder_channel: input.channel,
    reminder_template_key: templateKey,
    reminder_body_preview: bodyPreview,
    delivery_mode: "draft_only",
  };
}

export function buildCaseArDisplayStatus(
  cases: Pick<FiAccountsReceivableCaseRow, "status" | "risk_level" | "outstanding_amount_cents">[],
): FiCaseArDisplayStatus {
  if (!cases.length) return "no_ar_issue";

  const open = cases.filter((c) => isOpenArCaseStatus(c.status) && c.outstanding_amount_cents > 0);
  if (!open.length) {
    const hasResolved = cases.some((c) => c.status === "resolved");
    return hasResolved ? "resolved" : "no_ar_issue";
  }

  if (open.some((c) => c.status === "payment_plan")) return "payment_plan_active";
  if (open.some((c) => c.risk_level === "high" || c.risk_level === "critical")) return "high_risk_overdue";
  return "open_ar_case";
}

export function mapAccountsReceivableCaseRow(raw: Record<string, unknown>): FiAccountsReceivableCaseRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    assigned_fi_user_id: raw.assigned_fi_user_id != null ? String(raw.assigned_fi_user_id) : null,
    receivable_type: String(raw.receivable_type) as FiArReceivableType,
    original_amount_cents: Math.max(0, Number(raw.original_amount_cents ?? 0)),
    outstanding_amount_cents: Math.max(0, Number(raw.outstanding_amount_cents ?? 0)),
    days_overdue: Math.max(0, Number(raw.days_overdue ?? 0)),
    risk_level: String(raw.risk_level) as FiArRiskLevel,
    status: String(raw.status) as FiArCaseStatus,
    next_action_at: raw.next_action_at != null ? String(raw.next_action_at) : null,
    last_contacted_at: raw.last_contacted_at != null ? String(raw.last_contacted_at) : null,
    source_metadata:
      raw.source_metadata && typeof raw.source_metadata === "object" && !Array.isArray(raw.source_metadata)
        ? (raw.source_metadata as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
    resolved_at: raw.resolved_at != null ? String(raw.resolved_at) : null,
  };
}

export function mapAccountsReceivableEventRow(raw: Record<string, unknown>): FiAccountsReceivableEventRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    ar_case_id: String(raw.ar_case_id),
    event_kind: String(raw.event_kind) as FiArEventKind,
    actor_fi_user_id: raw.actor_fi_user_id != null ? String(raw.actor_fi_user_id) : null,
    detail:
      raw.detail && typeof raw.detail === "object" && !Array.isArray(raw.detail)
        ? (raw.detail as Record<string, unknown>)
        : {},
    created_at: String(raw.created_at ?? ""),
  };
}

export type AccountsReceivableDashboardMetrics = {
  totalOutstandingCents: number;
  overdueRevenueCents: number;
  criticalCaseCount: number;
  depositsAtRiskCents: number;
  averageDaysOverdue: number;
  openCaseCount: number;
};

export function aggregateAccountsReceivableMetrics(
  cases: Pick<
    FiAccountsReceivableCaseRow,
    "outstanding_amount_cents" | "days_overdue" | "risk_level" | "receivable_type" | "status"
  >[],
): AccountsReceivableDashboardMetrics {
  const open = cases.filter((c) => isOpenArCaseStatus(c.status) && c.outstanding_amount_cents > 0);
  const totalOutstandingCents = open.reduce((acc, c) => acc + c.outstanding_amount_cents, 0);
  const overdue = open.filter((c) => c.days_overdue > 0);
  const overdueRevenueCents = overdue.reduce((acc, c) => acc + c.outstanding_amount_cents, 0);
  const criticalCaseCount = open.filter((c) => c.risk_level === "critical").length;
  const depositsAtRisk = open.filter((c) => c.receivable_type === "surgery_deposit");
  const depositsAtRiskCents = depositsAtRisk.reduce((acc, c) => acc + c.outstanding_amount_cents, 0);
  const averageDaysOverdue =
    overdue.length > 0 ? Math.round(overdue.reduce((acc, c) => acc + c.days_overdue, 0) / overdue.length) : 0;

  return {
    totalOutstandingCents,
    overdueRevenueCents,
    criticalCaseCount,
    depositsAtRiskCents,
    averageDaysOverdue,
    openCaseCount: open.length,
  };
}

export const FI_AR_RECEIVABLE_TYPE_LABELS: Record<FiArReceivableType, string> = {
  consultation_invoice: "Consultation invoice",
  surgery_deposit: "Surgery deposit",
  surgery_balance: "Surgery balance",
  treatment_package: "Treatment package",
  subscription: "Subscription",
  cancellation_fee: "Cancellation fee",
};

export const FI_AR_RISK_LABELS: Record<FiArRiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const FI_AR_STATUS_LABELS: Record<FiArCaseStatus, string> = {
  open: "Open",
  reminder_sent: "Reminder sent",
  call_required: "Call required",
  payment_plan: "Payment plan",
  escalated: "Escalated",
  resolved: "Resolved",
  written_off: "Written off",
};
