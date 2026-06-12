import type { FiGatewayPaymentStatus, FiInvoiceItemRow, FiInvoiceKind, FiInvoiceRow, FiInvoiceStatus, FiPaymentRequestRow, FiPaymentRequestStatus } from "./revenueInvoiceModel";

function jsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export function mapInvoiceRow(raw: Record<string, unknown>): FiInvoiceRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    clinic_id: raw.clinic_id != null ? String(raw.clinic_id) : null,
    patient_id: raw.patient_id != null ? String(raw.patient_id) : null,
    lead_id: raw.lead_id != null ? String(raw.lead_id) : null,
    case_id: raw.case_id != null ? String(raw.case_id) : null,
    consultation_id: raw.consultation_id != null ? String(raw.consultation_id) : null,
    invoice_kind: String(raw.invoice_kind) as FiInvoiceKind,
    status: String(raw.status) as FiInvoiceStatus,
    amount_cents: Number(raw.amount_cents ?? 0),
    tax_cents: Number(raw.tax_cents ?? 0),
    total_cents: Number(raw.total_cents ?? 0),
    amount_paid_cents: Number(raw.amount_paid_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    due_date: raw.due_date != null ? String(raw.due_date).slice(0, 10) : null,
    issued_at: raw.issued_at != null ? String(raw.issued_at) : null,
    invoice_number: raw.invoice_number != null ? String(raw.invoice_number) : null,
    title: raw.title != null ? String(raw.title) : null,
    automation_hints: jsonObject(raw.automation_hints),
    metadata: jsonObject(raw.metadata),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function mapInvoiceItemRow(raw: Record<string, unknown>): FiInvoiceItemRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    invoice_id: String(raw.invoice_id),
    sort_index: Number(raw.sort_index ?? 0),
    description: String(raw.description ?? ""),
    quantity: Number(raw.quantity ?? 1),
    unit_amount_cents: Number(raw.unit_amount_cents ?? 0),
    line_tax_cents: Number(raw.line_tax_cents ?? 0),
    line_total_cents: Number(raw.line_total_cents ?? 0),
    metadata: jsonObject(raw.metadata),
  };
}

export function mapPaymentRequestRow(raw: Record<string, unknown>): FiPaymentRequestRow {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    invoice_id: String(raw.invoice_id),
    status: String(raw.status) as FiPaymentRequestStatus,
    amount_cents: Number(raw.amount_cents ?? 0),
    tax_cents: Number(raw.tax_cents ?? 0),
    total_cents: Number(raw.total_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
    public_token: String(raw.public_token ?? ""),
    sent_at: raw.sent_at != null ? String(raw.sent_at) : null,
    viewed_at: raw.viewed_at != null ? String(raw.viewed_at) : null,
    checkout_url: raw.checkout_url != null ? String(raw.checkout_url) : null,
    provider: raw.provider != null ? String(raw.provider) : null,
    provider_checkout_session_id: raw.provider_checkout_session_id != null ? String(raw.provider_checkout_session_id) : null,
    expires_at: raw.expires_at != null ? String(raw.expires_at) : null,
    metadata: jsonObject(raw.metadata),
    created_at: String(raw.created_at ?? ""),
    updated_at: String(raw.updated_at ?? ""),
  };
}

export function mapPaymentRow(raw: Record<string, unknown>): {
  id: string;
  tenant_id: string;
  invoice_id: string;
  status: FiGatewayPaymentStatus;
  amount_cents: number;
  total_cents: number;
  currency: string;
} {
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    invoice_id: String(raw.invoice_id),
    status: String(raw.status) as FiGatewayPaymentStatus,
    amount_cents: Number(raw.amount_cents ?? 0),
    total_cents: Number(raw.total_cents ?? 0),
    currency: String(raw.currency ?? "AUD").toUpperCase(),
  };
}
