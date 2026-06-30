/** FinancialOS Phase 1 — payment provider reconciliation types. */

export const FI_PAYMENT_RECONCILIATION_STATUSES = [
  "pending",
  "matched",
  "unmatched",
  "failed",
  "disputed",
] as const;
export type FiPaymentReconciliationStatus = (typeof FI_PAYMENT_RECONCILIATION_STATUSES)[number];

export type FiPaymentReconciliationRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  payment_id: string | null;
  invoice_id: string | null;
  provider: string;
  provider_transaction_id: string | null;
  reconciliation_status: FiPaymentReconciliationStatus;
  failure_reason: string | null;
  amount_cents: number;
  expected_amount_cents: number | null;
  received_amount_cents: number | null;
  currency: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ReconciliationAmountCheckResult =
  | { matched: true; expectedCents: number; receivedCents: number }
  | { matched: false; expectedCents: number; receivedCents: number; varianceCents: number };

export function compareReconciliationAmounts(
  expectedAmountCents: number,
  receivedAmountCents: number
): ReconciliationAmountCheckResult {
  const expected = Math.max(0, Math.floor(expectedAmountCents));
  const received = Math.max(0, Math.floor(receivedAmountCents));
  if (expected === received) {
    return { matched: true, expectedCents: expected, receivedCents: received };
  }
  return {
    matched: false,
    expectedCents: expected,
    receivedCents: received,
    varianceCents: received - expected,
  };
}

export function mapPaymentReconciliationRow(
  raw: Record<string, unknown>
): FiPaymentReconciliationRow {
  const metadata =
    raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
      ? (raw.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    payment_id: raw.payment_id != null ? String(raw.payment_id) : null,
    invoice_id: raw.invoice_id != null ? String(raw.invoice_id) : null,
    provider: String(raw.provider ?? ""),
    provider_transaction_id:
      raw.provider_transaction_id != null ? String(raw.provider_transaction_id) : null,
    reconciliation_status: String(
      raw.reconciliation_status ?? "pending"
    ) as FiPaymentReconciliationStatus,
    failure_reason: raw.failure_reason != null ? String(raw.failure_reason) : null,
    amount_cents: Number(raw.amount_cents ?? 0),
    expected_amount_cents:
      raw.expected_amount_cents != null ? Number(raw.expected_amount_cents) : null,
    received_amount_cents:
      raw.received_amount_cents != null ? Number(raw.received_amount_cents) : null,
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    metadata,
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}
