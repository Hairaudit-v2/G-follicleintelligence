import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { syncArFromReconciliationMismatch } from "@/src/lib/financialOs/financialAccountsReceivable.server";
import {
  compareReconciliationAmounts,
  mapPaymentReconciliationRow,
  type FiPaymentReconciliationRow,
  type FiPaymentReconciliationStatus,
} from "@/src/lib/financialOs/financialPaymentReconciliationCore";

export type RecordPaymentReconciliationArgs = {
  tenantId: string;
  clinicId?: string | null;
  paymentId?: string | null;
  invoiceId?: string | null;
  provider: string;
  providerTransactionId?: string | null;
  reconciliationStatus: FiPaymentReconciliationStatus;
  failureReason?: string | null;
  amountCents: number;
  expectedAmountCents?: number | null;
  receivedAmountCents?: number | null;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export type GatewayReconciliationOutcome =
  | { ok: true; reconciliation: FiPaymentReconciliationRow; matched: true }
  | { ok: true; reconciliation: FiPaymentReconciliationRow; matched: false; varianceCents: number }
  | { ok: false; reason: string };

async function appendReconciliationAuditEvent(args: {
  tenantId: string;
  financialTransactionId?: string | null;
  eventKind: "reconciliation_linked" | "reconciliation_mismatch";
  payload: Record<string, unknown>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_financial_transaction_audit_events").insert({
    tenant_id: args.tenantId.trim(),
    financial_transaction_id: args.financialTransactionId?.trim() || null,
    event_kind: args.eventKind,
    payload: args.payload,
  });
  if (error) throw new Error(error.message);
}

/**
 * Upsert provider reconciliation row keyed by tenant + provider + provider_transaction_id.
 */
