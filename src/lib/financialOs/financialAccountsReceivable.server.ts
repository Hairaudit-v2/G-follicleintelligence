import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { isPostgresUniqueViolation } from "@/src/lib/payments/stripeWebhookIdempotency";
import { isMissingDatabaseRelationError } from "@/src/lib/receptionOs/receptionOsLoaderResilience";
import {
  applyPaymentToArCase,
  arCaseDedupeKey,
  buildAccountsReceivableCase,
  buildAccountsReceivableEvent,
  buildCaseArDisplayStatus,
  buildReminderDraft,
  deriveArCaseFromInvoice,
  aggregateAccountsReceivableMetrics,
  calculateDaysOverdue,
  calculateReceivableRiskLevel,
  classifyReceivableType,
  isOpenArCaseStatus,
  mapAccountsReceivableCaseRow,
  mapAccountsReceivableEventRow,
  recommendNextArAction,
  FI_CASE_AR_DISPLAY_LABELS,
  type AccountsReceivableDashboardMetrics,
  type FiAccountsReceivableCaseRow,
  type FiAccountsReceivableEventRow,
  type FiArCaseStatus,
  type FiArEventKind,
  type FiArReceivableType,
  type FiArReminderChannel,
  type FiCaseArDisplayStatus,
} from "@/src/lib/financialOs/financialAccountsReceivableCore";
import { mapInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceMappers";
import type { FiInvoiceRow } from "@/src/lib/revenueOs/revenueInvoiceModel";
import { invoiceBalanceDueCents, isInvoiceOpenForCollection } from "@/src/lib/revenueOs/revenueInvoiceModel";

export type {
  FiAccountsReceivableCaseRow,
  FiAccountsReceivableEventRow,
  FiArCaseStatus,
  FiArEventKind,
  FiArReceivableType,
  FiArReminderChannel,
  FiCaseArDisplayStatus,
  AccountsReceivableDashboardMetrics,
};

export {
  classifyReceivableType,
  calculateDaysOverdue,
  calculateReceivableRiskLevel,
  recommendNextArAction,
  buildAccountsReceivableCase,
  buildAccountsReceivableEvent,
  buildReminderDraft,
  buildCaseArDisplayStatus,
  aggregateAccountsReceivableMetrics,
  FI_CASE_AR_DISPLAY_LABELS,
};

function assertTenantScope(expectedTenantId: string, rowTenantId: string, label: string): void {
  if (expectedTenantId.trim() !== rowTenantId.trim()) {
    throw new Error(`${label} tenant mismatch.`);
  }
}

function mapRow(raw: Record<string, unknown>): FiAccountsReceivableCaseRow {
  return mapAccountsReceivableCaseRow(raw);
}

function mapEventRow(raw: Record<string, unknown>): FiAccountsReceivableEventRow {
  return mapAccountsReceivableEventRow(raw);
}

export async function insertAccountsReceivableEvent(opts: {
  tenantId: string;
  arCaseId: string;
  eventKind: FiArEventKind;
  actorFiUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<FiAccountsReceivableEventRow> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const caseId = assertNonEmptyUuid(opts.arCaseId, "arCaseId").trim();
  const payload = buildAccountsReceivableEvent({
    tenant_id: tid,
    ar_case_id: caseId,
    event_kind: opts.eventKind,
    actor_fi_user_id: opts.actorFiUserId,
    detail: opts.detail,
  });

  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_accounts_receivable_events").insert(payload).select("*").single();
  if (error) throw new Error(error.message);
  const row = mapEventRow(data as Record<string, unknown>);
  assertTenantScope(tid, row.tenant_id, "fi_accounts_receivable_events");
  return row;
}

async function getOpenArCaseByInvoice(
  tenantId: string,
  invoiceId: string,
  receivableType: FiArReceivableType,
): Promise<FiAccountsReceivableCaseRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .select("*")
    .eq("tenant_id", tenantId.trim())
    .eq("invoice_id", invoiceId.trim())
    .eq("receivable_type", receivableType)
    .not("status", "in", '("resolved","written_off")')
    .maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function getAccountsReceivableCaseById(tenantId: string, caseId: string): Promise<FiAccountsReceivableCaseRow | null> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(caseId, "caseId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from("fi_accounts_receivable_cases").select("*").eq("tenant_id", tid).eq("id", id).maybeSingle();
  if (error) {
    if (isMissingDatabaseRelationError(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const row = mapRow(data as Record<string, unknown>);
  assertTenantScope(tid, row.tenant_id, "fi_accounts_receivable_cases");
  return row;
}

export async function loadAccountsReceivableEventsForCase(
  tenantId: string,
  arCaseId: string,
  limit = 50,
): Promise<FiAccountsReceivableEventRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_events")
    .select("*")
    .eq("tenant_id", tid)
    .eq("ar_case_id", id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => {
    const row = mapEventRow(r as Record<string, unknown>);
    assertTenantScope(tid, row.tenant_id, "fi_accounts_receivable_events");
    return row;
  });
}

export type UpsertArCaseFromInvoiceOpts = {
  tenantId: string;
  invoice: FiInvoiceRow;
  todayYmd: string;
  trigger?: "invoice_overdue" | "deposit_deadline_missed" | "payment_mismatch" | "manual";
  actorFiUserId?: string | null;
};

/**
 * Opens or refreshes an AR case from an invoice signal. Duplicate open cases are prevented
 * by DB unique index on (tenant_id, invoice_id, receivable_type).
 */
export async function upsertArCaseFromInvoice(opts: UpsertArCaseFromInvoiceOpts): Promise<FiAccountsReceivableCaseRow | null> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const derived = deriveArCaseFromInvoice({
    tenant_id: tid,
    todayYmd: opts.todayYmd,
    invoice: {
      id: opts.invoice.id,
      patient_id: opts.invoice.patient_id,
      case_id: opts.invoice.case_id,
      lead_id: opts.invoice.lead_id,
      clinic_id: opts.invoice.clinic_id,
      invoice_kind: opts.invoice.invoice_kind,
      total_cents: opts.invoice.total_cents,
      amount_paid_cents: opts.invoice.amount_paid_cents,
      remaining_balance_cents: opts.invoice.remaining_balance_cents ?? invoiceBalanceDueCents(opts.invoice),
      due_date: opts.invoice.due_date,
      metadata: opts.invoice.metadata,
      title: opts.invoice.title,
    },
    trigger: opts.trigger,
  });
  if (!derived) return null;

  const existing = await getOpenArCaseByInvoice(tid, opts.invoice.id, derived.receivable_type);
  const supabase = supabaseAdmin();

  if (existing) {
    const patch = {
      outstanding_amount_cents: derived.outstanding_amount_cents,
      days_overdue: derived.days_overdue,
      risk_level: derived.risk_level,
      next_action_at: derived.next_action_at,
      source_metadata: { ...existing.source_metadata, ...derived.source_metadata },
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("fi_accounts_receivable_cases")
      .update(patch)
      .eq("tenant_id", tid)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase.from("fi_accounts_receivable_cases").insert(derived).select("*").single();
  if (error) {
    if (isPostgresUniqueViolation(error)) {
      const dup = await getOpenArCaseByInvoice(tid, opts.invoice.id, derived.receivable_type);
      if (dup) return dup;
    }
    throw new Error(error.message);
  }
  const row = mapRow(data as Record<string, unknown>);
  await insertAccountsReceivableEvent({
    tenantId: tid,
    arCaseId: row.id,
    eventKind: "ar_case_opened",
    actorFiUserId: opts.actorFiUserId,
    detail: {
      invoice_id: opts.invoice.id,
      trigger: opts.trigger ?? "invoice_overdue",
      dedupe_key: arCaseDedupeKey(tid, opts.invoice.id, derived.receivable_type),
    },
  });
  return row;
}

export async function syncAccountsReceivableOnInvoiceChange(opts: {
  tenantId: string;
  invoice: FiInvoiceRow;
  todayYmd: string;
  previousOutstandingCents?: number;
  actorFiUserId?: string | null;
}): Promise<void> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const outstanding = opts.invoice.remaining_balance_cents ?? invoiceBalanceDueCents(opts.invoice);

  if (outstanding <= 0 || !isInvoiceOpenForCollection(opts.invoice.status)) {
    await resolveArCasesForInvoice(tid, opts.invoice.id, opts.actorFiUserId, "Payment received — balance cleared.");
    return;
  }

  const receivableType = classifyReceivableType({
    invoice_kind: opts.invoice.invoice_kind,
    metadata: opts.invoice.metadata,
  });
  const existing = await getOpenArCaseByInvoice(tid, opts.invoice.id, receivableType);

  if (existing) {
    const prevOutstanding = opts.previousOutstandingCents ?? existing.outstanding_amount_cents;
    const paymentDelta = Math.max(0, prevOutstanding - outstanding);
    if (paymentDelta > 0) {
      const applied = applyPaymentToArCase({
        case: existing,
        payment_amount_cents: paymentDelta,
        todayYmd: opts.todayYmd,
        receivable_type: receivableType,
        days_overdue: opts.invoice.days_overdue,
      });
      if (applied.resolved) {
        await resolveArCase(tid, existing.id, opts.actorFiUserId, { note: "Auto-resolved after payment." });
        return;
      }
      const supabase = supabaseAdmin();
      await supabase
        .from("fi_accounts_receivable_cases")
        .update({
          outstanding_amount_cents: applied.outstanding_amount_cents,
          risk_level: applied.risk_level,
          days_overdue: opts.invoice.days_overdue,
          updated_at: new Date().toISOString(),
        })
        .eq("tenant_id", tid)
        .eq("id", existing.id);
      return;
    }
  }

  const daysOverdue = calculateDaysOverdue({
    due_date: opts.invoice.due_date,
    outstanding_amount_cents: outstanding,
    todayYmd: opts.todayYmd,
  });
  if (daysOverdue > 0 || opts.invoice.status === "overdue") {
    await upsertArCaseFromInvoice({
      tenantId: tid,
      invoice: opts.invoice,
      todayYmd: opts.todayYmd,
      trigger: "invoice_overdue",
      actorFiUserId: opts.actorFiUserId,
    });
  }
}

async function resolveArCasesForInvoice(
  tenantId: string,
  invoiceId: string,
  actorFiUserId?: string | null,
  note?: string,
): Promise<void> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .eq("invoice_id", invoiceId.trim())
    .not("status", "in", '("resolved","written_off")');
  if (error) {
    if (isMissingDatabaseRelationError(error)) return;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    await resolveArCase(tenantId, String((row as { id: string }).id), actorFiUserId, { note });
  }
}

export async function resolveArCase(
  tenantId: string,
  arCaseId: string,
  actorFiUserId?: string | null,
  detail?: Record<string, unknown>,
): Promise<FiAccountsReceivableCaseRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .update({
      status: "resolved",
      outstanding_amount_cents: 0,
      risk_level: "low",
      resolved_at: now,
      next_action_at: null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);
  await insertAccountsReceivableEvent({
    tenantId: tid,
    arCaseId: id,
    eventKind: "resolved",
    actorFiUserId,
    detail: detail ?? {},
  });
  return row;
}

export async function writeOffArCase(
  tenantId: string,
  arCaseId: string,
  actorFiUserId?: string | null,
  detail?: Record<string, unknown>,
): Promise<FiAccountsReceivableCaseRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .update({
      status: "written_off",
      resolved_at: now,
      next_action_at: null,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const row = mapRow(data as Record<string, unknown>);
  await insertAccountsReceivableEvent({
    tenantId: tid,
    arCaseId: id,
    eventKind: "written_off",
    actorFiUserId,
    detail: detail ?? {},
  });
  return row;
}

export async function createManualArCase(opts: {
  tenantId: string;
  invoiceId: string;
  todayYmd: string;
  actorFiUserId?: string | null;
  assignedFiUserId?: string | null;
}): Promise<FiAccountsReceivableCaseRow> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const iid = assertNonEmptyUuid(opts.invoiceId, "invoiceId").trim();
  const supabase = supabaseAdmin();
  const { data: invRaw, error: invErr } = await supabase.from("fi_invoices").select("*").eq("tenant_id", tid).eq("id", iid).maybeSingle();
  if (invErr) throw new Error(invErr.message);
  if (!invRaw) throw new Error("Invoice not found.");
  const invoice = mapInvoiceRow(invRaw as Record<string, unknown>);
  const row = await upsertArCaseFromInvoice({
    tenantId: tid,
    invoice,
    todayYmd: opts.todayYmd,
    trigger: "manual",
    actorFiUserId: opts.actorFiUserId,
  });
  if (!row) throw new Error("Could not derive AR case from invoice.");
  if (opts.assignedFiUserId?.trim()) {
    return assignArCaseOwner(tid, row.id, opts.assignedFiUserId, opts.actorFiUserId);
  }
  return row;
}

export async function assignArCaseOwner(
  tenantId: string,
  arCaseId: string,
  assignedFiUserId: string | null,
  actorFiUserId?: string | null,
): Promise<FiAccountsReceivableCaseRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .update({
      assigned_fi_user_id: assignedFiUserId?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function setArCaseNextAction(
  tenantId: string,
  arCaseId: string,
  nextActionAt: string | null,
  actorFiUserId?: string | null,
): Promise<FiAccountsReceivableCaseRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .update({
      next_action_at: nextActionAt?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as Record<string, unknown>);
}

export async function logArCall(
  tenantId: string,
  arCaseId: string,
  actorFiUserId?: string | null,
  notes?: string,
): Promise<FiAccountsReceivableEventRow> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  await supabase
    .from("fi_accounts_receivable_cases")
    .update({ last_contacted_at: now, status: "call_required", updated_at: now })
    .eq("tenant_id", tid)
    .eq("id", id);
  return insertAccountsReceivableEvent({
    tenantId: tid,
    arCaseId: id,
    eventKind: "call_logged",
    actorFiUserId,
    detail: { notes: notes?.trim() || null },
  });
}

export async function markArReminderSent(
  tenantId: string,
  arCaseId: string,
  channel: FiArReminderChannel,
  actorFiUserId?: string | null,
): Promise<{ case: FiAccountsReceivableCaseRow; event: FiAccountsReceivableEventRow; draft: ReturnType<typeof buildReminderDraft> }> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const id = assertNonEmptyUuid(arCaseId, "arCaseId").trim();
  const existing = await getAccountsReceivableCaseById(tid, id);
  if (!existing) throw new Error("AR case not found.");

  const draft = buildReminderDraft({
    receivable_type: existing.receivable_type,
    channel,
    outstanding_amount_cents: existing.outstanding_amount_cents,
    days_overdue: existing.days_overdue,
    invoice_title: typeof existing.source_metadata.invoice_title === "string" ? existing.source_metadata.invoice_title : null,
  });

  const now = new Date().toISOString();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .update({
      status: "reminder_sent",
      last_contacted_at: now,
      updated_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const eventKind: FiArEventKind = channel === "sms" ? "sms_sent" : "reminder_sent";
  const event = await insertAccountsReceivableEvent({
    tenantId: tid,
    arCaseId: id,
    eventKind,
    actorFiUserId,
    detail: {
      ...draft,
      delivery_mode: "draft_only",
      note: "Phase 4 — reminder queued as draft; no live SMS/email sent.",
    },
  });

  return { case: mapRow(data as Record<string, unknown>), event, draft };
}

export async function syncArFromReconciliationMismatch(opts: {
  tenantId: string;
  invoiceId: string;
  todayYmd: string;
  reconciliationId?: string;
  actorFiUserId?: string | null;
}): Promise<FiAccountsReceivableCaseRow | null> {
  const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
  const iid = assertNonEmptyUuid(opts.invoiceId, "invoiceId").trim();
  const supabase = supabaseAdmin();
  const { data: invRaw, error } = await supabase.from("fi_invoices").select("*").eq("tenant_id", tid).eq("id", iid).maybeSingle();
  if (error) throw new Error(error.message);
  if (!invRaw) return null;
  const invoice = mapInvoiceRow(invRaw as Record<string, unknown>);
  return upsertArCaseFromInvoice({
    tenantId: tid,
    invoice,
    todayYmd: opts.todayYmd,
    trigger: "payment_mismatch",
    actorFiUserId: opts.actorFiUserId,
  });
}

export type AccountsReceivableWorkQueueRow = FiAccountsReceivableCaseRow & {
  patient_label: string | null;
  invoice_label: string | null;
  owner_label: string | null;
};

export type AccountsReceivableWorkQueueFilters = {
  risk?: string | null;
  status?: string | null;
  receivable_type?: string | null;
  assigned_fi_user_id?: string | null;
  clinic_id?: string | null;
};

export async function loadAccountsReceivableWorkQueue(
  tenantId: string,
  filters: AccountsReceivableWorkQueueFilters = {},
  limit = 200,
): Promise<AccountsReceivableWorkQueueRow[]> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();
  let q = supabase.from("fi_accounts_receivable_cases").select("*").eq("tenant_id", tid).order("next_action_at", { ascending: true, nullsFirst: false }).limit(limit);
  if (filters.risk?.trim() && filters.risk !== "all") q = q.eq("risk_level", filters.risk.trim());
  if (filters.status?.trim() && filters.status !== "all") q = q.eq("status", filters.status.trim());
  if (filters.receivable_type?.trim() && filters.receivable_type !== "all") q = q.eq("receivable_type", filters.receivable_type.trim());
  if (filters.assigned_fi_user_id?.trim() && filters.assigned_fi_user_id !== "all") {
    if (filters.assigned_fi_user_id === "unassigned") q = q.is("assigned_fi_user_id", null);
    else q = q.eq("assigned_fi_user_id", filters.assigned_fi_user_id.trim());
  }
  if (filters.clinic_id?.trim() && filters.clinic_id !== "all") q = q.eq("clinic_id", filters.clinic_id.trim());

  const { data, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return [];
    throw new Error(error.message);
  }

  const rows = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  const patientIds = [...new Set(rows.map((r) => r.patient_id).filter(Boolean))] as string[];
  const invoiceIds = [...new Set(rows.map((r) => r.invoice_id).filter(Boolean))] as string[];
  const userIds = [...new Set(rows.map((r) => r.assigned_fi_user_id).filter(Boolean))] as string[];

  const patientLabels = new Map<string, string>();
  if (patientIds.length) {
    const { data: patients } = await supabase.from("fi_patients").select("id, first_name, last_name").eq("tenant_id", tid).in("id", patientIds);
    for (const p of patients ?? []) {
      const raw = p as { id: string; first_name?: string | null; last_name?: string | null };
      patientLabels.set(raw.id, [raw.first_name, raw.last_name].filter(Boolean).join(" ").trim() || raw.id.slice(0, 8));
    }
  }

  const invoiceLabels = new Map<string, string>();
  if (invoiceIds.length) {
    const { data: invoices } = await supabase.from("fi_invoices").select("id, title, invoice_number").eq("tenant_id", tid).in("id", invoiceIds);
    for (const inv of invoices ?? []) {
      const raw = inv as { id: string; title?: string | null; invoice_number?: string | null };
      invoiceLabels.set(raw.id, raw.title?.trim() || raw.invoice_number?.trim() || raw.id.slice(0, 8));
    }
  }

  const userLabels = new Map<string, string>();
  if (userIds.length) {
    const { data: users } = await supabase.from("fi_users").select("id, display_name, email").eq("tenant_id", tid).in("id", userIds);
    for (const u of users ?? []) {
      const raw = u as { id: string; display_name?: string | null; email?: string | null };
      userLabels.set(raw.id, raw.display_name?.trim() || raw.email?.trim() || raw.id.slice(0, 8));
    }
  }

  return rows.map((r) => ({
    ...r,
    patient_label: r.patient_id ? (patientLabels.get(r.patient_id) ?? null) : null,
    invoice_label: r.invoice_id ? (invoiceLabels.get(r.invoice_id) ?? null) : null,
    owner_label: r.assigned_fi_user_id ? (userLabels.get(r.assigned_fi_user_id) ?? null) : null,
  }));
}

export async function loadAccountsReceivableDashboardMetrics(tenantId: string): Promise<AccountsReceivableDashboardMetrics> {
  const rows = await loadAccountsReceivableWorkQueue(tenantId, {}, 500);
  return aggregateAccountsReceivableMetrics(rows);
}

export type CaseAccountsReceivableSummary = {
  display_status: FiCaseArDisplayStatus;
  display_label: string;
  open_cases: FiAccountsReceivableCaseRow[];
  total_outstanding_cents: number;
};

export async function loadCaseAccountsReceivableSummary(tenantId: string, caseId: string): Promise<CaseAccountsReceivableSummary> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const cid = assertNonEmptyUuid(caseId, "caseId").trim();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_accounts_receivable_cases")
    .select("*")
    .eq("tenant_id", tid)
    .eq("case_id", cid)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (isMissingDatabaseRelationError(error)) {
      return { display_status: "no_ar_issue", display_label: "No AR issue", open_cases: [], total_outstanding_cents: 0 };
    }
    throw new Error(error.message);
  }
  const cases = (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
  const open_cases = cases.filter((c) => isOpenArCaseStatus(c.status) && c.outstanding_amount_cents > 0);
  const display_status = buildCaseArDisplayStatus(cases);
  return {
    display_status,
    display_label: FI_CASE_AR_DISPLAY_LABELS[display_status],
    open_cases,
    total_outstanding_cents: open_cases.reduce((acc, c) => acc + c.outstanding_amount_cents, 0),
  };
}

/** Cron helper — scan overdue invoices and open AR cases. */
export async function runAccountsReceivableOverdueSyncJob(opts: {
  runDateYmd: string;
  limit: number;
  tenantId?: string | null;
}): Promise<{ examined: number; opened: number; updated: number }> {
  const supabase = supabaseAdmin();
  let q = supabase
    .from("fi_invoices")
    .select("*")
    .in("status", ["sent", "awaiting_payment", "partially_paid", "overdue"])
    .not("due_date", "is", null)
    .lt("due_date", opts.runDateYmd.trim())
    .order("updated_at", { ascending: false })
    .limit(opts.limit);
  if (opts.tenantId?.trim()) q = q.eq("tenant_id", opts.tenantId.trim());
  const { data: rows, error } = await q;
  if (error) {
    if (isMissingDatabaseRelationError(error)) return { examined: 0, opened: 0, updated: 0 };
    throw new Error(error.message);
  }

  let examined = 0;
  let opened = 0;
  let updated = 0;
  for (const raw of rows ?? []) {
    examined += 1;
    const invoice = mapInvoiceRow(raw as Record<string, unknown>);
    if (invoiceBalanceDueCents(invoice) <= 0) continue;
    const receivableType = classifyReceivableType({ invoice_kind: invoice.invoice_kind, metadata: invoice.metadata });
    const existing = await getOpenArCaseByInvoice(invoice.tenant_id, invoice.id, receivableType);
    const result = await upsertArCaseFromInvoice({
      tenantId: invoice.tenant_id,
      invoice,
      todayYmd: opts.runDateYmd,
      trigger: invoice.invoice_kind === "surgery_deposit" ? "deposit_deadline_missed" : "invoice_overdue",
    });
    if (!result) continue;
    if (existing) updated += 1;
    else opened += 1;
  }
  return { examined, opened, updated };
}
