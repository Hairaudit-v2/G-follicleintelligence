import type { SupabaseClient } from "@supabase/supabase-js";

import {
  ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
  ENTERPRISE_DEMO_CASE_KEY_METADATA,
  ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA,
  ENTERPRISE_DEMO_INVOICE_KEY_METADATA,
  ENTERPRISE_DEMO_PAYMENT_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoFinancialBundles,
  ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER,
  validateEnterpriseDemoFinancialBundles,
  type EnterpriseDemoConsultationFinancialBundle,
  type EnterpriseDemoFranchiseRiskSpec,
  type EnterpriseDemoInvoiceSpec,
  type EnterpriseDemoPaymentRequestSpec,
  type EnterpriseDemoPaymentSpec,
  type EnterpriseDemoSurgeryFinancialBundle,
} from "./enterpriseDemoFinancialGenerator";
import { ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA } from "./enterpriseDemoPatientsSeed.server";
import {
  ENTERPRISE_DEMO_DEFAULT_VOLUME,
  type EnterpriseDemoVolumeOptions,
} from "./enterpriseDemoVolumeOptions";

export const ENTERPRISE_DEMO_INVOICE_METADATA_FLAG = "enterprise_demo_invoice";
export const ENTERPRISE_DEMO_PAYMENT_METADATA_FLAG = "enterprise_demo_payment";
export const ENTERPRISE_DEMO_PAYMENT_REQUEST_METADATA_FLAG = "enterprise_demo_payment_request";
export const ENTERPRISE_DEMO_FINANCIAL_RISK_METADATA_FLAG = "enterprise_demo_franchise_risk";

export type EnterpriseDemoFinancialSeedResult = {
  createdInvoices: number;
  existingInvoices: number;
  createdInvoiceItems: number;
  existingInvoiceItems: number;
  createdPaymentRequests: number;
  existingPaymentRequests: number;
  createdPayments: number;
  existingPayments: number;
  updatedCaseFranchiseRisk: number;
  existingCaseFranchiseRisk: number;
  updatedBookingFinancialStatus: number;
  warnings: string[];
};

type ClinicRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type PatientRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type ConsultationRow = {
  id: string;
  structured_data: Record<string, unknown> | null;
  case_id: string | null;
};

type CaseRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type BookingRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type InvoiceRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type PaymentRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

type PaymentRequestRow = {
  id: string;
  metadata: Record<string, unknown> | null;
};

function metadataKey(metadata: unknown, key: string): string | null {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isEnterpriseDemoInvoiceMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_INVOICE_METADATA_FLAG] === true;
}

function isEnterpriseDemoPaymentMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_PAYMENT_METADATA_FLAG] === true;
}

function isEnterpriseDemoPaymentRequestMetadata(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  return (
    (metadata as Record<string, unknown>)[ENTERPRISE_DEMO_PAYMENT_REQUEST_METADATA_FLAG] === true
  );
}

function clinicMetadataSlug(row: ClinicRow): string | null {
  const slug = row.metadata?.slug;
  return typeof slug === "string" && slug.trim() ? slug.trim() : null;
}

async function loadClinicIdBySlug(
  supabase: SupabaseClient,
  tenantId: string
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("fi_clinics")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const clinic = row as ClinicRow;
    const slug = clinicMetadataSlug(clinic);
    if (slug) map.set(slug, String(clinic.id));
  }
  return map;
}

async function loadPatientRows(supabase: SupabaseClient, tenantId: string): Promise<PatientRow[]> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadConsultationRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ConsultationRow[]> {
  const { data, error } = await supabase
    .from("fi_consultations")
    .select("id, structured_data, case_id")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; structured_data: unknown; case_id: string | null };
    const structured_data =
      raw.structured_data &&
      typeof raw.structured_data === "object" &&
      !Array.isArray(raw.structured_data)
        ? (raw.structured_data as Record<string, unknown>)
        : null;
    return {
      id: String(raw.id),
      structured_data,
      case_id: raw.case_id != null ? String(raw.case_id) : null,
    };
  });
}

