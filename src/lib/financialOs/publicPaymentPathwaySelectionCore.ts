/**
 * Pure FinancialOS Phase 2B logic — patient pathway selection from public payment token.
 * Safe for unit tests without DB.
 */

import {
  resolveActivePaymentPathway,
  type FiPaymentPathwayRow,
  type FiPaymentPathwayStatus,
  type FiPaymentPathwayType,
} from "@/src/lib/financialOs/financialPaymentPathwayCore";
import {
  invoiceBalanceDueCents,
  type FiInvoiceRow,
  type FiPaymentRequestRow,
} from "@/src/lib/revenueOs/revenueInvoiceModel";
import {
  derivePublicPaymentPageState,
  isPaymentPublicTokenFormat,
} from "@/src/lib/revenueOs/publicPaymentRequestModel";

export type FiPaymentPathwaySource = "staff" | "patient_public_token" | "system";

export const PUBLIC_PATIENT_PATHWAY_TYPES: FiPaymentPathwayType[] = [
  "pay_in_full",
  "deposit_balance",
  "installment_plan",
  "medical_finance",
  "super_release",
  "international_transfer",
  "manual",
];

export type PublicPaymentPathwayOption = {
  pathwayType: FiPaymentPathwayType;
  title: string;
  description: string;
};

export const PUBLIC_PAYMENT_PATHWAY_OPTIONS: PublicPaymentPathwayOption[] = [
  {
    pathwayType: "pay_in_full",
    title: "Pay in full now",
    description: "Complete your payment securely now.",
  },
  {
    pathwayType: "deposit_balance",
    title: "Pay deposit now, balance later",
    description: "Secure your booking now and pay the remaining balance before your procedure.",
  },
  {
    pathwayType: "installment_plan",
    title: "Request installment plan",
    description: "Ask the clinic to review a staged payment option.",
  },
  {
    pathwayType: "medical_finance",
    title: "Medical finance",
    description: "Ask the clinic to guide you through finance options.",
  },
  {
    pathwayType: "super_release",
    title: "Superannuation release",
    description: "Request guidance for eligible medical superannuation release pathways.",
  },
  {
    pathwayType: "international_transfer",
    title: "International transfer",
    description: "Request international transfer details.",
  },
  {
    pathwayType: "manual",
    title: "Other / speak to clinic",
    description: "Ask the clinic to contact you about payment options.",
  },
];

export type PublicPathwaySelectionRejectReason =
  | "invalid_token"
  | "not_found"
  | "paid"
  | "cancelled"
  | "expired";

export function mapPatientPathwayTypeToStatus(
  pathwayType: FiPaymentPathwayType
): FiPaymentPathwayStatus {
  switch (pathwayType) {
    case "pay_in_full":
    case "deposit_balance":
      return "selected";
    case "installment_plan":
    case "international_transfer":
    case "manual":
      return "pending_clinic_action";
    case "medical_finance":
      return "pending_clinic_action";
    case "super_release":
      return "pending_patient_action";
    default:
      return "selected";
  }
}

export function getPatientPathwayConfirmationMessage(
  pathwayType: FiPaymentPathwayType
): string | null {
  switch (pathwayType) {
    case "pay_in_full":
    case "deposit_balance":
      return null;
    case "installment_plan":
      return "Your clinic will review this request and contact you.";
    case "medical_finance":
      return "Your clinic will send the next steps.";
    case "super_release":
      return "Your clinic will guide you through the required documentation.";
    case "international_transfer":
      return "Your clinic will send international payment instructions.";
    case "manual":
      return "Your clinic will contact you about payment options.";
    default:
      return null;
  }
}

export function isDepositPaymentRequest(input: {
  paymentRequest: Pick<FiPaymentRequestRow, "total_cents">;
  invoice: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents" | "invoice_kind">;
}): boolean {
  const { paymentRequest: pr, invoice: inv } = input;
  if (inv.invoice_kind === "surgery_deposit") return true;
  const balance = invoiceBalanceDueCents(inv);
  return pr.total_cents > 0 && balance > 0 && pr.total_cents < balance;
}

export function shouldContinueToCheckoutAfterSelection(input: {
  pathwayType: FiPaymentPathwayType;
  checkoutUrl: string | null;
  isDepositPaymentRequest: boolean;
}): boolean {
  if (!input.checkoutUrl?.trim()) return false;
  if (input.pathwayType === "pay_in_full") return true;
  if (input.pathwayType === "deposit_balance" && input.isDepositPaymentRequest) return true;
  return false;
}

