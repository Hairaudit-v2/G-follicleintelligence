import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { processExpenseDocumentOcr } from "@/src/lib/financialOs/expenses/expenseDocumentMutations.server";
import { mapExpenseDocumentRow } from "@/src/lib/financialOs/expenses/expenseOcrCore";

export type ExpenseOcrCronSummary = {
  ok: true;
  mode: "single_tenant" | "all_tenants";
  scanned: number;
  processed: number;
  succeeded: number;
  failed: number;
  durationMs: number;
  errors: string[];
};

/**
 * Process pending / processing expense document OCR jobs.
 * Service-role only; safe for cron.
 */
export async function runExpenseOcrCron(options?: {
  tenantId?: string | null;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<ExpenseOcrCronSummary> {
  const started = Date.now();
  const db = options?.supabase ?? supabaseAdmin();
  const limit = Math.min(Math.max(options?.limit ?? 10, 1), 50);
  const tenantFilter = options?.tenantId?.trim() || null;

  let q = db
    .from("fi_expense_documents")
    .select("id, tenant_id, ocr_status")
    .in("ocr_status", ["pending", "processing"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (tenantFilter) {
    q = q.eq("tenant_id", tenantFilter);
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((r) => mapExpenseDocumentRow(r as Record<string, unknown>));
  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const out = await processExpenseDocumentOcr({
        tenantId: row.tenant_id,
        documentId: row.id,
        applyToExpense: true,
        supabase: db,
      });
      processed += 1;
      if (out.document.ocr_status === "succeeded") succeeded += 1;
      else if (out.document.ocr_status === "failed") failed += 1;
    } catch (e) {
      processed += 1;
      failed += 1;
      errors.push(
        `${row.id}: ${e instanceof Error ? e.message : "unknown error"}`.slice(0, 200)
      );
    }
  }

  return {
    ok: true,
    mode: tenantFilter ? "single_tenant" : "all_tenants",
    scanned: rows.length,
    processed,
    succeeded,
    failed,
    durationMs: Date.now() - started,
    errors: errors.slice(0, 20),
  };
}