async function loadCaseRows(supabase: SupabaseClient, tenantId: string): Promise<CaseRow[]> {
  const { data, error } = await supabase
    .from("fi_cases")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadBookingRows(supabase: SupabaseClient, tenantId: string): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("fi_bookings")
    .select("id, metadata")
    .eq("tenant_id", tenantId);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadDemoInvoiceRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<InvoiceRow[]> {
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [ENTERPRISE_DEMO_INVOICE_METADATA_FLAG]: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadDemoPaymentRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from("fi_payments")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [ENTERPRISE_DEMO_PAYMENT_METADATA_FLAG]: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

async function loadDemoPaymentRequestRows(
  supabase: SupabaseClient,
  tenantId: string
): Promise<PaymentRequestRow[]> {
  const { data, error } = await supabase
    .from("fi_payment_requests")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .contains("metadata", { [ENTERPRISE_DEMO_PAYMENT_REQUEST_METADATA_FLAG]: true });
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const raw = row as { id: string; metadata: unknown };
    const metadata =
      raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
        ? (raw.metadata as Record<string, unknown>)
        : null;
    return { id: String(raw.id), metadata };
  });
}

function findPatientByDemoKey(rows: PatientRow[], key: string): PatientRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, "demo_patient_key") === key);
}

function findConsultationByDemoKey(
  rows: ConsultationRow[],
  key: string
): ConsultationRow | undefined {
  return rows.find(
    (row) => metadataKey(row.structured_data, ENTERPRISE_DEMO_CONSULTATION_KEY_METADATA) === key
  );
}

function findCaseByDemoKey(rows: CaseRow[], key: string): CaseRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, ENTERPRISE_DEMO_CASE_KEY_METADATA) === key);
}

function findBookingByDemoKey(rows: BookingRow[], key: string): BookingRow | undefined {
  return rows.find(
    (row) => metadataKey(row.metadata, ENTERPRISE_DEMO_BOOKING_KEY_METADATA) === key
  );
}

function findInvoiceByDemoKey(rows: InvoiceRow[], key: string): InvoiceRow | undefined {
  return rows.find(
    (row) => metadataKey(row.metadata, ENTERPRISE_DEMO_INVOICE_KEY_METADATA) === key
  );
}

function findPaymentByDemoKey(rows: PaymentRow[], key: string): PaymentRow | undefined {
  return rows.find(
    (row) => metadataKey(row.metadata, ENTERPRISE_DEMO_PAYMENT_KEY_METADATA) === key
  );
}

function findPaymentRequestByDemoKey(
  rows: PaymentRequestRow[],
  key: string
): PaymentRequestRow | undefined {
  return rows.find((row) => metadataKey(row.metadata, "demo_payment_request_key") === key);
}

function buildInvoiceMetadata(invoice: EnterpriseDemoInvoiceSpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_INVOICE_METADATA_FLAG]: true,
    enterprise_demo: true,
    synthetic: true,
    [ENTERPRISE_DEMO_INVOICE_KEY_METADATA]: invoice.demoInvoiceKey,
    demo_patient_key: invoice.demoPatientKey,
    demo_consultation_key: invoice.demoConsultationKey,
    demo_case_key: invoice.demoCaseKey,
    demo_booking_key: invoice.demoBookingKey,
    demo_surgery_key: invoice.demoSurgeryKey,
    demo_clinic_slug: invoice.clinicSlug,
    demo_financial_lifecycle: invoice.demoFinancialLifecycle,
    demo_financial_written_off: invoice.demoFinancialLifecycle === "written_off",
  };
}

function buildPaymentMetadata(payment: EnterpriseDemoPaymentSpec): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_PAYMENT_METADATA_FLAG]: true,
    enterprise_demo: true,
    synthetic: true,
    [ENTERPRISE_DEMO_PAYMENT_KEY_METADATA]: payment.demoPaymentKey,
    demo_invoice_key: payment.demoInvoiceKey,
    demo_payment_request_key: payment.demoPaymentRequestKey,
    demo_clinic_slug: payment.clinicSlug,
    provider: ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER,
    stripe_object_created: false,
  };
}

function buildPaymentRequestMetadata(
  request: EnterpriseDemoPaymentRequestSpec
): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_PAYMENT_REQUEST_METADATA_FLAG]: true,
    enterprise_demo: true,
    synthetic: true,
    demo_payment_request_key: request.demoPaymentRequestKey,
    demo_invoice_key: request.demoInvoiceKey,
    demo_clinic_slug: request.clinicSlug,
    provider: ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER,
    stripe_checkout_created: false,
  };
}

