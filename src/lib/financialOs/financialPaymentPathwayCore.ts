/**
 * Pure FinancialOS payment pathway operational logic (Phase 2) — safe for unit tests without DB.
 * Determines whether the *active* payment pathway for a surgery context needs staff attention
 * before surgery. Does not block any surgery flow — attention only.
 */

export type FiPaymentPathwayType =
  | "pay_in_full"
  | "deposit_balance"
  | "installment_plan"
  | "medical_finance"
  | "super_release"
  | "international_transfer"
  | "manual";

export type FiPaymentPathwayStatus =
  | "draft"
  | "selected"
  | "pending_patient_action"
  | "pending_clinic_action"
  | "pending_provider"
  | "approved"
  | "rejected"
  | "settlement_pending"
  | "settled"
  | "cancelled";

export type FiPaymentPathwayRow = {
  id: string;
  pathway_type: FiPaymentPathwayType;
  status: FiPaymentPathwayStatus;
  provider: string | null;
  provider_reference: string | null;
  expected_settlement_date: string | null;
  actual_settlement_date: string | null;
  expected_amount_cents: number | null;
  settled_amount_cents: number | null;
  currency_code: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentPathwayAttentionSummary = {
  /** False when there is no pathway recorded for this context. */
  hasActivePathway: boolean;
  pathway_id: string | null;
  pathway_type: FiPaymentPathwayType | null;
  pathway_status: FiPaymentPathwayStatus | null;
  provider: string | null;
  expected_settlement_date: string | null;
  pathway_attention_required: boolean;
  pathway_attention_reason: string | null;
};

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

function isSettledLike(status: FiPaymentPathwayStatus): boolean {
  return status === "settled" || status === "cancelled";
}

/**
 * Picks the single "active" pathway for a context: most recently created/updated row that
 * isn't cancelled, preferring settlement-relevant rows. Staff are expected to keep at most one
 * non-cancelled pathway per invoice/booking, but we defensively pick the latest if several exist.
 */
export function resolveActivePaymentPathway(rows: FiPaymentPathwayRow[]): FiPaymentPathwayRow | null {
  const candidates = rows.filter((r) => r.status !== "cancelled");
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""))[0] ?? null;
}

/**
 * Derives the operational attention summary for a surgery context's active payment pathway.
 * Surfaces attention only — never blocks the surgery flow.
 */
export function buildPaymentPathwayAttentionSummary(input: {
  todayYmd: string;
  /** Surgery date for this context, if known (YYYY-MM-DD). */
  surgeryDateYmd: string | null;
  pathway: FiPaymentPathwayRow | null;
}): PaymentPathwayAttentionSummary {
  const { todayYmd, surgeryDateYmd, pathway } = input;

  if (!pathway) {
    return {
      hasActivePathway: false,
      pathway_id: null,
      pathway_type: null,
      pathway_status: null,
      provider: null,
      expected_settlement_date: null,
      pathway_attention_required: false,
      pathway_attention_reason: null,
    };
  }

  const expected = ymd(pathway.expected_settlement_date);
  const daysToSurgery = surgeryDateYmd ? daysBetween(todayYmd, surgeryDateYmd) : null;

  let reason: string | null = null;

  if (pathway.status === "rejected") {
    reason = "Pathway rejected";
  } else if (
    pathway.pathway_type === "medical_finance" &&
    pathway.status === "pending_provider" &&
    daysToSurgery != null &&
    daysToSurgery >= 0 &&
    daysToSurgery <= 14
  ) {
    reason = "Medical finance pending provider approval within 14 days of surgery";
  } else if (
    pathway.pathway_type === "super_release" &&
    pathway.status === "pending_patient_action" &&
    daysToSurgery != null &&
    daysToSurgery >= 0 &&
    daysToSurgery <= 14
  ) {
    reason = "Super release pending patient action within 14 days of surgery";
  } else if (
    pathway.pathway_type === "international_transfer" &&
    pathway.status === "settlement_pending" &&
    daysToSurgery != null &&
    daysToSurgery >= 0 &&
    daysToSurgery <= 7
  ) {
    reason = "International transfer settlement pending within 7 days of surgery";
  } else if (expected && expected < todayYmd && !isSettledLike(pathway.status) && pathway.status !== "settled") {
    reason = "Expected settlement date has passed and pathway is not settled";
  }

  return {
    hasActivePathway: true,
    pathway_id: pathway.id,
    pathway_type: pathway.pathway_type,
    pathway_status: pathway.status,
    provider: pathway.provider,
    expected_settlement_date: expected,
    pathway_attention_required: reason != null,
    pathway_attention_reason: reason,
  };
}
