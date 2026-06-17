import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readFiPaymentsEnabled, readFiPaymentProviderId } from "@/src/lib/payments/fiPaymentEnv.server";
import {
  createPaymentPathway,
  loadPaymentPathwaysForInvoice,
  updatePaymentPathwaySelection,
} from "@/src/lib/financialOs/financialPaymentPathways.server";
import type { FiPaymentPathwayStatus, FiPaymentPathwayType } from "@/src/lib/financialOs/financialPaymentPathwayCore";
import {
  PUBLIC_PAYMENT_PATHWAY_OPTIONS,
  buildPatientPathwayUpsertPayload,
  derivePublicPathwaySelectionRejectReason,
  getPatientPathwayConfirmationMessage,
  isDepositPaymentRequest,
  isPublicPathwaySelectionEligible,
  resolvePatientPathwayUpsertTarget,
  shouldContinueToCheckoutAfterSelection,
  type PublicPaymentPathwayOption,
} from "@/src/lib/financialOs/publicPaymentPathwaySelectionCore";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { isPaymentPublicTokenFormat } from "@/src/lib/revenueOs/publicPaymentRequestModel";

export type PublicPaymentPathwaySelectionView =
  | { ok: false; reason: "invalid_token" | "not_found" | "paid" | "cancelled" | "expired" }
  | {
      ok: true;
      eligible: boolean;
      publicToken: string;
      selectedPathwayType: FiPaymentPathwayType | null;
      selectedPathwayStatus: FiPaymentPathwayStatus | null;
      options: PublicPaymentPathwayOption[];
      checkoutUrl: string | null;
      showCheckoutForSelection: boolean;
      isDepositPaymentRequest: boolean;
      confirmationMessage: string | null;
    };

export type PublicPaymentPathwaySelectionResult =
  | { ok: false; error: string }
  | {
      ok: true;
      pathwayType: FiPaymentPathwayType;
      status: FiPaymentPathwayStatus;
      confirmationMessage: string | null;
      continueToCheckout: boolean;
      checkoutUrl: string | null;
    };

async function resolveBookingIdForInvoice(tenantId: string, invoice: FiInvoiceRow): Promise<string | null> {
  const supabase = supabaseAdmin();
  const cid = invoice.consultation_id?.trim();
  if (!cid) return null;
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("booking_id")
    .eq("tenant_id", tenantId)
    .eq("id", cid)
    .maybeSingle();
  if (error) return null;
  return (data as { booking_id?: string | null } | null)?.booking_id?.trim() || null;
}

type LoadedPaymentContext =
  | { ok: false; reason: "invalid_token" | "not_found" | "paid" | "cancelled" | "expired" }
  | {
      ok: true;
      paymentRequest: FiPaymentRequestRow;
      invoice: FiInvoiceRow;
      checkoutUrl: string | null;
    };

async function loadPaymentContextByToken(rawToken: string): Promise<LoadedPaymentContext> {
  const token = rawToken?.trim() ?? "";
  if (!isPaymentPublicTokenFormat(token)) return { ok: false, reason: "invalid_token" };

  const supabase = supabaseAdmin();
  const { data: prRaw, error: pe } = await supabase.from("fi_payment_requests").select("*").eq("public_token", token).maybeSingle();
  if (pe || !prRaw) return { ok: false, reason: "not_found" };
  const paymentRequest = mapPaymentRequestRow(prRaw as Record<string, unknown>);

  const { data: invRaw, error: ie } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", paymentRequest.tenant_id)
    .eq("id", paymentRequest.invoice_id)
    .maybeSingle();
  if (ie || !invRaw) return { ok: false, reason: "not_found" };
  const invoice = mapInvoiceRow(invRaw as Record<string, unknown>);

  const nowMs = Date.now();
  const reject = derivePublicPathwaySelectionRejectReason({
    rawToken: token,
    paymentRequestFound: true,
    paymentRequest,
    invoice,
    nowMs,
  });
  if (reject) return { ok: false, reason: reject };

  const stripeCheckoutEnabled = readFiPaymentsEnabled() && readFiPaymentProviderId() === "stripe";
  const checkoutUrl =
    stripeCheckoutEnabled && paymentRequest.checkout_url?.trim() ? paymentRequest.checkout_url.trim() : null;

  return { ok: true, paymentRequest, invoice, checkoutUrl };
}

