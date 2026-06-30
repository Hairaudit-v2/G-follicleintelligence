/**
 * Pure FinancialOS international transfer workflow logic (Phase 3C) — safe for unit tests without DB.
 */

export type FiInternationalTransferMethod = "bank_transfer" | "wise" | "swift" | "paypal" | "other";

export type FiInternationalTransferStatus =
  | "instructions_required"
  | "instructions_sent"
  | "awaiting_transfer"
  | "proof_received"
  | "under_reconciliation"
  | "settlement_pending"
  | "partially_settled"
  | "settled"
  | "variance_review"
  | "rejected"
  | "cancelled";

export type FiInternationalTransferProofType =
  | "payment_receipt"
  | "bank_confirmation"
  | "wise_receipt"
  | "swift_confirmation"
  | "custom";

export type FiInternationalTransferProofStatus =
  | "pending"
  | "requested"
  | "received"
  | "verified"
  | "rejected";

export const CLEARED_INTERNATIONAL_TRANSFER_STATUSES: readonly FiInternationalTransferStatus[] = [
  "settled",
];

export const RESOLVED_INTERNATIONAL_TRANSFER_STATUSES: readonly FiInternationalTransferStatus[] = [
  "settled",
  "cancelled",
];

export const INTERNATIONAL_INSTRUCTIONS_REQUIRED_LABEL =
  "International Instructions Required" as const;
export const AWAITING_INTERNATIONAL_TRANSFER_LABEL = "Awaiting International Transfer" as const;
export const PROOF_RECONCILIATION_REQUIRED_LABEL =
  "Proof Received — Reconciliation Required" as const;
export const INTERNATIONAL_SETTLEMENT_PENDING_LABEL = "Settlement Pending" as const;
export const FX_VARIANCE_REVIEW_LABEL = "FX Variance Review" as const;
export const INTERNATIONAL_TRANSFER_SETTLED_LABEL = "International Transfer Settled" as const;
export const INTERNATIONAL_TRANSFER_REJECTED_LABEL = "International Transfer Rejected" as const;

/** Surgery pipeline chip labels (shorter variants). */
export const SURGERY_PROOF_RECONCILIATION_PENDING_LABEL = "Proof/Reconciliation Pending" as const;
export const SURGERY_INTERNATIONAL_SETTLEMENT_PENDING_LABEL =
  "International Settlement Pending" as const;

export type FiInternationalTransferApplicationRow = {
  id: string;
  transfer_status: FiInternationalTransferStatus;
  transfer_method: FiInternationalTransferMethod;
  source_country_code: string | null;
  source_currency_code: string | null;
  settlement_currency_code: string;
  expected_amount_cents: number | null;
  expected_settlement_amount_cents: number | null;
  received_amount_cents: number | null;
  expected_exchange_rate: number | null;
  actual_exchange_rate: number | null;
  fx_fee_cents: number | null;
  settlement_variance_cents: number | null;
  expected_settlement_date: string | null;
  actual_settlement_date: string | null;
  payment_reference: string | null;
  created_at: string;
  updated_at: string;
  payment_pathway_id: string;
  booking_id?: string | null;
};

export type FiInternationalTransferProofRow = {
  id: string;
  international_transfer_application_id: string;
  proof_type: FiInternationalTransferProofType;
  status: FiInternationalTransferProofStatus;
  created_at: string;
  updated_at: string;
};

export type FinancialClearanceState = "cleared" | "cancelled" | "blocked" | "partial_settlement";

