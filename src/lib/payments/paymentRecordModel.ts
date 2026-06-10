/**
 * Manual payment / deposit tracking — pure helpers (no DB).
 * Copy in UI should describe this as recorded status, not integrated billing.
 */

export const PAYMENT_CONTEXTS = ["consultation", "surgery", "medication_reorder", "other"] as const;
export type PaymentContext = (typeof PAYMENT_CONTEXTS)[number];

export const PAYMENT_STATUSES = [
  "not_required",
  "pending",
  "partially_paid",
  "paid",
  "waived",
  "refunded",
  "overdue",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentRecordRow = {
  id: string;
  tenant_id: string;
  payment_context: PaymentContext;
  patient_id: string | null;
  lead_id: string | null;
  consultation_id: string | null;
  case_id: string | null;
  booking_id: string | null;
  amount_expected: number;
  amount_paid: number;
  currency: string;
  status: PaymentStatus;
  due_date: string | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

/** Roles allowed to create/update payment rows (server + RLS). */
export const PAYMENT_MUTATION_ROLES_LOWER = new Set(["fi_admin", "admin", "manager", "finance", "owner"]);

export function isPaymentMutationRole(role: string | null | undefined): boolean {
  return PAYMENT_MUTATION_ROLES_LOWER.has(String(role ?? "").trim().toLowerCase());
}

export type EffectivePaymentStatus = PaymentStatus | "overdue_derived";

/**
 * Calendar-day comparison in tenant YYYY-MM-DD (caller supplies tenant-local “today”).
 * When stored status is already `overdue`, keep it.
 * Otherwise: `pending` or `partially_paid` with due_date strictly before todayYmd → treat as overdue for UX/rules.
 */
export function computeEffectivePaymentStatus(
  row: Pick<PaymentRecordRow, "status" | "due_date">,
  todayYmd: string
): EffectivePaymentStatus {
  const st = row.status;
  if (st === "overdue") return "overdue";
  if (st === "paid" || st === "waived" || st === "refunded" || st === "not_required") return st;

  const due = row.due_date?.trim() || null;
  if (due && (st === "pending" || st === "partially_paid") && due < todayYmd.trim()) {
    return "overdue_derived";
  }
  return st;
}

/** True when the record implies money still expected (manual tracking semantics). */
export function paymentRecordNeedsCollection(
  row: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid">,
  todayYmd: string
): boolean {
  const eff = computeEffectivePaymentStatus(row, todayYmd);
  if (eff === "overdue" || eff === "overdue_derived" || eff === "pending") return true;
  if (eff === "partially_paid") {
    const exp = Number(row.amount_expected);
    const paid = Number(row.amount_paid);
    if (!Number.isFinite(exp) || !Number.isFinite(paid)) return true;
    return paid < exp;
  }
  return false;
}

export type ConsultationDepositBoardLabel =
  | "no_tracking"
  | "deposit_pending"
  | "deposit_paid"
  | "deposit_partial"
  | "deposit_waived"
  | "not_required"
  | "refunded";

export function consultationDepositBoardLabel(
  record: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> | null,
  todayYmd: string
): ConsultationDepositBoardLabel {
  if (!record) return "no_tracking";
  const eff = computeEffectivePaymentStatus(record, todayYmd);
  if (eff === "overdue" || eff === "overdue_derived" || eff === "pending") return "deposit_pending";
  if (eff === "partially_paid") return "deposit_partial";
  if (eff === "paid") return "deposit_paid";
  if (eff === "waived") return "deposit_waived";
  if (eff === "not_required") return "not_required";
  if (eff === "refunded") return "refunded";
  return "no_tracking";
}

export const CONSULTATION_DEPOSIT_BOARD_COPY: Record<ConsultationDepositBoardLabel, string> = {
  no_tracking: "No manual deposit record yet.",
  deposit_pending: "Deposit pending",
  deposit_paid: "Deposit paid",
  deposit_partial: "Deposit partial",
  deposit_waived: "Deposit waived",
  not_required: "Deposit not required",
  refunded: "Deposit refunded",
};

export type SurgeryDepositBoardLabel =
  | "no_tracking"
  | "missing_deposit"
  | "paid"
  | "partial"
  | "waived"
  | "not_required"
  | "refunded";

export function surgeryDepositBoardLabel(
  record: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid"> | null,
  todayYmd: string
): SurgeryDepositBoardLabel {
  if (!record) return "no_tracking";
  const eff = computeEffectivePaymentStatus(record, todayYmd);
  if (eff === "overdue" || eff === "overdue_derived" || eff === "pending") return "missing_deposit";
  if (eff === "partially_paid") return "partial";
  if (eff === "paid") return "paid";
  if (eff === "waived") return "waived";
  if (eff === "not_required") return "not_required";
  if (eff === "refunded") return "refunded";
  return "no_tracking";
}

export const SURGERY_DEPOSIT_BOARD_COPY: Record<SurgeryDepositBoardLabel, string> = {
  no_tracking: "No manual surgery payment record yet.",
  missing_deposit: "Missing deposit",
  paid: "Paid",
  partial: "Partial",
  waived: "Waived",
  not_required: "Not required",
  refunded: "Refunded",
};

export type TenantPaymentOperationsSummary = {
  /** Rows where collection is still expected (pending / partial / overdue). */
  depositsDueCount: number;
  /** Rows moved to paid with `updated_at` in the operational local window (best-effort “paid today”). */
  depositsPaidTodayCount: number;
  /** Effective overdue (stored overdue or derived from due_date). */
  overduePaymentsCount: number;
};

/**
 * KPIs from **persisted** `fi_payment_records` rows only (caller passes query results).
 * Absence of a row for an entity is not counted as “due” or “unpaid” here.
 */
export function summarizePaymentRecordsForOperations(
  rows: Pick<PaymentRecordRow, "status" | "due_date" | "amount_expected" | "amount_paid" | "updated_at">[],
  todayYmd: string,
  operationalLocalStartIso: string,
  operationalLocalEndIso: string
): TenantPaymentOperationsSummary {
  let depositsDueCount = 0;
  let depositsPaidTodayCount = 0;
  let overduePaymentsCount = 0;

  const startMs = Date.parse(operationalLocalStartIso);
  const endMs = Date.parse(operationalLocalEndIso);

  for (const r of rows) {
    const eff = computeEffectivePaymentStatus(r, todayYmd);
    if (eff === "overdue" || eff === "overdue_derived") {
      overduePaymentsCount += 1;
      depositsDueCount += 1;
      continue;
    }
    if (paymentRecordNeedsCollection(r, todayYmd)) {
      depositsDueCount += 1;
    }
    if (r.status === "paid") {
      const u = Date.parse(r.updated_at);
      if (Number.isFinite(u) && Number.isFinite(startMs) && Number.isFinite(endMs) && u >= startMs && u < endMs) {
        depositsPaidTodayCount += 1;
      }
    }
  }

  return { depositsDueCount, depositsPaidTodayCount, overduePaymentsCount };
}
