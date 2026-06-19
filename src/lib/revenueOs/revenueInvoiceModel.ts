/** FI OS Stage 7 — Revenue / invoice row shapes (service layer). */

export const FI_INVOICE_KINDS = [
  "consultation_quote",
  "surgery_deposit",
  "surgery_balance",
  "adjustment",
  "other",
] as const;
export type FiInvoiceKind = (typeof FI_INVOICE_KINDS)[number];

export const FI_INVOICE_STATUSES = [
  "draft",
  "sent",
  "awaiting_payment",
  "partially_paid",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
] as const;
export type FiInvoiceStatus = (typeof FI_INVOICE_STATUSES)[number];

/** Statuses that represent an open balance eligible for collection (includes legacy `issued`). */
export const FI_INVOICE_OPEN_COLLECTION_STATUSES = [
  "sent",
  "awaiting_payment",
  "partially_paid",
  "overdue",
] as const;

export function normalizeInvoiceStatusValue(status: string): FiInvoiceStatus {
  if (status === "issued") return "awaiting_payment";
  return status as FiInvoiceStatus;
}

export const FI_GATEWAY_PAYMENT_STATUSES = [
  "pending",
  "succeeded",
  "failed",
  "refunded",
  "manually_recorded",
] as const;
export type FiGatewayPaymentStatus = (typeof FI_GATEWAY_PAYMENT_STATUSES)[number];

export const FI_PAYMENT_REQUEST_STATUSES = ["draft", "sent", "viewed", "paid", "expired", "cancelled"] as const;
export type FiPaymentRequestStatus = (typeof FI_PAYMENT_REQUEST_STATUSES)[number];

export type FiInvoiceRow = {
  id: string;
  tenant_id: string;
  clinic_id: string | null;
  patient_id: string | null;
  lead_id: string | null;
  case_id: string | null;
  consultation_id: string | null;
  invoice_kind: FiInvoiceKind;
  status: FiInvoiceStatus;
  amount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  currency: string;
  due_date: string | null;
  issued_at: string | null;
  sent_at: string | null;
  paid_at: string | null;
  remaining_balance_cents: number;
  days_overdue: number;
  last_reminder_sent_at: string | null;
  invoice_number: string | null;
  title: string | null;
  automation_hints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type FiInvoiceItemRow = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  sort_index: number;
  description: string;
  quantity: number;
  unit_amount_cents: number;
  line_tax_cents: number;
  line_total_cents: number;
  metadata: Record<string, unknown>;
};

export type FiPaymentRequestRow = {
  id: string;
  tenant_id: string;
  invoice_id: string;
  status: FiPaymentRequestStatus;
  amount_cents: number;
  tax_cents: number;
  total_cents: number;
  currency: string;
  /** Opaque token for public `/pay/[token]` page (never show internal tenant/patient UUIDs there). */
  public_token: string;
  sent_at: string | null;
  viewed_at: string | null;
  checkout_url: string | null;
  provider: string | null;
  provider_checkout_session_id: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export function invoiceBalanceDueCents(row: Pick<FiInvoiceRow, "total_cents" | "amount_paid_cents">): number {
  return Math.max(0, row.total_cents - row.amount_paid_cents);
}

export function isInvoiceOpenForCollection(status: FiInvoiceStatus | string): boolean {
  const normalized = normalizeInvoiceStatusValue(String(status));
  return (
    normalized === "sent" ||
    normalized === "awaiting_payment" ||
    normalized === "partially_paid" ||
    normalized === "overdue"
  );
}

export function openCollectionStatusFilter(): string[] {
  return ["sent", "awaiting_payment", "partially_paid", "overdue", "issued"];
}
