import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { buildExpensePeriodExports } from "@/src/lib/financialOs/expenses/expenseStage6.server";
import { normalizeExpensePeriod } from "@/src/lib/financialOs/expenses/expensePeriodCore";

function client(c?: SupabaseClient): SupabaseClient {
  return c ?? supabaseAdmin();
}

export type AccountingPushResult = {
  provider: "quickbooks" | "xero";
  mode: "dry_run" | "live";
  status: "completed" | "failed" | "partial";
  attempted: number;
  success: number;
  failed: number;
  message: string;
  run_id: string | null;
  external_ids: Array<{ expense_id: string; external_id: string }>;
};

/**
 * Stage 8: attempt accounting push.
 * Live mode only when FI_ACCOUNTING_LIVE_PUSH=1 and connector credentials exist.
 * QuickBooks: POST Purchase (AccountBasedExpenseLineDetail) to QBO API when token present.
 * Xero: live transport records dry_run-style completion with CSV note (API not wired).
 */
export async function runAccountingExpensePush(input: {
  tenantId: string;
  provider: "quickbooks" | "xero";
  periodStart?: string | null;
  periodEnd?: string | null;
  forceLive?: boolean;
  actorFiUserId?: string | null;
  supabase?: SupabaseClient;
}): Promise<AccountingPushResult> {
  const tid = input.tenantId.trim();
  const db = client(input.supabase);
  const { period_start, period_end } = normalizeExpensePeriod({
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
  });

  const liveEnabled =
    input.forceLive === true || process.env.FI_ACCOUNTING_LIVE_PUSH?.trim() === "1";

  const { data: integrations } = await db
    .from("fi_tenant_external_integrations")
    .select("id, provider, status, config")
    .eq("tenant_id", tid)
    .eq("provider", input.provider)
    .in("status", ["configured", "active"])
    .limit(1);
  const integration = (integrations ?? [])[0] as
    | { id: string; config: Record<string, unknown> }
    | undefined;

  const full = await buildExpensePeriodExports(tid, {
    periodStart: period_start,
    periodEnd: period_end,
    supabase: db,
  });
  const drafts = full.quickbooks_drafts;

  if (!integration) {
    const run = await insertPushRun(db, {
      tenantId: tid,
      provider: input.provider,
      mode: "dry_run",
      status: "failed",
      period_start,
      period_end,
      attempted: drafts.length,
      success: 0,
      failure: drafts.length,
      detail: { reason: "connector_not_configured" },
      actorFiUserId: input.actorFiUserId,
    });
    return {
      provider: input.provider,
      mode: "dry_run",
      status: "failed",
      attempted: drafts.length,
      success: 0,
      failed: drafts.length,
      message: `${input.provider} connector not configured.`,
      run_id: run,
      external_ids: [],
    };
  }

  if (!liveEnabled) {
    const run = await insertPushRun(db, {
      tenantId: tid,
      provider: input.provider,
      mode: "dry_run",
      status: "completed",
      period_start,
      period_end,
      attempted: drafts.length,
      success: 0,
      failure: 0,
      detail: {
        reason: "live_push_disabled",
        sample: drafts.slice(0, 3).map((d) => d.fi_expense_id),
      },
      actorFiUserId: input.actorFiUserId,
    });
    return {
      provider: input.provider,
      mode: "dry_run",
      status: "completed",
      attempted: drafts.length,
      success: 0,
      failed: 0,
      message: `Dry-run only. Enable FI_ACCOUNTING_LIVE_PUSH=1 to attempt live ${input.provider} API.`,
      run_id: run,
      external_ids: [],
    };
  }

  if (input.provider === "xero") {
    const run = await insertPushRun(db, {
      tenantId: tid,
      provider: "xero",
      mode: "live",
      status: "partial",
      period_start,
      period_end,
      attempted: drafts.length,
      success: 0,
      failure: drafts.length,
      detail: {
        reason: "xero_live_http_not_wired",
        note: "Use Xero CSV export; live OAuth bank-transaction POST pending.",
      },
      actorFiUserId: input.actorFiUserId,
    });
    return {
      provider: "xero",
      mode: "live",
      status: "partial",
      attempted: drafts.length,
      success: 0,
      failed: drafts.length,
      message: "Xero live push not wired — use Xero CSV export.",
      run_id: run,
      external_ids: [],
    };
  }

  // QuickBooks live push
  const config = integration.config ?? {};
  const realmId = String(config.realm_id ?? config.realmId ?? "").trim();
  const envName = String(config.environment ?? "production").toLowerCase();
  const base =
    envName === "sandbox"
      ? "https://sandbox-quickbooks.api.intuit.com"
      : "https://quickbooks.api.intuit.com";

  const { data: creds } = await db
    .from("fi_external_connector_credentials")
    .select("ciphertext, credential_kind, metadata")
    .eq("integration_id", integration.id)
    .limit(5);

  // Credentials are encrypted at rest; without decrypt helper we accept env override for live token.
  const token =
    process.env.FI_QUICKBOOKS_ACCESS_TOKEN?.trim() ||
    (typeof config.api_key === "string" ? config.api_key.trim() : "");

  if (!realmId || !token) {
    const run = await insertPushRun(db, {
      tenantId: tid,
      provider: "quickbooks",
      mode: "live",
      status: "failed",
      period_start,
      period_end,
      attempted: drafts.length,
      success: 0,
      failure: drafts.length,
      detail: {
        reason: "missing_realm_or_token",
        has_realm: Boolean(realmId),
        has_token: Boolean(token),
        credential_rows: (creds ?? []).length,
      },
      actorFiUserId: input.actorFiUserId,
    });
    return {
      provider: "quickbooks",
      mode: "live",
      status: "failed",
      attempted: drafts.length,
      success: 0,
      failed: drafts.length,
      message:
        "QuickBooks live push requires realm_id on connector config and FI_QUICKBOOKS_ACCESS_TOKEN (or config api_key).",
      run_id: run,
      external_ids: [],
    };
  }

  let success = 0;
  let failed = 0;
  const external_ids: Array<{ expense_id: string; external_id: string }> = [];
  const errors: string[] = [];

  for (const draft of drafts) {
    try {
      const body = {
        PaymentType: "Cash",
        AccountRef: { name: "Cash and cash equivalents" },
        EntityRef: draft.EntityRef,
        TxnDate: draft.TxnDate,
        PrivateNote: draft.PrivateNote,
        Line: draft.Line,
        CurrencyRef: draft.CurrencyRef,
      };
      const res = await fetch(
        `${base}/v3/company/${encodeURIComponent(realmId)}/purchase?minorversion=65`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        failed += 1;
        const t = await res.text().catch(() => "");
        errors.push(`${draft.fi_expense_id}: HTTP ${res.status} ${t.slice(0, 120)}`);
        continue;
      }
      const json = (await res.json()) as { Purchase?: { Id?: string } };
      const extId = json.Purchase?.Id?.trim();
      if (extId) {
        success += 1;
        external_ids.push({ expense_id: draft.fi_expense_id, external_id: extId });
        const now = new Date().toISOString();
        await db
          .from("fi_expenses")
          .update({
            external_quickbooks_id: extId,
            last_accounting_export_at: now,
            last_accounting_export_provider: "quickbooks",
          })
          .eq("tenant_id", tid)
          .eq("id", draft.fi_expense_id);
      } else {
        failed += 1;
        errors.push(`${draft.fi_expense_id}: missing Purchase.Id`);
      }
    } catch (e) {
      failed += 1;
      errors.push(
        `${draft.fi_expense_id}: ${e instanceof Error ? e.message : "push failed"}`
      );
    }
  }

  const status =
    failed === 0 ? "completed" : success === 0 ? "failed" : ("partial" as const);
  const run = await insertPushRun(db, {
    tenantId: tid,
    provider: "quickbooks",
    mode: "live",
    status,
    period_start,
    period_end,
    attempted: drafts.length,
    success,
    failure: failed,
    detail: { errors: errors.slice(0, 20), external_ids },
    actorFiUserId: input.actorFiUserId,
  });

  return {
    provider: "quickbooks",
    mode: "live",
    status,
    attempted: drafts.length,
    success,
    failed,
    message: `QuickBooks live push: ${success} ok, ${failed} failed of ${drafts.length}.`,
    run_id: run,
    external_ids,
  };
}

async function insertPushRun(
  db: SupabaseClient,
  input: {
    tenantId: string;
    provider: string;
    mode: string;
    status: string;
    period_start: string;
    period_end: string;
    attempted: number;
    success: number;
    failure: number;
    detail: Record<string, unknown>;
    actorFiUserId?: string | null;
  }
): Promise<string | null> {
  const { data, error } = await db
    .from("fi_expense_accounting_push_runs")
    .insert({
      tenant_id: input.tenantId,
      provider: input.provider,
      mode: input.mode,
      status: input.status,
      period_start: input.period_start,
      period_end: input.period_end,
      attempted_count: input.attempted,
      success_count: input.success,
      failure_count: input.failure,
      detail: input.detail,
      created_by_fi_user_id: input.actorFiUserId ?? null,
    })
    .select("id")
    .single();
  if (error) return null;
  return String((data as { id: string }).id);
}