export function derivePublicPathwaySelectionRejectReason(input: {
  rawToken: string;
  paymentRequestFound: boolean;
  paymentRequest: FiPaymentRequestRow | null;
  invoice: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents" | "status"> | null;
  nowMs: number;
}): PublicPathwaySelectionRejectReason | null {
  const token = input.rawToken?.trim() ?? "";
  if (!isPaymentPublicTokenFormat(token)) return "invalid_token";
  if (!input.paymentRequestFound || !input.paymentRequest || !input.invoice) return "not_found";

  const state = derivePublicPaymentPageState({
    paymentRequest: input.paymentRequest,
    invoice: input.invoice,
    nowMs: input.nowMs,
    stripeCheckoutEnabled: true,
  });
  if (state === "paid") return "paid";
  if (state === "cancelled") return "cancelled";
  if (state === "expired") return "expired";
  return null;
}

export function isPublicPathwaySelectionEligible(input: {
  paymentRequest: FiPaymentRequestRow;
  invoice: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents" | "status">;
  nowMs: number;
}): boolean {
  const reject = derivePublicPathwaySelectionRejectReason({
    rawToken: input.paymentRequest.public_token,
    paymentRequestFound: true,
    paymentRequest: input.paymentRequest,
    invoice: input.invoice,
    nowMs: input.nowMs,
  });
  if (reject) return false;
  return invoiceBalanceDueCents(input.invoice) > 0;
}

export type PatientPathwayUpsertTarget = {
  action: "create" | "update";
  pathwayId: string | null;
};

/**
 * Chooses whether to create or update a patient pathway row for a payment request token.
 * Prefers an existing non-cancelled row tied to the same source_payment_request_id, then
 * any patient_public_token row for the invoice.
 */
export function resolvePatientPathwayUpsertTarget(input: {
  existingPathways: Array<
    FiPaymentPathwayRow & {
      id: string;
      source?: FiPaymentPathwaySource | null;
      source_payment_request_id?: string | null;
    }
  >;
  paymentRequestId: string;
  invoiceId: string;
}): PatientPathwayUpsertTarget {
  const prId = input.paymentRequestId.trim();
  const byRequest = input.existingPathways.find(
    (r) => r.status !== "cancelled" && r.source_payment_request_id?.trim() === prId
  );
  if (byRequest) return { action: "update", pathwayId: byRequest.id };

  const byPatientSource = input.existingPathways.find(
    (r) => r.status !== "cancelled" && r.source === "patient_public_token"
  );
  if (byPatientSource) return { action: "update", pathwayId: byPatientSource.id };

  const active = resolveActivePaymentPathway(input.existingPathways);
  if (active && "source" in active && active.source === "patient_public_token") {
    return { action: "update", pathwayId: active.id };
  }

  return { action: "create", pathwayId: null };
}

export type PatientPathwayUpsertPayload = {
  tenantId: string;
  patientId: string | null;
  caseId: string | null;
  invoiceId: string;
  bookingId: string | null;
  pathwayType: FiPaymentPathwayType;
  status: FiPaymentPathwayStatus;
  currencyCode: string;
  expectedAmountCents: number;
  source: FiPaymentPathwaySource;
  sourcePaymentRequestId: string;
};

/** Derives pathway insert/update fields from payment request + invoice — never from client IDs. */
export function buildPatientPathwayUpsertPayload(input: {
  paymentRequest: FiPaymentRequestRow;
  invoice: FiInvoiceRow;
  bookingId: string | null;
  pathwayType: FiPaymentPathwayType;
}): PatientPathwayUpsertPayload {
  const status = mapPatientPathwayTypeToStatus(input.pathwayType);
  const balance = invoiceBalanceDueCents(input.invoice);
  const expectedAmount =
    input.pathwayType === "deposit_balance" && isDepositPaymentRequest(input)
      ? input.paymentRequest.total_cents
      : balance;

  return {
    tenantId: input.paymentRequest.tenant_id,
    patientId: input.invoice.patient_id,
    caseId: input.invoice.case_id,
    invoiceId: input.invoice.id,
    bookingId: input.bookingId,
    pathwayType: input.pathwayType,
    status,
    currencyCode: input.invoice.currency?.trim() || "AUD",
    expectedAmountCents: expectedAmount,
    source: "patient_public_token",
    sourcePaymentRequestId: input.paymentRequest.id,
  };
}