function ymd(s: string | null | undefined): string | null {
  const t = s?.trim();
  if (!t) return null;
  return t.length >= 10 ? t.slice(0, 10) : t;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function daysSinceIso(iso: string, todayYmd: string): number {
  const d = ymd(iso);
  if (!d) return 0;
  return daysBetween(d, todayYmd);
}

export function isClearedInternationalTransferStatus(
  status: FiInternationalTransferStatus
): boolean {
  return CLEARED_INTERNATIONAL_TRANSFER_STATUSES.includes(status);
}

export function isResolvedInternationalTransferStatus(
  status: FiInternationalTransferStatus
): boolean {
  return RESOLVED_INTERNATIONAL_TRANSFER_STATUSES.includes(status);
}

export function hasRemainingSettlementBalance(
  application: FiInternationalTransferApplicationRow
): boolean {
  if (application.transfer_status !== "partially_settled") return false;
  const expected = application.expected_settlement_amount_cents;
  const received = application.received_amount_cents;
  if (expected == null || received == null) return true;
  return received < expected;
}

export function isUnresolvedInternationalTransferApplication(
  application: FiInternationalTransferApplicationRow | null | undefined
): boolean {
  if (!application) return false;
  if (application.transfer_status === "cancelled") return false;
  return !isClearedInternationalTransferStatus(application.transfer_status);
}

export type BuildInternationalTransferAttentionInput = {
  todayYmd: string;
  application: FiInternationalTransferApplicationRow | null;
  surgeryDateYmd?: string | null;
  /** Use shorter surgery-pipeline labels when true. */
  surgeryPipelineLabels?: boolean;
};

function statusAnchorIso(application: FiInternationalTransferApplicationRow): string {
  return application.updated_at || application.created_at;
}

export function computeDaysInStatus(
  application: FiInternationalTransferApplicationRow,
  todayYmd: string
): number {
  return daysSinceIso(statusAnchorIso(application), todayYmd);
}

export function formatSettlementVarianceLabel(
  application: FiInternationalTransferApplicationRow
): string | null {
  const variance = application.settlement_variance_cents;
  if (variance == null) return null;
  const currency = application.settlement_currency_code?.trim().toUpperCase() || "AUD";
  const abs = Math.abs(variance);
  const formatted = `${currency} ${(abs / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
  if (variance > 0) return `Over-received by ${formatted}`;
  if (variance < 0) return `Under-received by ${formatted}`;
  return "No settlement variance";
}

export function resolveFinancialClearanceState(
  application: FiInternationalTransferApplicationRow | null | undefined
): FinancialClearanceState {
  if (!application) return "cleared";
  if (application.transfer_status === "settled") return "cleared";
  if (application.transfer_status === "cancelled") return "cancelled";
  if (application.transfer_status === "partially_settled") return "partial_settlement";
  return "blocked";
}

/**
 * Ops centre escalation (SLA breached):
 * - instructions_required > 1 day
 * - instructions_sent > 3 days
 * - awaiting_transfer > 5 days
 * - proof_received > 2 days
 * - under_reconciliation > 2 days
 * - settlement_pending + surgery within 14 days
 * - expected_settlement_date missed
 * - variance_review
 * - rejected
 * - partially_settled with remaining balance
 */
export function requiresEscalatedInternationalTransferAttention(
  input: BuildInternationalTransferAttentionInput
): boolean {
  const { todayYmd, application, surgeryDateYmd = null } = input;
  if (!application || isResolvedInternationalTransferStatus(application.transfer_status))
    return false;
  if (isClearedInternationalTransferStatus(application.transfer_status)) return false;

  const status = application.transfer_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedSettlement = ymd(application.expected_settlement_date);
  const daysInStatus = computeDaysInStatus(application, todayYmd);

  if (status === "rejected" || status === "variance_review") return true;

  if (status === "instructions_required" && daysInStatus > 1) return true;
  if (status === "instructions_sent" && daysInStatus > 3) return true;
  if (status === "awaiting_transfer" && daysInStatus > 5) return true;
  if (status === "proof_received" && daysInStatus > 2) return true;
  if (status === "under_reconciliation" && daysInStatus > 2) return true;

  if (expectedSettlement && expectedSettlement < todayYmd && status !== "settled") return true;

  if (status === "settlement_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    return daysToSurgery >= 0 && daysToSurgery <= 14;
  }

  if (hasRemainingSettlementBalance(application)) return true;

  return false;
}

export function buildInternationalTransferAttentionLabels(
  input: BuildInternationalTransferAttentionInput
): string[] {
  const { todayYmd, application, surgeryDateYmd = null, surgeryPipelineLabels = false } = input;
  if (!application || isResolvedInternationalTransferStatus(application.transfer_status)) return [];
  if (isClearedInternationalTransferStatus(application.transfer_status)) return [];

  const labels: string[] = [];
  const status = application.transfer_status;
  const surgery = ymd(surgeryDateYmd);
  const expectedSettlement = ymd(application.expected_settlement_date);

  const proofLabel = surgeryPipelineLabels
    ? SURGERY_PROOF_RECONCILIATION_PENDING_LABEL
    : PROOF_RECONCILIATION_REQUIRED_LABEL;
  const settlementLabel = surgeryPipelineLabels
    ? SURGERY_INTERNATIONAL_SETTLEMENT_PENDING_LABEL
    : INTERNATIONAL_SETTLEMENT_PENDING_LABEL;

  if (status === "instructions_required") labels.push(INTERNATIONAL_INSTRUCTIONS_REQUIRED_LABEL);
  if (status === "instructions_sent" || status === "awaiting_transfer") {
    labels.push(AWAITING_INTERNATIONAL_TRANSFER_LABEL);
  }
  if (status === "proof_received" || status === "under_reconciliation") labels.push(proofLabel);
  if (status === "settlement_pending") labels.push(settlementLabel);
  if (status === "variance_review") labels.push(FX_VARIANCE_REVIEW_LABEL);
  if (status === "rejected") labels.push(INTERNATIONAL_TRANSFER_REJECTED_LABEL);
  if (status === "partially_settled" && hasRemainingSettlementBalance(application)) {
    if (!labels.includes(settlementLabel)) labels.push(settlementLabel);
  }

  if (expectedSettlement && expectedSettlement < todayYmd && status !== "settled") {
    if (!labels.includes(settlementLabel)) labels.push(settlementLabel);
  }

  if (status === "settlement_pending" && surgery) {
    const daysToSurgery = daysBetween(todayYmd, surgery);
    if (daysToSurgery >= 0 && daysToSurgery <= 14 && !labels.includes(settlementLabel)) {
      labels.push(settlementLabel);
    }
  }

  return Array.from(new Set(labels));
}

export type InternationalTransferAttentionSummary = {
  international_transfer_attention_required: boolean;
  international_transfer_summary_label: string | null;
  international_transfer_attention_labels: string[];
  days_in_status: number;
  sla_breach: boolean;
  settlement_variance_label: string | null;
  financial_clearance_state: FinancialClearanceState;
};

function summaryLabelForStatus(
  status: FiInternationalTransferStatus,
  surgeryPipelineLabels: boolean
): string {
  switch (status) {
    case "instructions_required":
      return INTERNATIONAL_INSTRUCTIONS_REQUIRED_LABEL;
    case "instructions_sent":
    case "awaiting_transfer":
      return AWAITING_INTERNATIONAL_TRANSFER_LABEL;
    case "proof_received":
    case "under_reconciliation":
      return surgeryPipelineLabels
        ? SURGERY_PROOF_RECONCILIATION_PENDING_LABEL
        : PROOF_RECONCILIATION_REQUIRED_LABEL;
    case "settlement_pending":
      return surgeryPipelineLabels
        ? SURGERY_INTERNATIONAL_SETTLEMENT_PENDING_LABEL
        : INTERNATIONAL_SETTLEMENT_PENDING_LABEL;
    case "partially_settled":
      return surgeryPipelineLabels
        ? SURGERY_INTERNATIONAL_SETTLEMENT_PENDING_LABEL
        : INTERNATIONAL_SETTLEMENT_PENDING_LABEL;
    case "variance_review":
      return FX_VARIANCE_REVIEW_LABEL;
    case "rejected":
      return INTERNATIONAL_TRANSFER_REJECTED_LABEL;
    case "settled":
      return INTERNATIONAL_TRANSFER_SETTLED_LABEL;
    default:
      return "International transfer in progress";
  }
}

/**
 * Surgery pipeline: unresolved international transfer applications block financial clearance.
 * Only `settled` clears attention.
 */
export function buildInternationalTransferAttentionSummary(
  input: BuildInternationalTransferAttentionInput
): InternationalTransferAttentionSummary {
  const { application, surgeryPipelineLabels = false } = input;
  const clearance = resolveFinancialClearanceState(application);

  if (!application || !isUnresolvedInternationalTransferApplication(application)) {
    return {
      international_transfer_attention_required: false,
      international_transfer_summary_label:
        application?.transfer_status === "settled" ? INTERNATIONAL_TRANSFER_SETTLED_LABEL : null,
      international_transfer_attention_labels: [],
      days_in_status: 0,
      sla_breach: false,
      settlement_variance_label: application ? formatSettlementVarianceLabel(application) : null,
      financial_clearance_state: clearance,
    };
  }

  const days_in_status = computeDaysInStatus(application, input.todayYmd);
  const labels = buildInternationalTransferAttentionLabels(input);
  const sla_breach = requiresEscalatedInternationalTransferAttention(input);

  return {
    international_transfer_attention_required: true,
    international_transfer_summary_label:
      labels[0] ?? summaryLabelForStatus(application.transfer_status, surgeryPipelineLabels),
    international_transfer_attention_labels: labels,
    days_in_status,
    sla_breach,
    settlement_variance_label: formatSettlementVarianceLabel(application),
    financial_clearance_state: clearance,
  };
}

export function resolveInternationalTransferAttention(
  input: BuildInternationalTransferAttentionInput
): boolean {
  return requiresEscalatedInternationalTransferAttention(input);
}

export type InternationalTransferAnalyticsRow = FiInternationalTransferApplicationRow;

export type InternationalTransferAnalytics = {
  settlementSuccessRate: number | null;
  averageDaysToProofReceived: number | null;
  averageDaysToSettled: number | null;
  averageFxVarianceCents: number | null;
  mostCommonSourceCountries: Array<{ countryCode: string; count: number }>;
  mostCommonSourceCurrencies: Array<{ currencyCode: string; count: number }>;
  transferMethodUsage: Array<{ method: FiInternationalTransferMethod; count: number }>;
  totalApplications: number;
  settledCount: number;
  rejectedCount: number;
};

export type InternationalTransferDashboardCounts = {
  openCount: number;
  awaitingTransferCount: number;
  proofReceivedCount: number;
  settlementPendingCount: number;
  varianceReviewCount: number;
  settledThisMonthCount: number;
  attentionCount: number;
  averageSettlementDays: number | null;
  totalSettlementVarianceCents: number;
};

function averageDaysBetween(startIso: string | null, endIso: string | null): number | null {
  const start = ymd(startIso);
  const end = ymd(endIso);
  if (!start || !end) return null;
  const d = daysBetween(start, end);
  return d >= 0 ? d : null;
}

function countByField<T extends string>(values: T[]): Array<{ key: T; count: number }> {
  const map = new Map<T, number>();
  for (const v of values) {
    if (!v?.trim()) continue;
    map.set(v, (map.get(v) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export function aggregateInternationalTransferAnalytics(
  applications: InternationalTransferAnalyticsRow[],
  proofs: FiInternationalTransferProofRow[] = []
): InternationalTransferAnalytics {
  const settled = applications.filter((r) => r.transfer_status === "settled");
  const rejected = applications.filter((r) => r.transfer_status === "rejected");
  const attempted = applications.filter((r) => !["cancelled"].includes(r.transfer_status));

  const proofReceivedDays: number[] = [];
  const settledDays: number[] = [];
  const fxVariances: number[] = [];

  const proofsByApp = new Map<string, FiInternationalTransferProofRow[]>();
  for (const proof of proofs) {
    proofsByApp.set(proof.international_transfer_application_id, [
      ...(proofsByApp.get(proof.international_transfer_application_id) ?? []),
      proof,
    ]);
  }

  for (const app of applications) {
    const appProofs = proofsByApp.get(app.id) ?? [];
    const firstVerified = appProofs
      .filter((p) => ["received", "verified"].includes(p.status))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (firstVerified) {
      const d = averageDaysBetween(app.created_at, firstVerified.created_at);
      if (d != null) proofReceivedDays.push(d);
    }

    if (app.transfer_status === "settled" && app.actual_settlement_date) {
      const d = averageDaysBetween(app.created_at, app.actual_settlement_date);
      if (d != null) settledDays.push(d);
    }

    if (app.settlement_variance_cents != null) fxVariances.push(app.settlement_variance_cents);
  }

  const countries = countByField(
    applications
      .map((a) => (a.source_country_code?.trim().toUpperCase() || "") as string)
      .filter(Boolean)
  );
  const currencies = countByField(
    applications
      .map((a) => (a.source_currency_code?.trim().toUpperCase() || "") as string)
      .filter(Boolean)
  );
  const methods = countByField(applications.map((a) => a.transfer_method));

  return {
    totalApplications: applications.length,
    settledCount: settled.length,
    rejectedCount: rejected.length,
    settlementSuccessRate: attempted.length > 0 ? settled.length / attempted.length : null,
    averageDaysToProofReceived:
      proofReceivedDays.length > 0
        ? Math.round(proofReceivedDays.reduce((a, b) => a + b, 0) / proofReceivedDays.length)
        : null,
    averageDaysToSettled:
      settledDays.length > 0
        ? Math.round(settledDays.reduce((a, b) => a + b, 0) / settledDays.length)
        : null,
    averageFxVarianceCents:
      fxVariances.length > 0
        ? Math.round(fxVariances.reduce((a, b) => a + b, 0) / fxVariances.length)
        : null,
    mostCommonSourceCountries: countries.map((c) => ({ countryCode: c.key, count: c.count })),
    mostCommonSourceCurrencies: currencies.map((c) => ({ currencyCode: c.key, count: c.count })),
    transferMethodUsage: methods.map((m) => ({
      method: m.key as FiInternationalTransferMethod,
      count: m.count,
    })),
  };
}

export function aggregateInternationalTransferDashboardCounts(
  applications: InternationalTransferAnalyticsRow[],
  todayYmd: string,
  surgeryDatesByBookingId: Map<string, string> = new Map()
): InternationalTransferDashboardCounts {
  const monthStart = todayYmd.slice(0, 7) + "-01";
  let openCount = 0;
  let awaitingTransferCount = 0;
  let proofReceivedCount = 0;
  let settlementPendingCount = 0;
  let varianceReviewCount = 0;
  let settledThisMonthCount = 0;
  let attentionCount = 0;
  let totalSettlementVarianceCents = 0;
  const settlementDays: number[] = [];

  for (const app of applications) {
    if (!isResolvedInternationalTransferStatus(app.transfer_status)) openCount += 1;
    if (["instructions_sent", "awaiting_transfer"].includes(app.transfer_status))
      awaitingTransferCount += 1;
    if (app.transfer_status === "proof_received") proofReceivedCount += 1;
    if (app.transfer_status === "settlement_pending") settlementPendingCount += 1;
    if (app.transfer_status === "variance_review") varianceReviewCount += 1;

    if (
      app.transfer_status === "settled" &&
      app.actual_settlement_date &&
      app.actual_settlement_date >= monthStart
    ) {
      settledThisMonthCount += 1;
    }

    if (app.settlement_variance_cents != null)
      totalSettlementVarianceCents += app.settlement_variance_cents;

    const surgeryYmd = app.booking_id
      ? (surgeryDatesByBookingId.get(app.booking_id) ?? null)
      : null;
    if (
      resolveInternationalTransferAttention({
        todayYmd,
        application: app,
        surgeryDateYmd: surgeryYmd,
      })
    ) {
      attentionCount += 1;
    }

    if (app.transfer_status === "settled") {
      const d = averageDaysBetween(app.created_at, app.actual_settlement_date);
      if (d != null) settlementDays.push(d);
    }
  }

  return {
    openCount,
    awaitingTransferCount,
    proofReceivedCount,
    settlementPendingCount,
    varianceReviewCount,
    settledThisMonthCount,
    attentionCount,
    averageSettlementDays:
      settlementDays.length > 0
        ? Math.round(settlementDays.reduce((a, b) => a + b, 0) / settlementDays.length)
        : null,
    totalSettlementVarianceCents,
  };
}
