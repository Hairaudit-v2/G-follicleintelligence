/**
 * FI-UX-REBUILD D5 — entity-first href builders for Today feed items.
 * Pure helpers — safe for unit tests without DB access.
 */

export type PaymentEntityKind = "payment_request" | "payment_record";

export function paymentEntityHref(
  base: string,
  paymentId: string,
  kind: PaymentEntityKind = "payment_request"
): string {
  const id = paymentId.trim();
  if (kind === "payment_record") return `${base}/financial/payments/${id}`;
  return `${base}/financial/payment-requests/${id}`;
}

export function surgeryCaseEntityHref(base: string, caseId: string): string {
  return `${base}/cases/${caseId.trim()}`;
}

export function pathologyResultEntityHref(
  base: string,
  patientId: string,
  resultId: string
): string {
  return `${base}/patients/${patientId.trim()}/blood-results/${resultId.trim()}`;
}

export function consultationEntityHref(base: string, consultationId: string): string {
  return `${base}/consultations/${consultationId.trim()}`;
}

export function staffEntityHref(base: string, staffId: string): string {
  return `${base}/workforce-os/staff/${staffId.trim()}`;
}

/** Prefer payment entity when resolvable; otherwise fall back to surgery case or patient. */
export function resolveFinancialAttentionHref(input: {
  base: string;
  paymentRequestId?: string | null;
  paymentRecordId?: string | null;
  caseId?: string | null;
  patientId?: string | null;
  aggregateFallbackHref: string;
}): string {
  const { base, paymentRequestId, paymentRecordId, caseId, patientId, aggregateFallbackHref } =
    input;
  if (paymentRequestId?.trim()) {
    return paymentEntityHref(base, paymentRequestId, "payment_request");
  }
  if (paymentRecordId?.trim()) {
    return paymentEntityHref(base, paymentRecordId, "payment_record");
  }
  if (caseId?.trim()) return surgeryCaseEntityHref(base, caseId);
  if (patientId?.trim()) return `${base}/patients/${patientId.trim()}`;
  return aggregateFallbackHref;
}
