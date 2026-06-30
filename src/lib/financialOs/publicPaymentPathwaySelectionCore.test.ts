import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { FiPaymentPathwayRow } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import type { FiPaymentPathwaySource } from "@/src/lib/financialOs/publicPaymentPathwaySelectionCore";
import {
  buildPatientPathwayUpsertPayload,
  derivePublicPathwaySelectionRejectReason,
  getPatientPathwayConfirmationMessage,
  isDepositPaymentRequest,
  isPublicPathwaySelectionEligible,
  mapPatientPathwayTypeToStatus,
  resolvePatientPathwayUpsertTarget,
  shouldContinueToCheckoutAfterSelection,
} from "@/src/lib/financialOs/publicPaymentPathwaySelectionCore";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";

function baseInvoice(overrides: Partial<FiInvoiceRow> = {}): FiInvoiceRow {
  return {
    id: "inv-1",
    tenant_id: "tenant-1",
    clinic_id: null,
    patient_id: "patient-1",
    lead_id: null,
    case_id: "case-1",
    consultation_id: null,
    invoice_kind: "consultation_quote",
    status: "awaiting_payment",
    amount_cents: 10000,
    tax_cents: 0,
    total_cents: 10000,
    amount_paid_cents: 0,
    currency: "AUD",
    due_date: null,
    issued_at: null,
    sent_at: null,
    paid_at: null,
    remaining_balance_cents: 10000,
    days_overdue: 0,
    last_reminder_sent_at: null,
    invoice_number: null,
    title: "Quote",
    automation_hints: {},
    metadata: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function basePaymentRequest(overrides: Partial<FiPaymentRequestRow> = {}): FiPaymentRequestRow {
  return {
    id: "pr-1",
    tenant_id: "tenant-1",
    invoice_id: "inv-1",
    status: "sent",
    amount_cents: 10000,
    tax_cents: 0,
    total_cents: 10000,
    currency: "AUD",
    public_token: "a".repeat(36),
    sent_at: null,
    viewed_at: null,
    checkout_url: "https://checkout.stripe.test/session",
    provider: "stripe",
    provider_checkout_session_id: null,
    expires_at: null,
    metadata: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

function basePathway(
  overrides: Partial<
    FiPaymentPathwayRow & {
      source?: FiPaymentPathwaySource;
      source_payment_request_id?: string | null;
    }
  > = {}
): FiPaymentPathwayRow & {
  source?: FiPaymentPathwaySource;
  source_payment_request_id?: string | null;
} {
  return {
    id: "pw-1",
    pathway_type: "installment_plan",
    status: "pending_clinic_action",
    provider: null,
    provider_reference: null,
    expected_settlement_date: null,
    actual_settlement_date: null,
    expected_amount_cents: 10000,
    settled_amount_cents: null,
    currency_code: "AUD",
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    source: "patient_public_token",
    source_payment_request_id: "pr-1",
    ...overrides,
  };
}

describe("publicPaymentPathwaySelectionCore", () => {
  it("rejects invalid token format", () => {
    const reason = derivePublicPathwaySelectionRejectReason({
      rawToken: "not-valid",
      paymentRequestFound: false,
      paymentRequest: null,
      invoice: null,
      nowMs: Date.now(),
    });
    assert.equal(reason, "invalid_token");
  });

  it("rejects expired payment request", () => {
    const pr = basePaymentRequest({ expires_at: "2020-01-01T00:00:00Z", status: "sent" });
    const inv = baseInvoice();
    const reason = derivePublicPathwaySelectionRejectReason({
      rawToken: pr.public_token,
      paymentRequestFound: true,
      paymentRequest: pr,
      invoice: inv,
      nowMs: Date.parse("2026-06-17T12:00:00Z"),
    });
    assert.equal(reason, "expired");
  });

  it("rejects paid invoice", () => {
    const pr = basePaymentRequest({ status: "paid" });
    const inv = baseInvoice({ amount_paid_cents: 10000, status: "paid" });
    const reason = derivePublicPathwaySelectionRejectReason({
      rawToken: pr.public_token,
      paymentRequestFound: true,
      paymentRequest: pr,
      invoice: inv,
      nowMs: Date.now(),
    });
    assert.equal(reason, "paid");
  });

  it("allows eligible unpaid token", () => {
    const pr = basePaymentRequest();
    const inv = baseInvoice();
    assert.equal(
      isPublicPathwaySelectionEligible({ paymentRequest: pr, invoice: inv, nowMs: Date.now() }),
      true
    );
  });

  it("maps installment selection to pending_clinic_action", () => {
    assert.equal(mapPatientPathwayTypeToStatus("installment_plan"), "pending_clinic_action");
  });

  it("maps super release to pending_patient_action", () => {
    assert.equal(mapPatientPathwayTypeToStatus("super_release"), "pending_patient_action");
  });

  it("derives tenant/invoice/patient from payment request and invoice", () => {
    const pr = basePaymentRequest();
    const inv = baseInvoice();
    const payload = buildPatientPathwayUpsertPayload({
      paymentRequest: pr,
      invoice: inv,
      bookingId: null,
      pathwayType: "installment_plan",
    });
    assert.equal(payload.tenantId, "tenant-1");
    assert.equal(payload.invoiceId, "inv-1");
    assert.equal(payload.patientId, "patient-1");
    assert.equal(payload.caseId, "case-1");
    assert.equal(payload.sourcePaymentRequestId, "pr-1");
    assert.equal(payload.source, "patient_public_token");
    assert.equal(payload.status, "pending_clinic_action");
  });

  it("updates existing pathway for same payment request instead of creating duplicate", () => {
    const existing = [
      basePathway({ id: "pw-existing", source_payment_request_id: "pr-1" }),
      basePathway({ id: "pw-other", source_payment_request_id: "pr-2", status: "cancelled" }),
    ];
    const target = resolvePatientPathwayUpsertTarget({
      existingPathways: existing,
      paymentRequestId: "pr-1",
      invoiceId: "inv-1",
    });
    assert.equal(target.action, "update");
    assert.equal(target.pathwayId, "pw-existing");
  });

  it("creates when no patient pathway exists for token", () => {
    const existing = [
      basePathway({
        id: "pw-staff",
        source: "staff",
        source_payment_request_id: null,
        status: "selected",
      }),
    ];
    const target = resolvePatientPathwayUpsertTarget({
      existingPathways: existing,
      paymentRequestId: "pr-99",
      invoiceId: "inv-1",
    });
    assert.equal(target.action, "create");
    assert.equal(target.pathwayId, null);
  });

  it("pay_in_full continues to checkout when checkout URL present", () => {
    assert.equal(
      shouldContinueToCheckoutAfterSelection({
        pathwayType: "pay_in_full",
        checkoutUrl: "https://checkout.stripe.test/session",
        isDepositPaymentRequest: false,
      }),
      true
    );
  });

  it("installment plan does not continue to checkout", () => {
    assert.equal(
      shouldContinueToCheckoutAfterSelection({
        pathwayType: "installment_plan",
        checkoutUrl: "https://checkout.stripe.test/session",
        isDepositPaymentRequest: false,
      }),
      false
    );
    assert.equal(
      getPatientPathwayConfirmationMessage("installment_plan"),
      "Your clinic will review this request and contact you."
    );
  });

  it("detects deposit payment request when amount below balance", () => {
    const pr = basePaymentRequest({ total_cents: 3000 });
    const inv = baseInvoice({ total_cents: 10000 });
    assert.equal(isDepositPaymentRequest({ paymentRequest: pr, invoice: inv }), true);
  });

  it("deposit_balance continues checkout for deposit payment request", () => {
    assert.equal(
      shouldContinueToCheckoutAfterSelection({
        pathwayType: "deposit_balance",
        checkoutUrl: "https://checkout.stripe.test/session",
        isDepositPaymentRequest: true,
      }),
      true
    );
  });
});
