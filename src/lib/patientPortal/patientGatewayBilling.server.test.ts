import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import type { FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

import {
  createPatientGatewayPaymentSession,
  getPatientGatewayInvoice,
  listPatientGatewayInvoices,
  loadPatientGatewayBillingSummary,
  requirePatientGatewayOwnedInvoice,
} from "./patientGatewayBilling.server";
import { billingPayloadExposesInternalFields } from "./patientGatewayBillingCore";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const AUTH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const INV_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const INV_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const CTX_A: PatientGatewayContext = {
  authUserId: AUTH_A,
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

function invoice(overrides: Partial<FiInvoiceRow> = {}): FiInvoiceRow {
  return {
    id: INV_A,
    tenant_id: TENANT_A,
    clinic_id: null,
    patient_id: PATIENT_A,
    lead_id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
    case_id: null,
    consultation_id: null,
    invoice_kind: "surgery_balance",
    status: "awaiting_payment",
    amount_cents: 800000,
    tax_cents: 0,
    total_cents: 800000,
    amount_paid_cents: 600000,
    currency: "AUD",
    due_date: "2026-08-01",
    issued_at: "2026-07-01T00:00:00.000Z",
    sent_at: "2026-07-01T00:00:00.000Z",
    paid_at: null,
    remaining_balance_cents: 200000,
    days_overdue: 0,
    last_reminder_sent_at: null,
    invoice_number: "INV-1234",
    title: "Hair restoration",
    automation_hints: {},
    metadata: { internal_margin: 99 },
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function createInvoiceMock(row: FiInvoiceRow | null, payments: Record<string, unknown>[] = []) {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        maybeSingle: async () => {
          if (table === "fi_invoices") return { data: row, error: null };
          return { data: null, error: null };
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (table === "fi_invoice_items") {
            return Promise.resolve(
              resolve({
                data: [
                  {
                    id: "99999999-9999-4999-8999-999999999999",
                    tenant_id: TENANT_A,
                    invoice_id: INV_A,
                    sort_index: 0,
                    description: "Hair restoration procedure",
                    quantity: 1,
                    unit_amount_cents: 800000,
                    line_tax_cents: 0,
                    line_total_cents: 800000,
                    metadata: {},
                  },
                ],
                error: null,
              })
            );
          }
          if (table === "fi_payments") {
            return Promise.resolve(resolve({ data: payments, error: null }));
          }
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return builder;
    },
  };
}

describe("patientGatewayBilling.server", () => {
  it("A. Patient A reads own account summary", async () => {
    const result = await loadPatientGatewayBillingSummary(CTX_A, {
      writeAudit: false,
      loadSummary: async () => ({
        invoices: [invoice()],
        outstandingCentsAud: 200000,
        unpaidOpenCount: 1,
        overdueCount: 0,
      }),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.outstandingBalance, 2000);
    assert.equal(billingPayloadExposesInternalFields(result), false);
  });

  it("B. Patient A lists only own invoices", async () => {
    const result = await listPatientGatewayInvoices(CTX_A, {
      writeAudit: false,
      loadSummary: async (tenantId, patientId) => {
        assert.equal(tenantId, TENANT_A);
        assert.equal(patientId, PATIENT_A);
        return {
          invoices: [invoice(), invoice({ id: "99999999-9999-4999-8999-999999999999", status: "paid", amount_paid_cents: 800000 })],
          outstandingCentsAud: 200000,
          unpaidOpenCount: 1,
          overdueCount: 0,
        };
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.invoices.length, 2);
    assert.ok(result.invoices.every((i) => i.id !== INV_B));
  });

  it("C. Patient A reads own invoice", async () => {
    const result = await getPatientGatewayInvoice(CTX_A, INV_A, {
      writeAudit: false,
      supabase: createInvoiceMock(invoice()) as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.invoice.id, INV_A);
    assert.equal(result.invoice.lineItems[0]?.description, "Hair restoration procedure");
    assert.equal(billingPayloadExposesInternalFields(result), false);
  });

  it("D/L. Patient A cannot read/pay Patient B invoice", async () => {
    const read = await getPatientGatewayInvoice(CTX_A, INV_B, {
      writeAudit: false,
      supabase: createInvoiceMock(
        invoice({ id: INV_B, tenant_id: TENANT_B, patient_id: PATIENT_B })
      ) as never,
    });
    assert.equal(read.ok, false);

    const prevEnabled = process.env.FI_PAYMENTS_ENABLED;
    const prevProvider = process.env.FI_PAYMENT_PROVIDER;
    process.env.FI_PAYMENTS_ENABLED = "true";
    process.env.FI_PAYMENT_PROVIDER = "stripe";
    try {
      const pay = await createPatientGatewayPaymentSession(CTX_A, INV_B, {}, {
        writeAudit: false,
        supabase: createInvoiceMock(
          invoice({ id: INV_B, tenant_id: TENANT_B, patient_id: PATIENT_B })
        ) as never,
        createPaymentRequest: async () => {
          throw new Error("should not create");
        },
      });
      assert.equal(pay.ok, false);
    } finally {
      process.env.FI_PAYMENTS_ENABLED = prevEnabled;
      process.env.FI_PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("E. wrong tenant invoice denied", async () => {
    const result = await getPatientGatewayInvoice(CTX_A, INV_A, {
      writeAudit: false,
      supabase: createInvoiceMock(
        invoice({ tenant_id: TENANT_B, patient_id: PATIENT_A })
      ) as never,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "wrong_tenant");
  });

  it("F. orphaned invoice not exposed", async () => {
    const result = await getPatientGatewayInvoice(CTX_A, INV_A, {
      writeAudit: false,
      supabase: createInvoiceMock(invoice({ patient_id: null })) as never,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
  });

  it("G/O. ownership wrapper ignores foreign patient id", () => {
    const deny = requirePatientGatewayOwnedInvoice(
      CTX_A,
      { tenant_id: TENANT_A, patient_id: PATIENT_B },
      INV_A,
      false
    );
    assert.equal(deny?.code, "ownership_denied");
  });

  it("I. valid outstanding invoice creates payment session", async () => {
    const prevEnabled = process.env.FI_PAYMENTS_ENABLED;
    const prevProvider = process.env.FI_PAYMENT_PROVIDER;
    process.env.FI_PAYMENTS_ENABLED = "true";
    process.env.FI_PAYMENT_PROVIDER = "stripe";
    try {
      const result = await createPatientGatewayPaymentSession(CTX_A, INV_A, {}, {
        writeAudit: false,
        supabase: createInvoiceMock(invoice()) as never,
        createPaymentRequest: async (args) => {
          assert.equal(args.tenantId, TENANT_A);
          assert.equal(args.invoiceId, INV_A);
          assert.equal(args.amountCents, 200000);
          assert.equal(args.send, true);
          return {
            id: "pr-1",
            tenant_id: TENANT_A,
            invoice_id: INV_A,
            status: "sent",
            amount_cents: 200000,
            tax_cents: 0,
            total_cents: 200000,
            currency: "AUD",
            public_token: "tok",
            sent_at: "2026-07-27T00:00:00.000Z",
            viewed_at: null,
            checkout_url: "https://checkout.stripe.test/session",
            provider: "stripe",
            provider_checkout_session_id: "cs_test",
            expires_at: "2026-07-28T00:00:00.000Z",
            metadata: {},
            created_at: "2026-07-27T00:00:00.000Z",
            updated_at: "2026-07-27T00:00:00.000Z",
          } satisfies FiPaymentRequestRow;
        },
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal(result.checkoutUrl, "https://checkout.stripe.test/session");
      assert.equal(result.amount, 2000);
    } finally {
      process.env.FI_PAYMENTS_ENABLED = prevEnabled;
      process.env.FI_PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("J/K. paid or void invoices cannot create payment session", async () => {
    const prevEnabled = process.env.FI_PAYMENTS_ENABLED;
    const prevProvider = process.env.FI_PAYMENT_PROVIDER;
    process.env.FI_PAYMENTS_ENABLED = "true";
    process.env.FI_PAYMENT_PROVIDER = "stripe";
    try {
      const paid = await createPatientGatewayPaymentSession(CTX_A, INV_A, {}, {
        writeAudit: false,
        supabase: createInvoiceMock(
          invoice({ status: "paid", amount_paid_cents: 800000 })
        ) as never,
        createPaymentRequest: async () => {
          throw new Error("should not create");
        },
      });
      assert.equal(paid.ok, false);
      if (!paid.ok) assert.equal(paid.code, "invoice_not_payable");

      const voided = await createPatientGatewayPaymentSession(CTX_A, INV_A, {}, {
        writeAudit: false,
        supabase: createInvoiceMock(invoice({ status: "cancelled" })) as never,
        createPaymentRequest: async () => {
          throw new Error("should not create");
        },
      });
      assert.equal(voided.ok, false);
      if (!voided.ok) assert.equal(voided.code, "invoice_not_payable");
    } finally {
      process.env.FI_PAYMENTS_ENABLED = prevEnabled;
      process.env.FI_PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("M/N. client amount/currency tampering denied", async () => {
    const prevEnabled = process.env.FI_PAYMENTS_ENABLED;
    const prevProvider = process.env.FI_PAYMENT_PROVIDER;
    process.env.FI_PAYMENTS_ENABLED = "true";
    process.env.FI_PAYMENT_PROVIDER = "stripe";
    try {
      const amount = await createPatientGatewayPaymentSession(
        CTX_A,
        INV_A,
        { clientAmountMajor: 1 },
        {
          writeAudit: false,
          supabase: createInvoiceMock(invoice()) as never,
          createPaymentRequest: async () => {
            throw new Error("should not create");
          },
        }
      );
      assert.equal(amount.ok, false);
      if (!amount.ok) assert.equal(amount.code, "amount_mismatch");

      const currency = await createPatientGatewayPaymentSession(
        CTX_A,
        INV_A,
        { clientCurrency: "USD" },
        {
          writeAudit: false,
          supabase: createInvoiceMock(invoice()) as never,
          createPaymentRequest: async () => {
            throw new Error("should not create");
          },
        }
      );
      assert.equal(currency.ok, false);
      if (!currency.ok) assert.equal(currency.code, "currency_mismatch");
    } finally {
      process.env.FI_PAYMENTS_ENABLED = prevEnabled;
      process.env.FI_PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("W. payment session does not mark invoice paid", async () => {
    const prevEnabled = process.env.FI_PAYMENTS_ENABLED;
    const prevProvider = process.env.FI_PAYMENT_PROVIDER;
    process.env.FI_PAYMENTS_ENABLED = "true";
    process.env.FI_PAYMENT_PROVIDER = "stripe";
    try {
      const result = await createPatientGatewayPaymentSession(CTX_A, INV_A, {}, {
        writeAudit: false,
        supabase: createInvoiceMock(invoice()) as never,
        createPaymentRequest: async () =>
          ({
            id: "pr-1",
            tenant_id: TENANT_A,
            invoice_id: INV_A,
            status: "sent",
            amount_cents: 200000,
            tax_cents: 0,
            total_cents: 200000,
            currency: "AUD",
            public_token: "tok",
            sent_at: null,
            viewed_at: null,
            checkout_url: "https://checkout.stripe.test/session",
            provider: "stripe",
            provider_checkout_session_id: "cs_test",
            expires_at: null,
            metadata: {},
            created_at: "2026-07-27T00:00:00.000Z",
            updated_at: "2026-07-27T00:00:00.000Z",
          }) as FiPaymentRequestRow,
      });
      assert.equal(result.ok, true);
      if (!result.ok) return;
      assert.equal("status" in result && (result as { status?: string }).status === "paid", false);
      assert.ok(!("paid" in result));
    } finally {
      process.env.FI_PAYMENTS_ENABLED = prevEnabled;
      process.env.FI_PAYMENT_PROVIDER = prevProvider;
    }
  });

  it("AA/AB. revenue + portal surfaces remain available", async () => {
    const loaders = await import("@/src/lib/revenueOs/revenueInvoiceLoaders.server");
    assert.equal(typeof loaders.loadPatientInvoiceSummary, "function");
    const mutations = await import("@/src/lib/revenueOs/revenueInvoiceMutations.server");
    assert.equal(typeof mutations.createPaymentRequestForInvoice, "function");
    const portal = await import("@/src/lib/patientPortal/patientPortalAccess.server");
    assert.ok(portal);
  });
});
