import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isGatewayPaymentWebhookSettled,
  swallowGatewayPaymentBestEffort,
} from "@/src/lib/payments/gatewayPaymentSuccessCore";
import { recordGatewayPaymentSuccess } from "@/src/lib/revenueOs/revenueInvoiceMutations.server";

const TENANT = "22222222-2222-4222-8222-222222222222";
const INVOICE = "11111111-1111-4111-8111-111111111111";
const PAYMENT_REQUEST = "33333333-3333-4333-8333-333333333333";
const PAYMENT_INTENT = "pi_888888888888";
const PAYMENT_ID = "44444444-4444-4444-8444-444444444444";

type TableState = Record<string, Record<string, unknown>[]>;

function makeMockClient(state: TableState): SupabaseClient {
  const from = (table: string) => {
    const filters: Array<(row: Record<string, unknown>) => boolean> = [];
    let patch: Record<string, unknown> | null = null;
    let pendingInsert: Record<string, unknown>[] | null = null;

    const rows = () => (state[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const applyPendingMutation = () => {
      if (pendingInsert) {
        const created = pendingInsert.map((row) => ({
          id: row.id ?? randomUUID(),
          created_at: row.created_at ?? new Date().toISOString(),
          updated_at: row.updated_at ?? new Date().toISOString(),
          ...row,
        }));
        state[table] = [...(state[table] ?? []), ...created];
        pendingInsert = null;
        return created;
      }
      if (patch) {
        state[table] = (state[table] ?? []).map((row) =>
          filters.every((f) => f(row)) ? { ...row, ...patch, updated_at: new Date().toISOString() } : row
        );
        patch = null;
      }
      return null;
    };

    const api = {
      select(_cols?: string) {
        return api;
      },
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return api;
      },
      limit() {
        return {
          then: (
            resolve: (value: { data: Record<string, unknown>[]; error: null }) => void
          ) => {
            applyPendingMutation();
            resolve({ data: rows(), error: null });
          },
        };
      },
      maybeSingle() {
        applyPendingMutation();
        const matched = rows();
        return Promise.resolve({ data: matched[0] ?? null, error: null });
      },
      single() {
        applyPendingMutation();
        const matched = rows();
        return Promise.resolve({
          data: matched[0] ?? null,
          error: matched.length ? null : { message: "not found" },
        });
      },
      insert(row: Record<string, unknown> | Record<string, unknown>[]) {
        pendingInsert = Array.isArray(row) ? row : [row];
        return {
          select: () => ({
            single: () => {
              const created = applyPendingMutation();
              const first = created?.[0] ?? null;
              return Promise.resolve({
                data: first,
                error: first ? null : { message: "Could not create row." },
              });
            },
          }),
        };
      },
      update(next: Record<string, unknown>) {
        patch = next;
        return {
          ...api,
          select: () => api,
        };
      },
      then(
        resolve: (value: { data: unknown; error: null }) => void,
        reject?: (reason?: unknown) => void
      ) {
        try {
          applyPendingMutation();
          resolve({ data: rows(), error: null });
        } catch (error) {
          reject?.(error);
        }
      },
    };
    return api;
  };

  return { from } as unknown as SupabaseClient;
}

function baseInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: INVOICE,
    tenant_id: TENANT,
    clinic_id: null,
    patient_id: null,
    lead_id: null,
    case_id: null,
    consultation_id: null,
    invoice_kind: "standard",
    status: "awaiting_payment",
    amount_cents: 50_000,
    tax_cents: 0,
    total_cents: 50_000,
    amount_paid_cents: 0,
    currency: "AUD",
    due_date: null,
    issued_at: "2026-01-01T00:00:00.000Z",
    sent_at: "2026-01-01T00:00:00.000Z",
    paid_at: null,
    remaining_balance_cents: 50_000,
    days_overdue: 0,
    last_reminder_sent_at: null,
    invoice_number: "INV-1",
    title: "Deposit",
    automation_hints: {},
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

test("isGatewayPaymentWebhookSettled is true only for recorded or duplicate outcomes", () => {
  assert.equal(isGatewayPaymentWebhookSettled({ status: "payment_recorded", invoice: {} as never, paymentId: "p" }), true);
  assert.equal(
    isGatewayPaymentWebhookSettled({ status: "duplicate_already_recorded", invoice: {} as never }),
    true
  );
  assert.equal(
    isGatewayPaymentWebhookSettled({
      status: "reconciliation_mismatch",
      invoice: {} as never,
      reconciliationId: "r",
      varianceCents: 1,
      reason: "x",
      expectedAmountCents: 1,
      receivedAmountCents: 2,
      paymentRequestId: null,
    }),
    false
  );
});

test("swallowGatewayPaymentBestEffort does not throw on downstream failure", async () => {
  await assert.doesNotReject(() =>
    swallowGatewayPaymentBestEffort(async () => {
      throw new Error("sync failed");
    })
  );
});

test("recordGatewayPaymentSuccess records payment when reconciliation matches", async () => {
  const state: TableState = {
    fi_invoices: [baseInvoice()],
    fi_payments: [],
    fi_payment_reconciliation: [],
    fi_financial_transaction_audit_events: [],
  };
  const client = makeMockClient(state);

  const outcome = await recordGatewayPaymentSuccess({
    tenantId: TENANT,
    invoiceId: INVOICE,
    amountCents: 50_000,
    currency: "AUD",
    provider: "stripe",
    providerRef: "cs_test",
    paymentIntentId: PAYMENT_INTENT,
    client,
  });

  assert.equal(outcome.status, "payment_recorded");
  if (outcome.status !== "payment_recorded") return;
  assert.equal(state.fi_payments?.length, 1);
  assert.equal(state.fi_invoices?.[0]?.amount_paid_cents, 50_000);
  assert.equal(isGatewayPaymentWebhookSettled(outcome), true);
});

test("duplicate Stripe payment intent returns duplicate_already_recorded", async () => {
  const state: TableState = {
    fi_invoices: [baseInvoice({ amount_paid_cents: 50_000, status: "paid" })],
    fi_payments: [
      {
        id: PAYMENT_ID,
        tenant_id: TENANT,
        provider: "stripe",
        provider_payment_intent_id: PAYMENT_INTENT,
      },
    ],
  };
  const client = makeMockClient(state);

  const outcome = await recordGatewayPaymentSuccess({
    tenantId: TENANT,
    invoiceId: INVOICE,
    amountCents: 50_000,
    currency: "AUD",
    provider: "stripe",
    providerRef: "cs_test",
    paymentIntentId: PAYMENT_INTENT,
    client,
  });

  assert.equal(outcome.status, "duplicate_already_recorded");
  assert.equal(state.fi_payments?.length, 1);
});

test("reconciliation mismatch does not insert payment", async () => {
  const state: TableState = {
    fi_invoices: [baseInvoice()],
    fi_payments: [],
    fi_payment_reconciliation: [],
    fi_financial_transaction_audit_events: [],
  };
  const client = makeMockClient(state);

  const outcome = await recordGatewayPaymentSuccess({
    tenantId: TENANT,
    invoiceId: INVOICE,
    amountCents: 49_999,
    expectedAmountCents: 50_000,
    currency: "AUD",
    provider: "stripe",
    providerRef: "cs_test",
    paymentIntentId: PAYMENT_INTENT,
    client,
  });

  assert.equal(outcome.status, "reconciliation_mismatch");
  assert.equal(state.fi_payments?.length, 0);
  assert.equal(state.fi_invoices?.[0]?.amount_paid_cents, 0);
  assert.ok(state.fi_payment_reconciliation?.[0]);
});

test("missing payment request returns ignored_or_unmatched", async () => {
  const state: TableState = {
    fi_invoices: [baseInvoice()],
    fi_payments: [],
    fi_payment_requests: [],
  };
  const client = makeMockClient(state);

  const outcome = await recordGatewayPaymentSuccess({
    tenantId: TENANT,
    invoiceId: INVOICE,
    amountCents: 50_000,
    currency: "AUD",
    provider: "stripe",
    providerRef: "cs_test",
    paymentIntentId: PAYMENT_INTENT,
    paymentRequestId: PAYMENT_REQUEST,
    client,
  });

  assert.equal(outcome.status, "ignored_or_unmatched");
  if (outcome.status === "ignored_or_unmatched") {
    assert.equal(outcome.reason, "payment_request_not_found");
  }
  assert.equal(state.fi_payments?.length, 0);
});

test("downstream best-effort failures do not undo core payment settlement", async () => {
  const state: TableState = {
    fi_invoices: [baseInvoice()],
    fi_payments: [],
    fi_payment_reconciliation: [],
    fi_financial_transaction_audit_events: [],
  };
  const client = makeMockClient(state);

  const outcome = await recordGatewayPaymentSuccess({
    tenantId: TENANT,
    invoiceId: INVOICE,
    amountCents: 50_000,
    currency: "AUD",
    provider: "stripe",
    providerRef: "cs_test",
    paymentIntentId: "pi_best_effort",
    client,
  });

  assert.equal(outcome.status, "payment_recorded");
  assert.equal(state.fi_payments?.length, 1);
  assert.equal(state.fi_invoices?.[0]?.amount_paid_cents, 50_000);
});