export async function loadPublicPaymentPathwaySelectionByToken(rawToken: string): Promise<PublicPaymentPathwaySelectionView> {
  const ctx = await loadPaymentContextByToken(rawToken);
  if (!ctx.ok) return { ok: false, reason: ctx.reason };

  const { paymentRequest, invoice, checkoutUrl } = ctx;
  const nowMs = Date.now();
  const eligible = isPublicPathwaySelectionEligible({ paymentRequest, invoice, nowMs });
  const depositReq = isDepositPaymentRequest({ paymentRequest, invoice });

  const existing = await loadPaymentPathwaysForInvoice(paymentRequest.tenant_id, invoice.id);
  const target = resolvePatientPathwayUpsertTarget({
    existingPathways: existing,
    paymentRequestId: paymentRequest.id,
    invoiceId: invoice.id,
  });
  const active =
    target.pathwayId != null ? (existing.find((r) => r.id === target.pathwayId) ?? null) : null;

  const selectedType = active?.pathway_type ?? null;
  const selectedStatus = active?.status ?? null;
  const confirmationMessage = selectedType ? getPatientPathwayConfirmationMessage(selectedType) : null;

  return {
    ok: true,
    eligible,
    publicToken: paymentRequest.public_token,
    selectedPathwayType: selectedType,
    selectedPathwayStatus: selectedStatus,
    options: PUBLIC_PAYMENT_PATHWAY_OPTIONS,
    checkoutUrl,
    showCheckoutForSelection: selectedType
      ? shouldContinueToCheckoutAfterSelection({
          pathwayType: selectedType,
          checkoutUrl,
          isDepositPaymentRequest: depositReq,
        })
      : false,
    isDepositPaymentRequest: depositReq,
    confirmationMessage,
  };
}

export async function selectPublicPaymentPathwayForToken(
  rawToken: string,
  pathwayType: FiPaymentPathwayType
): Promise<PublicPaymentPathwaySelectionResult> {
  const ctx = await loadPaymentContextByToken(rawToken);
  if (!ctx.ok) {
    const messages: Record<typeof ctx.reason, string> = {
      invalid_token: "This payment link is not valid.",
      not_found: "This payment link is not valid.",
      paid: "This invoice is already paid.",
      cancelled: "This payment request was cancelled.",
      expired: "This payment link has expired.",
    };
    return { ok: false, error: messages[ctx.reason] };
  }

  const { paymentRequest, invoice, checkoutUrl } = ctx;
  const nowMs = Date.now();
  if (!isPublicPathwaySelectionEligible({ paymentRequest, invoice, nowMs })) {
    return { ok: false, error: "Pathway selection is not available for this payment link." };
  }

  const bookingId = await resolveBookingIdForInvoice(paymentRequest.tenant_id, invoice);
  const payload = buildPatientPathwayUpsertPayload({
    paymentRequest,
    invoice,
    bookingId,
    pathwayType,
  });

  const existing = await loadPaymentPathwaysForInvoice(paymentRequest.tenant_id, invoice.id);
  const target = resolvePatientPathwayUpsertTarget({
    existingPathways: existing,
    paymentRequestId: paymentRequest.id,
    invoiceId: invoice.id,
  });

  if (target.action === "update" && target.pathwayId) {
    await updatePaymentPathwaySelection({
      tenantId: payload.tenantId,
      pathwayId: target.pathwayId,
      pathwayType: payload.pathwayType,
      status: payload.status,
      source: payload.source,
      sourcePaymentRequestId: payload.sourcePaymentRequestId,
      currencyCode: payload.currencyCode,
      expectedAmountCents: payload.expectedAmountCents,
      metadataPatch: { patient_public_token: paymentRequest.public_token },
    });
  } else {
    await createPaymentPathway({
      tenantId: payload.tenantId,
      patientId: payload.patientId,
      caseId: payload.caseId,
      invoiceId: payload.invoiceId,
      bookingId: payload.bookingId,
      pathwayType: payload.pathwayType,
      status: payload.status,
      currencyCode: payload.currencyCode,
      expectedAmountCents: payload.expectedAmountCents,
      source: payload.source,
      sourcePaymentRequestId: payload.sourcePaymentRequestId,
      metadata: { patient_public_token: paymentRequest.public_token },
    });
  }

  const depositReq = isDepositPaymentRequest({ paymentRequest, invoice });
  const continueToCheckout = shouldContinueToCheckoutAfterSelection({
    pathwayType,
    checkoutUrl,
    isDepositPaymentRequest: depositReq,
  });

  return {
    ok: true,
    pathwayType,
    status: payload.status,
    confirmationMessage: getPatientPathwayConfirmationMessage(pathwayType),
    continueToCheckout,
    checkoutUrl: continueToCheckout ? checkoutUrl : null,
  };
}
