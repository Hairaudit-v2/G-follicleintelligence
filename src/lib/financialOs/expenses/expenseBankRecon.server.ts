import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { matchBankLinesToExpenses } from "@/src/lib/financialOs/expenses/expenseBankReconCore";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

export type BankReconMatchRow = {
  id: string;
  tenant_id: string;
  import_line_id: string;
  expense_id: string;
  status: "suggested" | "confirmed" | "rejected";
  confidence: number | null;
  match_reason: string | null;
};

/**
 * Run heuristics and upsert suggested matches for the period (does not confirm).
 */
export async function suggestBankReconMatches(input: {
  tenantId: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ suggested: number; period_start: string; period_end: string }> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const { data: lines, error: lineErr } = await db
    .from("fi_expense_import_lines")
    .select(
      "id, transaction_date, amount_cents, external_ref, description_raw, vendor_name, status"
    )
    .eq("tenant_id", tid)
    .gte("transaction_date", period_start)
    .lte("transaction_date", period_end)
    .limit(2000);
  if (lineErr) throw new Error(lineErr.message);

  const { data: expenses, error: expErr } = await db
    .from("fi_expenses")
    .select(
      "id, expense_date, amount_cents, vendor_name, description, status, source_import_line_id"
    )
    .eq("tenant_id", tid)
    .gte("expense_date", period_start)
    .lte("expense_date", period_end)
    .limit(2000);
  if (expErr) throw new Error(expErr.message);

  const recon = matchBankLinesToExpenses({
    lines: (lines ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        transaction_date: r.transaction_date != null ? String(r.transaction_date).slice(0, 10) : null,
        amount_cents: Number(r.amount_cents ?? 0),
        external_ref: r.external_ref != null ? String(r.external_ref) : null,
        description_raw: r.description_raw != null ? String(r.description_raw) : null,
        vendor_name: r.vendor_name != null ? String(r.vendor_name) : null,
        status: String(r.status ?? ""),
      };
    }),
    expenses: (expenses ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      return {
        id: String(r.id),
        expense_date: String(r.expense_date ?? "").slice(0, 10),
        amount_cents: Number(r.amount_cents ?? 0),
        vendor_name: r.vendor_name != null ? String(r.vendor_name) : null,
        description: r.description != null ? String(r.description) : null,
        status: String(r.status ?? ""),
        source_import_line_id:
          r.source_import_line_id != null ? String(r.source_import_line_id) : null,
      };
    }),
  });

  let suggested = 0;
  for (const m of recon.matches) {
    const { data: existing } = await db
      .from("fi_expense_bank_recon_matches")
      .select("id, status")
      .eq("tenant_id", tid)
      .eq("import_line_id", m.line_id)
      .in("status", ["suggested", "confirmed"])
      .maybeSingle();
    if (existing) continue;

    const { error } = await db.from("fi_expense_bank_recon_matches").insert({
      tenant_id: tid,
      import_line_id: m.line_id,
      expense_id: m.expense_id,
      status: "suggested",
      confidence: m.confidence,
      match_reason: m.reason,
      created_by_fi_user_id: input.actorFiUserId ?? null,
      metadata: {},
    });
    if (!error) suggested += 1;
  }

  return { suggested, period_start, period_end };
}

export async function loadBankReconMatches(
  tenantId: string,
  status?: "suggested" | "confirmed" | "rejected" | "all",
  supabase?: SupabaseClient
): Promise<BankReconMatchRow[]> {
  const tid = tenantId.trim();
  const db = client(supabase);
  let q = db
    .from("fi_expense_bank_recon_matches")
    .select("id, tenant_id, import_line_id, expense_id, status, confidence, match_reason")
    .eq("tenant_id", tid)
    .order("created_at", { ascending: false })
    .limit(200);
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return {
      id: String(r.id),
      tenant_id: String(r.tenant_id),
      import_line_id: String(r.import_line_id),
      expense_id: String(r.expense_id),
      status: String(r.status) as BankReconMatchRow["status"],
      confidence: r.confidence != null ? Number(r.confidence) : null,
      match_reason: r.match_reason != null ? String(r.match_reason) : null,
    };
  });
}

export async function confirmBankReconMatch(input: {
  tenantId: string;
  matchId: string;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<void> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const now = new Date().toISOString();

  const { data: match, error: loadErr } = await db
    .from("fi_expense_bank_recon_matches")
    .select("*")
    .eq("tenant_id", tid)
    .eq("id", input.matchId.trim())
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!match) throw new Error("Match not found.");
  const row = match as Record<string, unknown>;
  if (String(row.status) === "rejected") throw new Error("Cannot confirm a rejected match.");

  const { error } = await db
    .from("fi_expense_bank_recon_matches")
    .update({
      status: "confirmed",
      confirmed_by_fi_user_id: input.actorFiUserId ?? null,
      confirmed_at: now,
    })
    .eq("tenant_id", tid)
    .eq("id", input.matchId.trim());
  if (error) throw new Error(error.message);

  // Link expense → import line when confirmed.
  await db
    .from("fi_expenses")
    .update({ source_import_line_id: String(row.import_line_id) })
    .eq("tenant_id", tid)
    .eq("id", String(row.expense_id))
    .is("source_import_line_id", null);

  await db.from("fi_expense_audit_events").insert({
    tenant_id: tid,
    expense_id: String(row.expense_id),
    action: "bank_recon_confirmed",
    actor_fi_user_id: input.actorFiUserId ?? null,
    previous: { status: row.status },
    next: {
      match_id: input.matchId,
      import_line_id: row.import_line_id,
      status: "confirmed",
    },
  });
}

export async function bulkConfirmBankReconMatches(input: {
  tenantId: string;
  matchIds?: string[] | null;
  confirmAllSuggested?: boolean;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<{ confirmed: number }> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);

  let ids = (input.matchIds ?? []).map((id) => id.trim()).filter(Boolean);
  if (input.confirmAllSuggested) {
    const { data, error } = await db
      .from("fi_expense_bank_recon_matches")
      .select("id")
      .eq("tenant_id", tid)
      .eq("status", "suggested")
      .limit(500);
    if (error) throw new Error(error.message);
    ids = (data ?? []).map((r) => String((r as { id: string }).id));
  }

  let confirmed = 0;
  for (const id of ids) {
    try {
      await confirmBankReconMatch({
        tenantId: tid,
        matchId: id,
        actorFiUserId: input.actorFiUserId,
        supabase: db,
      });
      confirmed += 1;
    } catch {
      // skip invalid / already handled
    }
  }
  return { confirmed };
}

export async function rejectBankReconMatch(input: {
  tenantId: string;
  matchId: string;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<void> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const now = new Date().toISOString();

  const { data: match, error: loadErr } = await db
    .from("fi_expense_bank_recon_matches")
    .select("id, status, expense_id")
    .eq("tenant_id", tid)
    .eq("id", input.matchId.trim())
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);
  if (!match) throw new Error("Match not found.");
  if (String((match as { status: string }).status) === "confirmed") {
    throw new Error("Cannot reject a confirmed match.");
  }

  const { error } = await db
    .from("fi_expense_bank_recon_matches")
    .update({ status: "rejected", rejected_at: now })
    .eq("tenant_id", tid)
    .eq("id", input.matchId.trim());
  if (error) throw new Error(error.message);

  await db.from("fi_expense_audit_events").insert({
    tenant_id: tid,
    expense_id: String((match as { expense_id: string }).expense_id),
    action: "bank_recon_rejected",
    actor_fi_user_id: input.actorFiUserId ?? null,
    previous: {},
    next: { match_id: input.matchId, status: "rejected" },
  });
}
