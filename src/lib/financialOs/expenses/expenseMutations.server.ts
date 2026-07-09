import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseExpenseBankCsv } from "@/src/lib/financialOs/expenses/expenseCsvParse";
import {
  assertImportLineCommitEligible,
  buildImportLineDraftsFromCsv,
  resolveCommitStatuses,
} from "@/src/lib/financialOs/expenses/expenseImportCore";
import type {
  CreateExpenseImportInput,
  CreateManualExpenseInput,
  UpdateExpenseInput,
} from "@/src/lib/financialOs/expenses/expenseSchemas";
import {
  categoryCodeToIdMap,
  ensureExpenseCategoriesForTenant,
  loadExpenseById,
  loadExpenseImportById,
  loadExpenseImportLines,
} from "@/src/lib/financialOs/expenses/expenseLoaders.server";
import {
  mapExpenseImportRow,
  mapExpenseRow,
  type FiExpenseImportRow,
  type FiExpenseRow,
  type FiExpenseStatus,
} from "@/src/lib/financialOs/expenses/expenseTypes";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

async function writeAudit(input: {
  tenantId: string;
  action: string;
  actorFiUserId?: string | null;
  expenseId?: string | null;
  importId?: string | null;
  importLineId?: string | null;
  previous?: Record<string, unknown>;
  next?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<void> {
  const db = client(input.supabase);
  const { error } = await db.from("fi_expense_audit_events").insert({
    tenant_id: input.tenantId.trim(),
    expense_id: input.expenseId ?? null,
    import_id: input.importId ?? null,
    import_line_id: input.importLineId ?? null,
    action: input.action,
    actor_fi_user_id: input.actorFiUserId ?? null,
    previous: input.previous ?? {},
    next: input.next ?? {},
  });
  if (error) throw new Error(error.message);
}

export async function createManualExpense(input: {
  tenantId: string;
  body: CreateManualExpenseInput;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiExpenseRow> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(input.supabase);
  await ensureExpenseCategoriesForTenant(tid, db);

  const status: FiExpenseStatus = input.body.status === "reviewed" ? "reviewed" : "draft";
  const row = {
    tenant_id: tid,
    clinic_id: input.body.clinic_id ?? null,
    status,
    expense_date: input.body.expense_date,
    amount_cents: input.body.amount_cents,
    currency: (input.body.currency ?? "AUD").toUpperCase(),
    vendor_name: input.body.vendor_name?.trim() || null,
    description: input.body.description?.trim() || null,
    category_id: input.body.category_id ?? null,
    payment_method: input.body.payment_method ?? null,
    lead_id: input.body.lead_id ?? null,
    case_id: input.body.case_id ?? null,
    patient_id: input.body.patient_id ?? null,
    campaign_key: input.body.campaign_key?.trim() || null,
    procedure_type: input.body.procedure_type?.trim() || null,
    created_by_fi_user_id: input.actorFiUserId ?? null,
    reviewed_by_fi_user_id: status === "reviewed" ? (input.actorFiUserId ?? null) : null,
    idempotency_key: input.body.idempotency_key?.trim() || null,
    metadata: {},
  };

  if (row.idempotency_key) {
    const existing = await db
      .from("fi_expenses")
      .select("*")
      .eq("tenant_id", tid)
      .eq("idempotency_key", row.idempotency_key)
      .maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    if (existing.data) {
      return mapExpenseRow(existing.data as Record<string, unknown>);
    }
  }

  const { data, error } = await db.from("fi_expenses").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  const created = mapExpenseRow(data as Record<string, unknown>);
  if (created.tenant_id !== tid) throw new Error("Tenant isolation violation on create.");

  await writeAudit({
    tenantId: tid,
    action: "created",
    actorFiUserId: input.actorFiUserId,
    expenseId: created.id,
    next: { status: created.status, amount_cents: created.amount_cents },
    supabase: db,
  });

  return created;
}

export async function updateExpense(input: {
  tenantId: string;
  body: UpdateExpenseInput;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiExpenseRow> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const existing = await loadExpenseById(tid, input.body.expense_id, db);
  if (!existing) throw new Error("Expense not found.");
  if (existing.status === "void") throw new Error("Voided expenses cannot be edited.");
  if (existing.status === "posted" && input.body.status && input.body.status !== "posted") {
    throw new Error("Posted expenses cannot change status except via void.");
  }

  const patch: Record<string, unknown> = {};
  const b = input.body;
  if (b.expense_date != null) patch.expense_date = b.expense_date;
  if (b.amount_cents != null) patch.amount_cents = b.amount_cents;
  if (b.currency != null) patch.currency = b.currency.toUpperCase();
  if (b.vendor_name !== undefined) patch.vendor_name = b.vendor_name?.trim() || null;
  if (b.description !== undefined) patch.description = b.description?.trim() || null;
  if (b.category_id !== undefined) patch.category_id = b.category_id;
  if (b.payment_method !== undefined) patch.payment_method = b.payment_method;
  if (b.clinic_id !== undefined) patch.clinic_id = b.clinic_id;
  if (b.lead_id !== undefined) patch.lead_id = b.lead_id;
  if (b.case_id !== undefined) patch.case_id = b.case_id;
  if (b.patient_id !== undefined) patch.patient_id = b.patient_id;
  if (b.campaign_key !== undefined) patch.campaign_key = b.campaign_key?.trim() || null;
  if (b.procedure_type !== undefined) patch.procedure_type = b.procedure_type?.trim() || null;
  if (b.status != null) {
    if (b.status === "void") throw new Error("Use voidExpense to void.");
    if (b.status === "posted") throw new Error("Use postExpense to post.");
    patch.status = b.status;
    if (b.status === "reviewed") {
      patch.reviewed_by_fi_user_id = input.actorFiUserId ?? null;
    }
  }

  const { data, error } = await db
    .from("fi_expenses")
    .update(patch)
    .eq("tenant_id", tid)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const updated = mapExpenseRow(data as Record<string, unknown>);

  await writeAudit({
    tenantId: tid,
    action: "updated",
    actorFiUserId: input.actorFiUserId,
    expenseId: updated.id,
    previous: { status: existing.status, amount_cents: existing.amount_cents },
    next: { status: updated.status, amount_cents: updated.amount_cents },
    supabase: db,
  });

  return updated;
}

export async function postExpense(input: {
  tenantId: string;
  expenseId: string;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiExpenseRow> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const existing = await loadExpenseById(tid, input.expenseId, db);
  if (!existing) throw new Error("Expense not found.");
  if (existing.status === "void") throw new Error("Cannot post a voided expense.");
  if (existing.status === "posted") return existing;
  if (existing.amount_cents < 0) throw new Error("Invalid amount.");

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("fi_expenses")
    .update({
      status: "posted",
      posted_at: now,
      reviewed_by_fi_user_id: existing.reviewed_by_fi_user_id ?? input.actorFiUserId ?? null,
    })
    .eq("tenant_id", tid)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const posted = mapExpenseRow(data as Record<string, unknown>);

  await writeAudit({
    tenantId: tid,
    action: "posted",
    actorFiUserId: input.actorFiUserId,
    expenseId: posted.id,
    previous: { status: existing.status },
    next: { status: "posted", posted_at: now },
    supabase: db,
  });

  // Phase 1: no fi_financial_transactions write (ledger bridge deferred).
  return posted;
}

export async function voidExpense(input: {
  tenantId: string;
  expenseId: string;
  reason?: string | null;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<FiExpenseRow> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const existing = await loadExpenseById(tid, input.expenseId, db);
  if (!existing) throw new Error("Expense not found.");
  if (existing.status === "void") return existing;

  const now = new Date().toISOString();
  const metadata = {
    ...existing.metadata,
    void_reason: input.reason?.trim() || null,
  };

  const { data, error } = await db
    .from("fi_expenses")
    .update({ status: "void", voided_at: now, metadata })
    .eq("tenant_id", tid)
    .eq("id", existing.id)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const voided = mapExpenseRow(data as Record<string, unknown>);

  await writeAudit({
    tenantId: tid,
    action: "voided",
    actorFiUserId: input.actorFiUserId,
    expenseId: voided.id,
    previous: { status: existing.status },
    next: { status: "void", reason: input.reason?.trim() || null },
    supabase: db,
  });

  return voided;
}

export async function createExpenseImportFromCsv(input: {
  tenantId: string;
  body: CreateExpenseImportInput;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ importRow: FiExpenseImportRow; lineCount: number; parseErrors: string[] }> {
  const tid = input.tenantId.trim();
  if (!tid) throw new Error("tenantId is required.");
  const db = client(input.supabase);
  const categories = await ensureExpenseCategoriesForTenant(tid, db);
  const codeMap = categoryCodeToIdMap(categories);

  const csvText = input.body.csv_text?.trim();
  if (!csvText) throw new Error("csv_text is required for bank/card CSV import.");

  const sourceType =
    input.body.source_type === "card_csv" ? "card_csv" : ("bank_csv" as const);

  const { data: importData, error: importErr } = await db
    .from("fi_expense_imports")
    .insert({
      tenant_id: tid,
      clinic_id: input.body.clinic_id ?? null,
      source_type: sourceType,
      status: "parsing",
      original_filename: input.body.original_filename?.trim() || null,
      created_by_fi_user_id: input.actorFiUserId ?? null,
      metadata: {},
    })
    .select("*")
    .single();
  if (importErr) throw new Error(importErr.message);
  const importRow = mapExpenseImportRow(importData as Record<string, unknown>);

  const parsed = parseExpenseBankCsv(csvText);
  if (!parsed.ok) {
    await db
      .from("fi_expense_imports")
      .update({
        status: "failed",
        error_summary: parsed.errors.join(" "),
        row_count: 0,
        metadata: { mappedColumns: parsed.mappedColumns, errors: parsed.errors },
      })
      .eq("tenant_id", tid)
      .eq("id", importRow.id);

    await writeAudit({
      tenantId: tid,
      action: "import_created",
      actorFiUserId: input.actorFiUserId,
      importId: importRow.id,
      next: { status: "failed", errors: parsed.errors },
      supabase: db,
    });

    return {
      importRow: {
        ...importRow,
        status: "failed",
        error_summary: parsed.errors.join(" "),
      },
      lineCount: 0,
      parseErrors: parsed.errors,
    };
  }

  const drafts = buildImportLineDraftsFromCsv(parsed.lines, codeMap);
  const lineInserts = drafts.map((d) => ({
    tenant_id: tid,
    import_id: importRow.id,
    line_index: d.line_index,
    status: d.status,
    transaction_date: d.transaction_date,
    description_raw: d.description_raw,
    amount_cents: d.amount_cents,
    currency: d.currency,
    external_ref: d.external_ref,
    merchant_hint: d.merchant_hint,
    vendor_name: d.vendor_name,
    suggested_category_id: d.suggested_category_id,
    category_id: d.suggested_category_id,
    parse_warnings: d.parse_warnings,
    metadata: d.metadata,
  }));

  if (lineInserts.length > 0) {
    const { error: lineErr } = await db.from("fi_expense_import_lines").insert(lineInserts);
    if (lineErr) {
      await db
        .from("fi_expense_imports")
        .update({ status: "failed", error_summary: lineErr.message })
        .eq("tenant_id", tid)
        .eq("id", importRow.id);
      throw new Error(lineErr.message);
    }
  }

  const { data: updatedImport, error: updErr } = await db
    .from("fi_expense_imports")
    .update({
      status: "ready_for_review",
      row_count: lineInserts.length,
      metadata: {
        mappedColumns: parsed.mappedColumns,
        headerRow: parsed.headerRow,
      },
    })
    .eq("tenant_id", tid)
    .eq("id", importRow.id)
    .select("*")
    .single();
  if (updErr) throw new Error(updErr.message);

  const finalImport = mapExpenseImportRow(updatedImport as Record<string, unknown>);

  await writeAudit({
    tenantId: tid,
    action: "import_parsed",
    actorFiUserId: input.actorFiUserId,
    importId: finalImport.id,
    next: { status: finalImport.status, row_count: finalImport.row_count },
    supabase: db,
  });

  return { importRow: finalImport, lineCount: lineInserts.length, parseErrors: [] };
}

export async function updateExpenseImportLine(input: {
  tenantId: string;
  lineId: string;
  patch: {
    status?: string;
    category_id?: string | null;
    vendor_name?: string | null;
    description_raw?: string | null;
    amount_cents?: number;
    transaction_date?: string | null;
    lead_id?: string | null;
    case_id?: string | null;
  };
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<void> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);

  const { data: existing, error: loadErr } = await db
    .from("fi_expense_import_lines")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", input.lineId.trim())
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!existing) throw new Error("Import line not found.");
  const prev = existing as Record<string, unknown>;
  if (String(prev.status) === "committed") {
    throw new Error("Committed lines cannot be edited.");
  }

  const update: Record<string, unknown> = {};
  if (input.patch.status != null) update.status = input.patch.status;
  if (input.patch.category_id !== undefined) update.category_id = input.patch.category_id;
  if (input.patch.vendor_name !== undefined) {
    update.vendor_name = input.patch.vendor_name?.trim() || null;
  }
  if (input.patch.description_raw !== undefined) {
    update.description_raw = input.patch.description_raw?.trim() || null;
  }
  if (input.patch.amount_cents != null) update.amount_cents = input.patch.amount_cents;
  if (input.patch.transaction_date !== undefined) {
    update.transaction_date = input.patch.transaction_date;
  }
  if (input.patch.lead_id !== undefined) update.lead_id = input.patch.lead_id;
  if (input.patch.case_id !== undefined) update.case_id = input.patch.case_id;

  const { error } = await db
    .from("fi_expense_import_lines")
    .update(update)
    .eq("tenant_id", tid)
    .eq("id", input.lineId.trim());
  if (error) throw new Error(error.message);

  await writeAudit({
    tenantId: tid,
    action: "import_line_updated",
    actorFiUserId: input.actorFiUserId,
    importId: String(prev.import_id),
    importLineId: input.lineId.trim(),
    previous: { status: prev.status },
    next: update,
    supabase: db,
  });
}

export async function commitExpenseImportLines(input: {
  tenantId: string;
  importId: string;
  lineIds?: string[] | null;
  commitAllAccepted?: boolean;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ committed: number; expenseIds: string[] }> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const importRow = await loadExpenseImportById(tid, input.importId, db);
  if (!importRow) throw new Error("Import not found.");
  if (importRow.status === "cancelled") throw new Error("Import is cancelled.");

  const lines = await loadExpenseImportLines(tid, importRow.id, db);
  const targetIds = new Set(
    resolveCommitStatuses(lines, {
      lineIds: input.lineIds,
      commitAllAccepted: input.commitAllAccepted === true,
    })
  );

  if (targetIds.size === 0) {
    throw new Error("No lines selected to commit.");
  }

  const expenseIds: string[] = [];
  let committed = 0;

  for (const line of lines) {
    if (!targetIds.has(line.id)) continue;
    const eligibility = assertImportLineCommitEligible({
      status: line.status,
      amount_cents: line.amount_cents,
      transaction_date: line.transaction_date,
    });
    if (!eligibility.ok) continue;

    const expenseInsert = {
      tenant_id: tid,
      clinic_id: line.clinic_id ?? importRow.clinic_id,
      status: "reviewed" as const,
      expense_date: line.transaction_date!,
      amount_cents: line.amount_cents,
      currency: line.currency || "AUD",
      vendor_name: line.vendor_name,
      description: line.description_raw,
      category_id: line.category_id ?? line.suggested_category_id,
      payment_method: importRow.source_type === "card_csv" ? "card" : "bank",
      source_import_line_id: line.id,
      lead_id: line.lead_id,
      case_id: line.case_id,
      patient_id: line.patient_id,
      created_by_fi_user_id: input.actorFiUserId ?? null,
      reviewed_by_fi_user_id: input.actorFiUserId ?? null,
      idempotency_key: `import-line:${line.id}`,
      metadata: { import_id: importRow.id, line_index: line.line_index },
    };

    const existingByKey = await db
      .from("fi_expenses")
      .select("*")
      .eq("tenant_id", tid)
      .eq("idempotency_key", expenseInsert.idempotency_key)
      .maybeSingle();
    if (existingByKey.error) throw new Error(existingByKey.error.message);

    if (existingByKey.data) {
      expenseIds.push(mapExpenseRow(existingByKey.data as Record<string, unknown>).id);
    } else {
      const { data: ins, error: insErr } = await db
        .from("fi_expenses")
        .insert(expenseInsert)
        .select("*")
        .single();
      if (insErr) throw new Error(insErr.message);
      expenseIds.push(mapExpenseRow(ins as Record<string, unknown>).id);
    }

    const { error: lineUpdErr } = await db
      .from("fi_expense_import_lines")
      .update({ status: "committed" })
      .eq("tenant_id", tid)
      .eq("id", line.id);
    if (lineUpdErr) throw new Error(lineUpdErr.message);
    committed += 1;
  }

  if (committed === 0) {
    throw new Error(
      "No eligible lines committed. Accept lines with a valid date and amount first."
    );
  }

  const remaining = await loadExpenseImportLines(tid, importRow.id, db);
  const allDone = remaining.every(
    (l) => l.status === "committed" || l.status === "rejected" || l.status === "duplicate"
  );
  if (allDone) {
    await db
      .from("fi_expense_imports")
      .update({ status: "committed" })
      .eq("tenant_id", tid)
      .eq("id", importRow.id);
  }

  await writeAudit({
    tenantId: tid,
    action: "import_committed",
    actorFiUserId: input.actorFiUserId,
    importId: importRow.id,
    next: { committed, expenseIds },
    supabase: db,
  });

  return { committed, expenseIds };
}