export async function recordPaymentReconciliation(
  args: RecordPaymentReconciliationArgs
): Promise<FiPaymentReconciliationRow> {
  const tid = args.tenantId.trim();
  const provider = args.provider.trim().toLowerCase();
  const providerTxId = args.providerTransactionId?.trim() || null;
  const supabase = supabaseAdmin();
  const expected =
    args.expectedAmountCents != null ? Math.max(0, Math.floor(args.expectedAmountCents)) : null;
  const received =
    args.receivedAmountCents != null ? Math.max(0, Math.floor(args.receivedAmountCents)) : null;

  if (providerTxId) {
    const { data: existing } = await supabase
      .from("fi_payment_reconciliation")
      .select("*")
      .eq("tenant_id", tid)
      .eq("provider", provider)
      .eq("provider_transaction_id", providerTxId)
      .maybeSingle();
    if (existing) {
      const { data: upd, error } = await supabase
        .from("fi_payment_reconciliation")
        .update({
          payment_id:
            args.paymentId?.trim() ||
            ((existing as { payment_id?: string | null }).payment_id ?? null),
          invoice_id:
            args.invoiceId?.trim() ||
            ((existing as { invoice_id?: string | null }).invoice_id ?? null),
          reconciliation_status: args.reconciliationStatus,
          failure_reason: args.failureReason?.trim() || null,
          amount_cents: Math.max(0, Math.floor(args.amountCents)),
          expected_amount_cents:
            expected ??
            (existing as { expected_amount_cents?: number | null }).expected_amount_cents ??
            null,
          received_amount_cents:
            received ??
            (existing as { received_amount_cents?: number | null }).received_amount_cents ??
            null,
          currency: (args.currency ?? "AUD").trim().toUpperCase(),
          metadata: {
            ...((existing as { metadata?: Record<string, unknown> }).metadata ?? {}),
            ...(args.metadata ?? {}),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tid)
        .eq("id", String((existing as { id: string }).id))
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return mapPaymentReconciliationRow(upd as Record<string, unknown>);
    }
  }

  const { data, error } = await supabase
    .from("fi_payment_reconciliation")
    .insert({
      tenant_id: tid,
      clinic_id: args.clinicId?.trim() || null,
      payment_id: args.paymentId?.trim() || null,
      invoice_id: args.invoiceId?.trim() || null,
      provider,
      provider_transaction_id: providerTxId,
      reconciliation_status: args.reconciliationStatus,
      failure_reason: args.failureReason?.trim() || null,
      amount_cents: Math.max(0, Math.floor(args.amountCents)),
      expected_amount_cents: expected,
      received_amount_cents: received,
      currency: (args.currency ?? "AUD").trim().toUpperCase(),
      metadata: args.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapPaymentReconciliationRow(data as Record<string, unknown>);
}

/**
 * Compare expected vs received; on mismatch create unmatched reconciliation + audit (no invoice settlement).
 */
export async function reconcileGatewayPaymentAmounts(args: {
  tenantId: string;
  clinicId?: string | null;
  invoiceId: string;
  provider: string;
  providerTransactionId?: string | null;
  expectedAmountCents: number;
  receivedAmountCents: number;
  currency: string;
  paymentId?: string | null;
}): Promise<GatewayReconciliationOutcome> {
  const check = compareReconciliationAmounts(args.expectedAmountCents, args.receivedAmountCents);
  const tid = args.tenantId.trim();

  if (!check.matched) {
    const reconciliation = await recordPaymentReconciliation({
      tenantId: tid,
      clinicId: args.clinicId,
      invoiceId: args.invoiceId,
      paymentId: null,
      provider: args.provider,
      providerTransactionId: args.providerTransactionId,
      reconciliationStatus: "unmatched",
      failureReason: `Amount mismatch: expected ${check.expectedCents}¢, received ${check.receivedCents}¢`,
      amountCents: check.receivedCents,
      expectedAmountCents: check.expectedCents,
      receivedAmountCents: check.receivedCents,
      currency: args.currency,
      metadata: { variance_cents: check.varianceCents, needs_review: true },
    });

    await appendReconciliationAuditEvent({
      tenantId: tid,
      eventKind: "reconciliation_mismatch",
      payload: {
        reconciliation_id: reconciliation.id,
        invoice_id: args.invoiceId,
        expected_amount_cents: check.expectedCents,
        received_amount_cents: check.receivedCents,
        variance_cents: check.varianceCents,
      },
    });

    try {
      await syncArFromReconciliationMismatch({
        tenantId: tid,
        invoiceId: args.invoiceId,
        todayYmd: new Date().toISOString().slice(0, 10),
        reconciliationId: reconciliation.id,
      });
    } catch {
      /* AR best-effort */
    }

    return { ok: true, reconciliation, matched: false, varianceCents: check.varianceCents };
  }

  const reconciliation = await recordPaymentReconciliation({
    tenantId: tid,
    clinicId: args.clinicId,
    paymentId: args.paymentId ?? null,
    invoiceId: args.invoiceId,
    provider: args.provider,
    providerTransactionId: args.providerTransactionId,
    reconciliationStatus: "matched",
    amountCents: check.receivedCents,
    expectedAmountCents: check.expectedCents,
    receivedAmountCents: check.receivedCents,
    currency: args.currency,
    metadata: { outcome: "success" },
  });

  await appendReconciliationAuditEvent({
    tenantId: tid,
    eventKind: "reconciliation_linked",
    payload: {
      reconciliation_id: reconciliation.id,
      payment_id: args.paymentId ?? null,
      invoice_id: args.invoiceId,
    },
  });

  return { ok: true, reconciliation, matched: true };
}

export async function recordGatewayPaymentReconciliationSuccess(args: {
  tenantId: string;
  clinicId?: string | null;
  paymentId: string;
  invoiceId: string;
  provider: string;
  providerTransactionId?: string | null;
  amountCents: number;
  currency: string;
  expectedAmountCents?: number | null;
}): Promise<FiPaymentReconciliationRow> {
  const expected = args.expectedAmountCents ?? args.amountCents;
  const outcome = await reconcileGatewayPaymentAmounts({
    tenantId: args.tenantId,
    clinicId: args.clinicId,
    invoiceId: args.invoiceId,
    provider: args.provider,
    providerTransactionId: args.providerTransactionId,
    expectedAmountCents: expected,
    receivedAmountCents: args.amountCents,
    currency: args.currency,
    paymentId: args.paymentId,
  });
  if (!outcome.ok) throw new Error(outcome.reason);
  if (!outcome.matched) {
    throw new Error(`Reconciliation mismatch: variance ${outcome.varianceCents}¢`);
  }
  return outcome.reconciliation;
}

export async function recordGatewayPaymentReconciliationFailure(args: {
  tenantId: string;
  clinicId?: string | null;
  invoiceId?: string | null;
  provider: string;
  providerTransactionId?: string | null;
  failureReason: string;
  amountCents?: number;
  currency?: string;
}): Promise<FiPaymentReconciliationRow> {
  return recordPaymentReconciliation({
    tenantId: args.tenantId,
    clinicId: args.clinicId,
    invoiceId: args.invoiceId ?? null,
    provider: args.provider,
    providerTransactionId: args.providerTransactionId,
    reconciliationStatus: "failed",
    failureReason: args.failureReason,
    amountCents: args.amountCents ?? 0,
    currency: args.currency ?? "AUD",
    metadata: { outcome: "failure" },
  });
}