function buildFranchiseRiskMetadata(
  risk: EnterpriseDemoFranchiseRiskSpec
): Record<string, unknown> {
  return {
    [ENTERPRISE_DEMO_FINANCIAL_RISK_METADATA_FLAG]: true,
    enterprise_demo: true,
    synthetic: true,
    [ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA]: risk.demoFinancialRiskKey,
    demo_case_key: risk.demoCaseKey,
    demo_surgery_key: risk.demoSurgeryKey,
    demo_patient_key: risk.demoPatientKey,
    demo_clinic_slug: risk.clinicSlug,
    revenue_variance_flag: risk.revenueVarianceFlag,
    inventory_to_graft_variance_flag: risk.inventoryToGraftVarianceFlag,
    payment_reconciliation_status: risk.paymentReconciliationStatus,
    franchise_risk_score: risk.franchiseRiskScore,
    risk_reason_codes: risk.riskReasonCodes,
  };
}

function invoiceNumberForKey(demoInvoiceKey: string): string {
  const compact = demoInvoiceKey.replace(/[^a-z0-9]+/gi, "-").slice(0, 48);
  return `TITAN-${compact}`.toUpperCase();
}

function demoPublicToken(demoPaymentRequestKey: string): string {
  let out = "d";
  for (let i = 0; i < 5; i++) {
    let h = 2166136261;
    const input = `${demoPaymentRequestKey}:${i}`;
    for (let j = 0; j < input.length; j++) {
      h ^= input.charCodeAt(j);
      h = Math.imul(h, 16777619);
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 36);
}

async function seedInvoice(
  supabase: SupabaseClient,
  tenantId: string,
  invoice: EnterpriseDemoInvoiceSpec,
  context: {
    clinicId: string | null;
    patientId: string | null;
    consultationId: string | null;
    caseId: string | null;
    existingInvoices: InvoiceRow[];
    now: string;
  }
): Promise<{ created: boolean; invoiceId: string | null; itemCreated: boolean }> {
  const invoiceNumber = invoiceNumberForKey(invoice.demoInvoiceKey);
  const existing = findInvoiceByDemoKey(context.existingInvoices, invoice.demoInvoiceKey);
  if (existing) {
    if (!isEnterpriseDemoInvoiceMetadata(existing.metadata)) {
      return { created: false, invoiceId: existing.id, itemCreated: false };
    }
    return { created: false, invoiceId: existing.id, itemCreated: false };
  }

  const { data, error } = await supabase
    .from("fi_invoices")
    .insert({
      tenant_id: tenantId,
      clinic_id: context.clinicId,
      patient_id: context.patientId,
      case_id: context.caseId,
      consultation_id: context.consultationId,
      invoice_kind: invoice.invoiceKind,
      status: invoice.status,
      amount_cents: invoice.amountCents,
      tax_cents: invoice.taxCents,
      total_cents: invoice.totalCents,
      amount_paid_cents: invoice.amountPaidCents,
      currency: invoice.currency,
      due_date: invoice.dueDate,
      issued_at: invoice.issuedAt,
      invoice_number: invoiceNumber,
      title: invoice.title,
      metadata: buildInvoiceMetadata(invoice),
      automation_hints: { enterprise_demo: true },
      created_at: context.now,
      updated_at: context.now,
    })
    .select("id")
    .single();
  if (error) {
    if (
      /uq_fi_invoices_tenant_number|duplicate key value violates unique constraint/i.test(
        error.message
      )
    ) {
      const { data: existingByNumber, error: findErr } = await supabase
        .from("fi_invoices")
        .select("id, metadata")
        .eq("tenant_id", tenantId)
        .eq("invoice_number", invoiceNumber)
        .maybeSingle();
      if (findErr) throw new Error(findErr.message);
      if (existingByNumber?.id) {
        const invoiceId = String((existingByNumber as { id: string }).id);
        context.existingInvoices.push({
          id: invoiceId,
          metadata: (existingByNumber as { metadata: unknown }).metadata as Record<
            string,
            unknown
          > | null,
        });
        return { created: false, invoiceId, itemCreated: false };
      }
    }
    throw new Error(error.message);
  }

  const invoiceId = String((data as { id: string }).id);
  context.existingInvoices.push({
    id: invoiceId,
    metadata: buildInvoiceMetadata(invoice),
  });

  const { error: itemErr } = await supabase.from("fi_invoice_items").insert({
    tenant_id: tenantId,
    invoice_id: invoiceId,
    sort_index: 0,
    description: invoice.lineDescription,
    quantity: 1,
    unit_amount_cents: invoice.amountCents,
    line_tax_cents: invoice.taxCents,
    line_total_cents: invoice.totalCents,
    metadata: { enterprise_demo: true, synthetic: true },
    created_at: context.now,
    updated_at: context.now,
  });
  if (itemErr) throw new Error(itemErr.message);

  return { created: true, invoiceId, itemCreated: true };
}

async function seedPaymentRequest(
  supabase: SupabaseClient,
  tenantId: string,
  request: EnterpriseDemoPaymentRequestSpec,
  context: {
    clinicId: string | null;
    patientId: string | null;
    consultationId: string | null;
    caseId: string | null;
    invoiceId: string;
    existingPaymentRequests: PaymentRequestRow[];
    now: string;
  }
): Promise<{ created: boolean; paymentRequestId: string | null }> {
  const existing = findPaymentRequestByDemoKey(
    context.existingPaymentRequests,
    request.demoPaymentRequestKey
  );
  if (existing) {
    if (!isEnterpriseDemoPaymentRequestMetadata(existing.metadata)) {
      return { created: false, paymentRequestId: null };
    }
    return { created: false, paymentRequestId: existing.id };
  }

  const { data, error } = await supabase
    .from("fi_payment_requests")
    .insert({
      tenant_id: tenantId,
      clinic_id: context.clinicId,
      patient_id: context.patientId,
      case_id: context.caseId,
      consultation_id: context.consultationId,
      invoice_id: context.invoiceId,
      status: request.status,
      amount_cents: request.amountCents,
      tax_cents: request.taxCents,
      total_cents: request.totalCents,
      currency: request.currency,
      sent_at: request.sentAt,
      expires_at: request.expiresAt,
      provider: ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER,
      public_token: demoPublicToken(request.demoPaymentRequestKey),
      metadata: buildPaymentRequestMetadata(request),
      created_at: context.now,
      updated_at: context.now,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const paymentRequestId = String((data as { id: string }).id);
  context.existingPaymentRequests.push({
    id: paymentRequestId,
    metadata: buildPaymentRequestMetadata(request),
  });

  return { created: true, paymentRequestId };
}

async function seedPayment(
  supabase: SupabaseClient,
  tenantId: string,
  payment: EnterpriseDemoPaymentSpec,
  context: {
    clinicId: string | null;
    patientId: string | null;
    consultationId: string | null;
    caseId: string | null;
    invoiceId: string;
    paymentRequestId: string | null;
    existingPayments: PaymentRow[];
    now: string;
  }
): Promise<{ created: boolean }> {
  const existing = findPaymentByDemoKey(context.existingPayments, payment.demoPaymentKey);
  if (existing) {
    if (!isEnterpriseDemoPaymentMetadata(existing.metadata)) {
      return { created: false };
    }
    return { created: false };
  }

  const { error } = await supabase.from("fi_payments").insert({
    tenant_id: tenantId,
    clinic_id: context.clinicId,
    patient_id: context.patientId,
    case_id: context.caseId,
    consultation_id: context.consultationId,
    invoice_id: context.invoiceId,
    payment_request_id: context.paymentRequestId,
    status: payment.status,
    amount_cents: payment.amountCents,
    tax_cents: payment.taxCents,
    total_cents: payment.totalCents,
    currency: payment.currency,
    provider: ENTERPRISE_DEMO_DEMO_PAYMENT_PROVIDER,
    provider_ref: `demo-${payment.demoPaymentKey}`,
    metadata: buildPaymentMetadata(payment),
    created_at: payment.recordedAt,
    updated_at: context.now,
  });
  if (error) throw new Error(error.message);

  context.existingPayments.push({
    id: `pending-${payment.demoPaymentKey}`,
    metadata: buildPaymentMetadata(payment),
  });

  return { created: true };
}

async function upsertCaseFranchiseRisk(
  supabase: SupabaseClient,
  tenantId: string,
  caseRow: CaseRow,
  risk: EnterpriseDemoFranchiseRiskSpec,
  now: string
): Promise<{ updated: boolean; existing: boolean }> {
  const existingKey = metadataKey(caseRow.metadata, ENTERPRISE_DEMO_FINANCIAL_RISK_KEY_METADATA);
  if (existingKey === risk.demoFinancialRiskKey) {
    return { updated: false, existing: true };
  }
  if (existingKey && existingKey !== risk.demoFinancialRiskKey) {
    return { updated: false, existing: true };
  }

  const nextMetadata = {
    ...(caseRow.metadata ?? {}),
    ...buildFranchiseRiskMetadata(risk),
  };

  const { error } = await supabase
    .from("fi_cases")
    .update({ metadata: nextMetadata, updated_at: now })
    .eq("tenant_id", tenantId)
    .eq("id", caseRow.id);
  if (error) throw new Error(error.message);

  caseRow.metadata = nextMetadata;
  return { updated: true, existing: false };
}

async function seedConsultationBundle(
  supabase: SupabaseClient,
  tenantId: string,
  bundle: EnterpriseDemoConsultationFinancialBundle,
  context: {
    clinicIdBySlug: Map<string, string>;
    patients: PatientRow[];
    consultations: ConsultationRow[];
    existingInvoices: InvoiceRow[];
    existingPaymentRequests: PaymentRequestRow[];
    existingPayments: PaymentRow[];
    now: string;
    counters: EnterpriseDemoFinancialSeedResult;
    warnings: string[];
  }
): Promise<void> {
  const patient = findPatientByDemoKey(context.patients, bundle.consultation.demoPatientKey);
  const consultation = findConsultationByDemoKey(
    context.consultations,
    bundle.consultation.demoConsultationKey
  );
  if (!patient || !consultation) {
    context.warnings.push(
      `Missing patient/consultation for financial bundle ${bundle.quoteInvoice.demoInvoiceKey}; skipped.`
    );
    return;
  }

  const clinicId = context.clinicIdBySlug.get(bundle.consultation.clinicSlug) ?? null;
  const invoiceResult = await seedInvoice(supabase, tenantId, bundle.quoteInvoice, {
    clinicId,
    patientId: patient.id,
    consultationId: consultation.id,
    caseId: consultation.case_id,
    existingInvoices: context.existingInvoices,
    now: context.now,
  });

  if (invoiceResult.created) {
    context.counters.createdInvoices += 1;
    context.counters.createdInvoiceItems += 1;
  } else if (invoiceResult.invoiceId) {
    context.counters.existingInvoices += 1;
  } else {
    context.warnings.push(
      `Invoice key collision for ${bundle.quoteInvoice.demoInvoiceKey}; skipped.`
    );
    return;
  }

  if (!invoiceResult.invoiceId) return;

  if (bundle.paymentRequest) {
    const pr = await seedPaymentRequest(supabase, tenantId, bundle.paymentRequest, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: consultation.case_id,
      invoiceId: invoiceResult.invoiceId,
      existingPaymentRequests: context.existingPaymentRequests,
      now: context.now,
    });
    if (pr.created) context.counters.createdPaymentRequests += 1;
    else if (pr.paymentRequestId) context.counters.existingPaymentRequests += 1;

    if (bundle.payment) {
      const pay = await seedPayment(supabase, tenantId, bundle.payment, {
        clinicId,
        patientId: patient.id,
        consultationId: consultation.id,
        caseId: consultation.case_id,
        invoiceId: invoiceResult.invoiceId,
        paymentRequestId: pr.paymentRequestId,
        existingPayments: context.existingPayments,
        now: context.now,
      });
      if (pay.created) context.counters.createdPayments += 1;
      else context.counters.existingPayments += 1;
    }
  } else if (bundle.payment) {
    const pay = await seedPayment(supabase, tenantId, bundle.payment, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: consultation.case_id,
      invoiceId: invoiceResult.invoiceId,
      paymentRequestId: null,
      existingPayments: context.existingPayments,
      now: context.now,
    });
    if (pay.created) context.counters.createdPayments += 1;
    else context.counters.existingPayments += 1;
  }
}

async function seedSurgeryBundle(
  supabase: SupabaseClient,
  tenantId: string,
  bundle: EnterpriseDemoSurgeryFinancialBundle,
  context: {
    clinicIdBySlug: Map<string, string>;
    patients: PatientRow[];
    consultations: ConsultationRow[];
    cases: CaseRow[];
    bookings: BookingRow[];
    existingInvoices: InvoiceRow[];
    existingPaymentRequests: PaymentRequestRow[];
    existingPayments: PaymentRow[];
    now: string;
    counters: EnterpriseDemoFinancialSeedResult;
    warnings: string[];
  }
): Promise<void> {
  const patient = findPatientByDemoKey(context.patients, bundle.surgery.demoPatientKey);
  const consultation = findConsultationByDemoKey(
    context.consultations,
    bundle.surgery.demoConsultationKey
  );
  const caseRow = findCaseByDemoKey(context.cases, bundle.surgery.demoCaseKey);
  const booking = findBookingByDemoKey(context.bookings, bundle.surgery.demoBookingKey);

  if (!patient || !consultation || !caseRow) {
    context.warnings.push(
      `Missing patient/consultation/case for surgery financial bundle ${bundle.surgery.demoSurgeryKey}; skipped.`
    );
    return;
  }

  const clinicId = context.clinicIdBySlug.get(bundle.surgery.clinicSlug) ?? null;
  const baseContext = {
    clinicId,
    patientId: patient.id,
    consultationId: consultation.id,
    caseId: caseRow.id,
    existingInvoices: context.existingInvoices,
    now: context.now,
  };

  const invoices = [bundle.depositInvoice, bundle.balanceInvoice, bundle.adjustmentInvoice].filter(
    (row): row is EnterpriseDemoInvoiceSpec => row != null
  );

  const invoiceIdByKey = new Map<string, string>();

  for (const invoice of invoices) {
    const result = await seedInvoice(supabase, tenantId, invoice, {
      ...baseContext,
      existingInvoices: context.existingInvoices,
    });
    if (result.created) {
      context.counters.createdInvoices += 1;
      context.counters.createdInvoiceItems += 1;
    } else if (result.invoiceId) {
      context.counters.existingInvoices += 1;
    } else {
      context.warnings.push(`Invoice key collision for ${invoice.demoInvoiceKey}; skipped.`);
      continue;
    }
    if (result.invoiceId) invoiceIdByKey.set(invoice.demoInvoiceKey, result.invoiceId);
  }

  const depositInvoiceId = invoiceIdByKey.get(bundle.depositInvoice.demoInvoiceKey);
  const balanceInvoiceId = invoiceIdByKey.get(bundle.balanceInvoice.demoInvoiceKey);

  if (bundle.depositPaymentRequest && depositInvoiceId) {
    const pr = await seedPaymentRequest(supabase, tenantId, bundle.depositPaymentRequest, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: caseRow.id,
      invoiceId: depositInvoiceId,
      existingPaymentRequests: context.existingPaymentRequests,
      now: context.now,
    });
    if (pr.created) context.counters.createdPaymentRequests += 1;
    else if (pr.paymentRequestId) context.counters.existingPaymentRequests += 1;

    if (bundle.depositPayment) {
      const pay = await seedPayment(supabase, tenantId, bundle.depositPayment, {
        clinicId,
        patientId: patient.id,
        consultationId: consultation.id,
        caseId: caseRow.id,
        invoiceId: depositInvoiceId,
        paymentRequestId: pr.paymentRequestId,
        existingPayments: context.existingPayments,
        now: context.now,
      });
      if (pay.created) context.counters.createdPayments += 1;
      else context.counters.existingPayments += 1;
    }
  } else if (bundle.depositPayment && depositInvoiceId) {
    const pay = await seedPayment(supabase, tenantId, bundle.depositPayment, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: caseRow.id,
      invoiceId: depositInvoiceId,
      paymentRequestId: null,
      existingPayments: context.existingPayments,
      now: context.now,
    });
    if (pay.created) context.counters.createdPayments += 1;
    else context.counters.existingPayments += 1;
  }

  if (bundle.balancePaymentRequest && balanceInvoiceId) {
    const pr = await seedPaymentRequest(supabase, tenantId, bundle.balancePaymentRequest, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: caseRow.id,
      invoiceId: balanceInvoiceId,
      existingPaymentRequests: context.existingPaymentRequests,
      now: context.now,
    });
    if (pr.created) context.counters.createdPaymentRequests += 1;
    else if (pr.paymentRequestId) context.counters.existingPaymentRequests += 1;

    if (bundle.balancePayment) {
      const pay = await seedPayment(supabase, tenantId, bundle.balancePayment, {
        clinicId,
        patientId: patient.id,
        consultationId: consultation.id,
        caseId: caseRow.id,
        invoiceId: balanceInvoiceId,
        paymentRequestId: pr.paymentRequestId,
        existingPayments: context.existingPayments,
        now: context.now,
      });
      if (pay.created) context.counters.createdPayments += 1;
      else context.counters.existingPayments += 1;
    }

    if (bundle.refundPayment) {
      const pay = await seedPayment(supabase, tenantId, bundle.refundPayment, {
        clinicId,
        patientId: patient.id,
        consultationId: consultation.id,
        caseId: caseRow.id,
        invoiceId: balanceInvoiceId,
        paymentRequestId: pr.paymentRequestId,
        existingPayments: context.existingPayments,
        now: context.now,
      });
      if (pay.created) context.counters.createdPayments += 1;
      else context.counters.existingPayments += 1;
    }
  } else if (bundle.balancePayment && balanceInvoiceId) {
    const pay = await seedPayment(supabase, tenantId, bundle.balancePayment, {
      clinicId,
      patientId: patient.id,
      consultationId: consultation.id,
      caseId: caseRow.id,
      invoiceId: balanceInvoiceId,
      paymentRequestId: null,
      existingPayments: context.existingPayments,
      now: context.now,
    });
    if (pay.created) context.counters.createdPayments += 1;
    else context.counters.existingPayments += 1;
  }

  const riskResult = await upsertCaseFranchiseRisk(
    supabase,
    tenantId,
    caseRow,
    bundle.franchiseRisk,
    context.now
  );
  if (riskResult.updated) context.counters.updatedCaseFranchiseRisk += 1;
  else if (riskResult.existing) context.counters.existingCaseFranchiseRisk += 1;

  if (booking && bundle.bookingFinancialOsStatus) {
    const { error } = await supabase
      .from("fi_bookings")
      .update({
        financial_os_status: bundle.bookingFinancialOsStatus,
        updated_at: context.now,
      })
      .eq("tenant_id", tenantId)
      .eq("id", booking.id);
    if (error) throw new Error(error.message);
    context.counters.updatedBookingFinancialStatus += 1;
  }
}

