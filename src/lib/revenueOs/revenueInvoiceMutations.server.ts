import "server-only";

import { randomBytes } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { loadConsultationForTenant } from "@/src/lib/consultations/consultationLoaders.server";
import { readFiPaymentsEnabled, readFiPaymentProviderId } from "@/src/lib/payments/fiPaymentEnv.server";
import { isFiStripeGatewayPaymentIntentDuplicateInsert } from "@/src/lib/payments/stripeWebhookIdempotency";
import { resolvePaymentProvider } from "@/src/lib/payments/providers/registry.server";
import { mapInvoiceRow, mapPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import { computeNextInvoiceStatus } from "@/src/lib/revenueOs/revenueInvoiceMath";
import type { FiInvoiceKind, FiInvoiceRow, FiInvoiceStatus, FiPaymentRequestRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { resolveConsultationQuoteInvoiceAmountCents } from "@/src/lib/revenueOs/consultationInvoiceAmountResolve";

function assertUuid(id: string, label: string): string {
  const v = id?.trim();
  if (!v) throw new Error(`${label} is required.`);
  return v;
}

async function loadInvoiceForTenant(tenantId: string, invoiceId: string): Promise<FiInvoiceRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("id", invoiceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapInvoiceRow(data as Record<string, unknown>);
}

async function patchInvoiceAfterPayment(
  tenantId: string,
  invoiceId: string,
  nextPaid: number,
  todayYmd: string | null
): Promise<FiInvoiceRow> {
  const supabase = supabaseAdmin();
  const row = await loadInvoiceForTenant(tenantId, invoiceId);
  if (!row) throw new Error("Invoice not found.");
  const baseStatus: FiInvoiceStatus = row.status === "draft" ? "issued" : row.status;
  const nextStatus = computeNextInvoiceStatus({ ...row, amount_paid_cents: nextPaid, status: baseStatus }, todayYmd);
  const patch: Record<string, unknown> = {
    amount_paid_cents: nextPaid,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (row.status === "draft" && !row.issued_at) {
    patch.issued_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from("fi_invoices").update(patch).eq("tenant_id", tenantId).eq("id", invoiceId).select("*").single();
  if (error) throw new Error(error.message);
  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function createInvoiceFromConsultationQuote(args: {
  tenantId: string;
  consultationId: string;
  createdByFiUserId: string | null;
  /** When null, derive from consultation quote_data.price_quoted when possible. */
  amountCentsOverride?: number | null;
  taxCents?: number;
  currency?: string;
  dueDateYmd?: string | null;
  issue?: boolean;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const cid = assertUuid(args.consultationId, "consultationId");
  const supabase = supabaseAdmin();
  const consultation = await loadConsultationForTenant(tid, cid);
  if (!consultation) throw new Error("Consultation not found.");

  const { data: quoteRows } = await supabase
    .from("fi_crm_quotes")
    .select("line_items_snapshot, metadata, subtotal_amount, total_amount")
    .eq("tenant_id", tid)
    .eq("consultation_id", cid)
    .order("updated_at", { ascending: false })
    .limit(8);

  const parsed =
    args.amountCentsOverride != null && Number.isFinite(args.amountCentsOverride)
      ? Math.max(0, Math.floor(args.amountCentsOverride))
      : resolveConsultationQuoteInvoiceAmountCents(consultation, quoteRows ?? []);
  if (parsed == null || parsed <= 0) {
    throw new Error(
      "Could not derive a quote amount in cents — enter an amount on the action, set Price quoted on the consultation, or include an amount in the CRM quote draft."
    );
  }

  const tax = Math.max(0, Math.floor(args.taxCents ?? 0));
  const currency = (args.currency ?? "AUD").trim().toUpperCase() || "AUD";
  const total = parsed + tax;
  const issue = args.issue !== false;
  const status: FiInvoiceStatus = issue ? "issued" : "draft";
  const now = new Date().toISOString();

  const insert = {
    tenant_id: tid,
    clinic_id: null,
    patient_id: consultation.patient_id,
    lead_id: consultation.lead_id,
    case_id: consultation.case_id,
    consultation_id: consultation.id,
    invoice_kind: "consultation_quote" satisfies FiInvoiceKind,
    status,
    amount_cents: parsed,
    tax_cents: tax,
    total_cents: total,
    amount_paid_cents: 0,
    currency,
    due_date: args.dueDateYmd?.trim() || null,
    issued_at: issue ? now : null,
    title: `Consultation quote · ${consultation.consultation_type}`,
    automation_hints: {
      balance_due_reminder_days: [7, 3, 1],
      overdue_reminder_enabled: true,
    },
    metadata: {
      source: "consultation_quote",
      consultation_id: consultation.id,
      quote_snapshot: consultation.quote_data,
    },
    created_by_fi_user_id: args.createdByFiUserId?.trim() || null,
  };

  const { data: inv, error: ie } = await supabase.from("fi_invoices").insert(insert).select("*").single();
  if (ie) throw new Error(ie.message);

  const invoice = mapInvoiceRow(inv as Record<string, unknown>);

  const lineDesc =
    typeof consultation.quote_data?.session_size === "string" && consultation.quote_data.session_size.trim()
      ? `Quoted session: ${consultation.quote_data.session_size}`
      : "Consultation quote";
  const { error: li } = await supabase.from("fi_invoice_items").insert({
    tenant_id: tid,
    invoice_id: invoice.id,
    sort_index: 0,
    description: lineDesc,
    quantity: 1,
    unit_amount_cents: parsed,
    line_tax_cents: tax,
    line_total_cents: total,
    metadata: {},
  });
  if (li) throw new Error(li.message);

  return invoice;
}

async function loadActiveDepositRule(tenantId: string, clinicId: string | null) {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_deposit_rules")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .order("priority", { ascending: false })
    .limit(10);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const clinic = clinicId?.trim() || null;
  return (
    rows.find((r) => r.clinic_id && clinic && String(r.clinic_id) === clinic) ??
    rows.find((r) => !r.clinic_id) ??
    rows[0] ??
    null
  );
}

function resolveDepositCentsFromRule(
  rule: Record<string, unknown> | null,
  opts: { procedureFeeEstimateCents?: number | null; explicitDepositCents?: number | null }
): number {
  if (opts.explicitDepositCents != null && Number.isFinite(opts.explicitDepositCents)) {
    return Math.max(0, Math.floor(opts.explicitDepositCents));
  }
  if (!rule) throw new Error("No active deposit rule — pass deposit_amount_cents explicitly.");
  const kind = String(rule.rule_kind ?? "manual_only");
  if (kind === "fixed_cents") {
    const v = Number(rule.fixed_amount_cents ?? 0);
    if (!Number.isFinite(v) || v <= 0) throw new Error("Deposit rule fixed_amount_cents is not set.");
    return Math.floor(v);
  }
  if (kind === "percent_of_procedure_fee") {
    const base = opts.procedureFeeEstimateCents;
    if (base == null || !Number.isFinite(base) || base <= 0) {
      throw new Error("procedure_fee_estimate_cents is required for percent deposit rules.");
    }
    const bp = Number(rule.percent_bp ?? 0);
    if (!Number.isFinite(bp) || bp < 0) throw new Error("Deposit rule percent_bp is invalid.");
    return Math.floor((base * bp) / 10_000);
  }
  throw new Error("Deposit rule is manual_only — pass deposit_amount_cents explicitly.");
}

export async function createDepositInvoiceFromSurgeryCase(args: {
  tenantId: string;
  caseId: string;
  clinicId?: string | null;
  createdByFiUserId: string | null;
  depositAmountCents?: number | null;
  procedureFeeEstimateCents?: number | null;
  taxCents?: number;
  currency?: string;
  dueDateYmd?: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const caseId = assertUuid(args.caseId, "caseId");
  const supabase = supabaseAdmin();
  const { data: c, error } = await supabase
    .from("fi_cases")
    .select("id, tenant_id, patient_id, clinic_id, lead_id")
    .eq("tenant_id", tid)
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Case not found.");

  const row = c as { patient_id: string | null; clinic_id: string | null; lead_id: string | null };
  const rule = await loadActiveDepositRule(tid, args.clinicId?.trim() || row.clinic_id);
  const amount = resolveDepositCentsFromRule(rule, {
    explicitDepositCents: args.depositAmountCents ?? null,
    procedureFeeEstimateCents: args.procedureFeeEstimateCents ?? null,
  });
  const tax = Math.max(0, Math.floor(args.taxCents ?? 0));
  const currency = (args.currency ?? "AUD").trim().toUpperCase() || "AUD";
  const total = amount + tax;
  const now = new Date().toISOString();

  const hints: Record<string, unknown> = {
    deposit_due_reminder_days: [14, 7, 3],
    overdue_reminder_enabled: true,
  };
  if (rule && Boolean((rule as { blocks_surgery_readiness_when_unpaid?: boolean }).blocks_surgery_readiness_when_unpaid)) {
    hints.blocks_surgery_readiness_when_unpaid = true;
  }

  const { data: inv, error: ie } = await supabase
    .from("fi_invoices")
    .insert({
      tenant_id: tid,
      clinic_id: row.clinic_id,
      patient_id: row.patient_id,
      lead_id: row.lead_id,
      case_id: caseId,
      consultation_id: null,
      invoice_kind: "surgery_deposit",
      status: "issued",
      amount_cents: amount,
      tax_cents: tax,
      total_cents: total,
      amount_paid_cents: 0,
      currency,
      due_date: args.dueDateYmd?.trim() || null,
      issued_at: now,
      title: "Surgery deposit",
      automation_hints: hints,
      metadata: { source: "surgery_case_deposit", case_id: caseId, deposit_rule_id: rule?.id ?? null },
      created_by_fi_user_id: args.createdByFiUserId?.trim() || null,
    })
    .select("*")
    .single();
  if (ie) throw new Error(ie.message);
  const invoice = mapInvoiceRow(inv as Record<string, unknown>);

  const { error: li } = await supabase.from("fi_invoice_items").insert({
    tenant_id: tid,
    invoice_id: invoice.id,
    sort_index: 0,
    description: "Surgery deposit",
    quantity: 1,
    unit_amount_cents: amount,
    line_tax_cents: tax,
    line_total_cents: total,
    metadata: {},
  });
  if (li) throw new Error(li.message);

  return invoice;
}

export async function createBalanceInvoiceFromSurgeryCase(args: {
  tenantId: string;
  caseId: string;
  balanceAmountCents: number;
  createdByFiUserId: string | null;
  taxCents?: number;
  currency?: string;
  dueDateYmd?: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const caseId = assertUuid(args.caseId, "caseId");
  const amount = Math.max(0, Math.floor(args.balanceAmountCents));
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("balance_amount_cents must be a positive integer.");

  const supabase = supabaseAdmin();
  const { data: c, error } = await supabase
    .from("fi_cases")
    .select("id, tenant_id, patient_id, clinic_id, lead_id")
    .eq("tenant_id", tid)
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!c) throw new Error("Case not found.");
  const row = c as { patient_id: string | null; clinic_id: string | null; lead_id: string | null };

  const tax = Math.max(0, Math.floor(args.taxCents ?? 0));
  const currency = (args.currency ?? "AUD").trim().toUpperCase() || "AUD";
  const total = amount + tax;
  const now = new Date().toISOString();

  const { data: inv, error: ie } = await supabase
    .from("fi_invoices")
    .insert({
      tenant_id: tid,
      clinic_id: row.clinic_id,
      patient_id: row.patient_id,
      lead_id: row.lead_id,
      case_id: caseId,
      consultation_id: null,
      invoice_kind: "surgery_balance",
      status: "issued",
      amount_cents: amount,
      tax_cents: tax,
      total_cents: total,
      amount_paid_cents: 0,
      currency,
      due_date: args.dueDateYmd?.trim() || null,
      issued_at: now,
      title: "Surgery balance",
      automation_hints: {
        balance_due_reminder_days: [7, 3, 1],
        overdue_reminder_enabled: true,
      },
      metadata: { source: "surgery_case_balance", case_id: caseId },
      created_by_fi_user_id: args.createdByFiUserId?.trim() || null,
    })
    .select("*")
    .single();
  if (ie) throw new Error(ie.message);
  const invoice = mapInvoiceRow(inv as Record<string, unknown>);

  const { error: li } = await supabase.from("fi_invoice_items").insert({
    tenant_id: tid,
    invoice_id: invoice.id,
    sort_index: 0,
    description: "Surgery balance",
    quantity: 1,
    unit_amount_cents: amount,
    line_tax_cents: tax,
    line_total_cents: total,
    metadata: {},
  });
  if (li) throw new Error(li.message);

  return invoice;
}

export async function createPaymentRequestForInvoice(args: {
  tenantId: string;
  invoiceId: string;
  amountCents: number;
  taxCents?: number;
  send?: boolean;
  staffNote?: string | null;
  /** Optional cap for `expires_at` (ISO). Stripe session expiry is min(session, cap) when both exist. */
  expiresAtIso?: string | null;
}): Promise<FiPaymentRequestRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const iid = assertUuid(args.invoiceId, "invoiceId");
  const inv = await loadInvoiceForTenant(tid, iid);
  if (!inv) throw new Error("Invoice not found.");
  if (!isInvoiceOpenForCollection(inv.status)) throw new Error("Invoice is not open for payment requests.");
  const amt = Math.max(0, Math.floor(args.amountCents));
  if (!amt) throw new Error("amount_cents must be positive.");
  const bal = invoiceBalanceDueCents(inv);
  if (amt > bal) throw new Error("Amount exceeds invoice balance due.");

  const tax = Math.max(0, Math.floor(args.taxCents ?? 0));
  const total = amt + tax;
  const supabase = supabaseAdmin();
  const publicToken = randomBytes(18).toString("hex");
  const staffNote = args.staffNote?.trim() || null;
  const baseMeta: Record<string, unknown> = {};
  if (staffNote) baseMeta.staff_note = staffNote;

  const { data: pr, error } = await supabase
    .from("fi_payment_requests")
    .insert({
      tenant_id: tid,
      clinic_id: inv.clinic_id,
      patient_id: inv.patient_id,
      lead_id: inv.lead_id,
      case_id: inv.case_id,
      consultation_id: inv.consultation_id,
      invoice_id: iid,
      status: "draft",
      amount_cents: amt,
      tax_cents: tax,
      total_cents: total,
      currency: inv.currency,
      public_token: publicToken,
      metadata: baseMeta,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  let out = mapPaymentRequestRow(pr as Record<string, unknown>);

  const send = args.send === true;
  const stripeActive = readFiPaymentsEnabled() && readFiPaymentProviderId() === "stripe";

  if (send && stripeActive) {
    const provider = resolvePaymentProvider();
    const session = await provider.createCheckoutSession({
      tenantId: tid,
      invoice: inv,
      paymentRequestId: out.id,
      amountCents: amt,
      currency: inv.currency,
    });
    let expiresAt = session.expiresAt;
    const cap = args.expiresAtIso?.trim() || null;
    if (cap) {
      const capMs = new Date(cap).getTime();
      if (Number.isFinite(capMs)) {
        if (expiresAt) {
          const exMs = new Date(expiresAt).getTime();
          if (Number.isFinite(exMs) && capMs < exMs) expiresAt = cap;
        } else {
          expiresAt = cap;
        }
      }
    }
    const { data: upd, error: ue } = await supabase
      .from("fi_payment_requests")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider: "stripe",
        provider_checkout_session_id: session.sessionId,
        checkout_url: session.checkoutUrl,
        expires_at: expiresAt,
        metadata: {
          ...out.metadata,
          stripe_session: session.rawMetadata ?? {},
          collection_mode: "stripe_checkout",
        },
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid)
      .eq("id", out.id)
      .select("*")
      .single();
    if (ue) throw new Error(ue.message);
    out = mapPaymentRequestRow(upd as Record<string, unknown>);
  } else if (send) {
    const expiresAtManual = args.expiresAtIso?.trim() || null;
    const { data: upd, error: ue } = await supabase
      .from("fi_payment_requests")
      .update({
        status: "sent",
        sent_at: new Date().toISOString(),
        provider: readFiPaymentProviderId(),
        expires_at: expiresAtManual,
        metadata: {
          ...out.metadata,
          collection_mode: "manual_link_only",
          payments_module_enabled: readFiPaymentsEnabled(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tid)
      .eq("id", out.id)
      .select("*")
      .single();
    if (ue) throw new Error(ue.message);
    out = mapPaymentRequestRow(upd as Record<string, unknown>);
  }

  return out;
}

export async function updateInvoiceDueDateForTenant(args: {
  tenantId: string;
  invoiceId: string;
  dueDateYmd: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const iid = assertUuid(args.invoiceId, "invoiceId");
  const inv = await loadInvoiceForTenant(tid, iid);
  if (!inv) throw new Error("Invoice not found.");
  const due = args.dueDateYmd?.trim() || null;
  if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error("due_date must be YYYY-MM-DD.");
  const todayYmd = new Date().toISOString().slice(0, 10);
  const nextStatus = computeNextInvoiceStatus(
    {
      status: inv.status,
      total_cents: inv.total_cents,
      amount_paid_cents: inv.amount_paid_cents,
      due_date: due,
    },
    todayYmd
  );
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_invoices")
    .update({
      due_date: due,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", iid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function resendOpenPaymentRequest(args: { tenantId: string; paymentRequestId: string }): Promise<FiPaymentRequestRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const pid = assertUuid(args.paymentRequestId, "paymentRequestId");
  const supabase = supabaseAdmin();
  const { data: prRaw, error } = await supabase.from("fi_payment_requests").select("*").eq("tenant_id", tid).eq("id", pid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!prRaw) throw new Error("Payment request not found.");
  let pr = mapPaymentRequestRow(prRaw as Record<string, unknown>);
  const inv = await loadInvoiceForTenant(tid, pr.invoice_id);
  if (!inv) throw new Error("Invoice not found.");
  if (!isInvoiceOpenForCollection(inv.status)) throw new Error("Invoice is closed — cancel outstanding links instead.");
  if (invoiceBalanceDueCents(inv) <= 0) throw new Error("Invoice is already settled.");
  if (!["draft", "sent", "viewed"].includes(pr.status)) throw new Error("Only open payment requests can be resent.");

  const stripeActive = readFiPaymentsEnabled() && readFiPaymentProviderId() === "stripe";
  const nowIso = new Date().toISOString();
  const prevResends = Number(pr.metadata?.resend_count ?? 0) || 0;

  if (stripeActive) {
    const provider = resolvePaymentProvider();
    const session = await provider.createCheckoutSession({
      tenantId: tid,
      invoice: inv,
      paymentRequestId: pr.id,
      amountCents: pr.amount_cents,
      currency: pr.currency,
    });
    const { data: upd, error: ue } = await supabase
      .from("fi_payment_requests")
      .update({
        status: "sent",
        sent_at: nowIso,
        provider: "stripe",
        provider_checkout_session_id: session.sessionId,
        checkout_url: session.checkoutUrl,
        expires_at: session.expiresAt,
        metadata: {
          ...pr.metadata,
          stripe_session: session.rawMetadata ?? {},
          collection_mode: "stripe_checkout",
          resend_count: prevResends + 1,
          last_resent_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", pr.id)
      .select("*")
      .single();
    if (ue) throw new Error(ue.message);
    pr = mapPaymentRequestRow(upd as Record<string, unknown>);
  } else {
    const { data: upd, error: ue } = await supabase
      .from("fi_payment_requests")
      .update({
        status: "sent",
        sent_at: nowIso,
        metadata: {
          ...pr.metadata,
          collection_mode: "manual_link_only",
          resend_count: prevResends + 1,
          last_resent_at: nowIso,
        },
        updated_at: nowIso,
      })
      .eq("tenant_id", tid)
      .eq("id", pr.id)
      .select("*")
      .single();
    if (ue) throw new Error(ue.message);
    pr = mapPaymentRequestRow(upd as Record<string, unknown>);
  }

  return pr;
}

export async function markInvoiceManuallyPaid(args: {
  tenantId: string;
  invoiceId: string;
  recordedByFiUserId: string | null;
  notes?: string | null;
  todayYmd?: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const iid = assertUuid(args.invoiceId, "invoiceId");
  const inv = await loadInvoiceForTenant(tid, iid);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "cancelled" || inv.status === "refunded") throw new Error("Invoice cannot be marked paid.");
  const bal = invoiceBalanceDueCents(inv);
  if (bal <= 0) return inv;

  const supabase = supabaseAdmin();
  const { data: pay, error: pe } = await supabase
    .from("fi_payments")
    .insert({
      tenant_id: tid,
      clinic_id: inv.clinic_id,
      patient_id: inv.patient_id,
      lead_id: inv.lead_id,
      case_id: inv.case_id,
      consultation_id: inv.consultation_id,
      invoice_id: iid,
      payment_request_id: null,
      status: "manually_recorded",
      amount_cents: bal,
      tax_cents: 0,
      total_cents: bal,
      currency: inv.currency,
      provider: "manual",
      provider_ref: null,
      recorded_by_fi_user_id: args.recordedByFiUserId?.trim() || null,
      metadata: { notes: args.notes?.trim() || null },
    })
    .select("*")
    .single();
  if (pe) throw new Error(pe.message);

  const nextPaid = inv.amount_paid_cents + bal;
  const updated = await patchInvoiceAfterPayment(tid, iid, nextPaid, args.todayYmd ?? null);

  try {
    await appendCrmActivityEvent({
      tenantId: tid,
      leadId: inv.lead_id,
      patientId: inv.patient_id,
      caseId: inv.case_id,
      activityKind: "fi_os_payment_received",
      title: "Payment recorded (invoice)",
      detail: {
        invoice_id: iid,
        payment_id: String((pay as { id: string }).id),
        amount_cents: bal,
        currency: inv.currency,
        channel: "manual_invoice_mark_paid",
      },
    });
  } catch {
    /* CRM row optional when anchors missing */
  }

  return updated;
}

export async function cancelInvoice(args: {
  tenantId: string;
  invoiceId: string;
  reason?: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const iid = assertUuid(args.invoiceId, "invoiceId");
  const supabase = supabaseAdmin();
  const inv = await loadInvoiceForTenant(tid, iid);
  if (!inv) throw new Error("Invoice not found.");
  if (inv.status === "paid" || inv.status === "refunded") throw new Error("Cannot cancel a paid or refunded invoice.");
  const { data, error } = await supabase
    .from("fi_invoices")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: args.reason?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", iid)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapInvoiceRow(data as Record<string, unknown>);
}

export async function recordGatewayPaymentSuccess(args: {
  tenantId: string;
  invoiceId: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerRef: string | null;
  paymentIntentId?: string | null;
  paymentRequestId?: string | null;
  todayYmd?: string | null;
}): Promise<FiInvoiceRow> {
  const tid = assertUuid(args.tenantId, "tenantId");
  const iid = assertUuid(args.invoiceId, "invoiceId");
  const inv = await loadInvoiceForTenant(tid, iid);
  if (!inv) throw new Error("Invoice not found.");
  const payAmt = Math.max(0, Math.floor(args.amountCents));
  const supabase = supabaseAdmin();
  const providerNorm = args.provider.trim().toLowerCase();
  const intentId = args.paymentIntentId?.trim() || null;

  if (providerNorm === "stripe" && intentId) {
    const { data: existingRows, error: existingErr } = await supabase
      .from("fi_payments")
      .select("id")
      .eq("tenant_id", tid)
      .eq("provider", "stripe")
      .eq("provider_payment_intent_id", intentId)
      .limit(1);
    if (existingErr) throw new Error(existingErr.message);
    if (existingRows && existingRows.length > 0) {
      const current = await loadInvoiceForTenant(tid, iid);
      if (!current) throw new Error("Invoice not found.");
      return current;
    }
  }

  const { error: pe } = await supabase.from("fi_payments").insert({
    tenant_id: tid,
    clinic_id: inv.clinic_id,
    patient_id: inv.patient_id,
    lead_id: inv.lead_id,
    case_id: inv.case_id,
    consultation_id: inv.consultation_id,
    invoice_id: iid,
    payment_request_id: args.paymentRequestId?.trim() || null,
    status: "succeeded",
    amount_cents: payAmt,
    tax_cents: 0,
    total_cents: payAmt,
    currency: args.currency.trim().toUpperCase(),
    provider: providerNorm === "stripe" ? "stripe" : args.provider.trim(),
    provider_ref: args.providerRef,
    provider_payment_intent_id: intentId,
    metadata: {},
  });
  if (pe) {
    if (
      isFiStripeGatewayPaymentIntentDuplicateInsert(pe, {
        provider: args.provider,
        paymentIntentId: args.paymentIntentId,
      })
    ) {
      const current = await loadInvoiceForTenant(tid, iid);
      if (!current) throw new Error("Invoice not found.");
      return current;
    }
    throw new Error(pe.message);
  }

  const nextPaid = inv.amount_paid_cents + payAmt;
  const updated = await patchInvoiceAfterPayment(tid, iid, nextPaid, args.todayYmd ?? null);

  if (args.paymentRequestId?.trim()) {
    await supabase
      .from("fi_payment_requests")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("tenant_id", tid)
      .eq("id", args.paymentRequestId.trim());
  }

  try {
    await appendCrmActivityEvent({
      tenantId: tid,
      leadId: inv.lead_id,
      patientId: inv.patient_id,
      caseId: inv.case_id,
      activityKind: "fi_os_payment_received",
      title: "Payment received (gateway)",
      detail: {
        invoice_id: iid,
        amount_cents: payAmt,
        currency: args.currency,
        provider: args.provider,
      },
    });
  } catch {
    /* optional */
  }

  return updated;
}

export async function recordGatewayPaymentFailure(args: {
  tenantId: string;
  invoiceId: string | null;
  leadId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  message: string;
  provider: string;
  paymentRequestId?: string | null;
}): Promise<void> {
  const tid = args.tenantId.trim();
  const prId = args.paymentRequestId?.trim() || null;
  if (prId && tid) {
    try {
      const supabase = supabaseAdmin();
      const { data: row, error: le } = await supabase
        .from("fi_payment_requests")
        .select("metadata")
        .eq("tenant_id", tid)
        .eq("id", prId)
        .maybeSingle();
      if (!le && row) {
        const prev = (row as { metadata?: Record<string, unknown> }).metadata ?? {};
        const failAt = new Date().toISOString();
        await supabase
          .from("fi_payment_requests")
          .update({
            metadata: {
              ...prev,
              stripe_checkout_failed_at: failAt,
              stripe_failure_message: args.message,
            },
            updated_at: failAt,
          })
          .eq("tenant_id", tid)
          .eq("id", prId);
      }
    } catch {
      /* best-effort metadata */
    }
  }

  try {
    await appendCrmActivityEvent({
      tenantId: tid,
      leadId: args.leadId ?? null,
      patientId: args.patientId ?? null,
      caseId: args.caseId ?? null,
      activityKind: "fi_os_payment_failed",
      title: "Payment failed (gateway)",
      detail: {
        invoice_id: args.invoiceId,
        payment_request_id: prId,
        message: args.message,
        provider: args.provider,
      },
    });
  } catch {
    /* optional */
  }
}