export async function seedEnterpriseDemoFinancialOs(
  supabase: SupabaseClient,
  tenantId: string,
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): Promise<EnterpriseDemoFinancialSeedResult> {
  const warnings: string[] = [];
  const counters: EnterpriseDemoFinancialSeedResult = {
    createdInvoices: 0,
    existingInvoices: 0,
    createdInvoiceItems: 0,
    existingInvoiceItems: 0,
    createdPaymentRequests: 0,
    existingPaymentRequests: 0,
    createdPayments: 0,
    existingPayments: 0,
    updatedCaseFranchiseRisk: 0,
    existingCaseFranchiseRisk: 0,
    updatedBookingFinancialStatus: 0,
    warnings,
  };

  const bundles = buildEnterpriseDemoFinancialBundles(undefined, undefined, volume);
  const validation = validateEnterpriseDemoFinancialBundles(bundles, volume);
  if (!validation.ok) {
    warnings.push(validation.reason);
    return counters;
  }

  const now = new Date().toISOString();
  const clinicIdBySlug = await loadClinicIdBySlug(supabase, tenantId);
  const patients = await loadPatientRows(supabase, tenantId);
  const consultations = await loadConsultationRows(supabase, tenantId);
  const cases = await loadCaseRows(supabase, tenantId);
  const bookings = await loadBookingRows(supabase, tenantId);
  const existingInvoices = await loadDemoInvoiceRows(supabase, tenantId);
  const existingPaymentRequests = await loadDemoPaymentRequestRows(supabase, tenantId);
  const existingPayments = await loadDemoPaymentRows(supabase, tenantId);

  const context = {
    clinicIdBySlug,
    patients,
    consultations,
    cases,
    bookings,
    existingInvoices,
    existingPaymentRequests,
    existingPayments,
    now,
    counters,
    warnings,
  };

  for (const bundle of bundles.consultationBundles) {
    await seedConsultationBundle(supabase, tenantId, bundle, context);
  }

  for (const bundle of bundles.surgeryBundles) {
    await seedSurgeryBundle(supabase, tenantId, bundle, context);
  }

  return counters;
}
