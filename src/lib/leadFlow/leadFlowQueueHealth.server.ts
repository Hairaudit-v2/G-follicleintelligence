import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HUBSPOT_PROVIDER = "hubspot";

export type LeadFlowQueueHealthCounts = {
  pending: number;
  retrying: number;
  processing: number;
  processed: number;
  failed: number;
};

export type LeadFlowQueueHealth = {
  tenant_id: string | null;
  provider: typeof HUBSPOT_PROVIDER;
  counts: LeadFlowQueueHealthCounts;
  oldest_pending_at: string | null;
  newest_processed_at: string | null;
  failed_last_24h: number;
  processed_last_24h: number;
};

async function countEvents(
  supabase: SupabaseClient,
  filters: { tenantId?: string; status?: string; processedSince?: string }
): Promise<number> {
  let query = supabase
    .from("fi_external_events")
    .select("id", { count: "exact", head: true })
    .eq("provider", HUBSPOT_PROVIDER);

  if (filters.tenantId?.trim()) {
    query = query.eq("tenant_id", filters.tenantId.trim());
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.processedSince) {
    query = query.gte("processed_at", filters.processedSince);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[loadLeadFlowQueueHealth.countEvents]", error.message);
    return 0;
  }
  return count ?? 0;
}

/**
 * Operational queue health for HubSpot LeadFlow external events.
 * Service-role only; intended for cron drain responses and admin diagnostics helpers.
 */
export async function loadLeadFlowQueueHealth(opts?: {
  tenantId?: string;
  supabase?: SupabaseClient;
}): Promise<LeadFlowQueueHealth> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const tenantId = opts?.tenantId?.trim() || null;
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [pending, retrying, processing, processed, failed, failedLast24h, processedLast24h] =
    await Promise.all([
      countEvents(supabase, { tenantId: tenantId ?? undefined, status: "pending" }),
      countEvents(supabase, { tenantId: tenantId ?? undefined, status: "retrying" }),
      countEvents(supabase, { tenantId: tenantId ?? undefined, status: "processing" }),
      countEvents(supabase, { tenantId: tenantId ?? undefined, status: "processed" }),
      countEvents(supabase, { tenantId: tenantId ?? undefined, status: "failed" }),
      countEvents(supabase, {
        tenantId: tenantId ?? undefined,
        status: "failed",
        processedSince: since24h,
      }),
      countEvents(supabase, {
        tenantId: tenantId ?? undefined,
        status: "processed",
        processedSince: since24h,
      }),
    ]);

  let oldestPendingQuery = supabase
    .from("fi_external_events")
    .select("created_at")
    .eq("provider", HUBSPOT_PROVIDER)
    .in("status", ["pending", "retrying"])
    .order("created_at", { ascending: true })
    .limit(1);
  if (tenantId) oldestPendingQuery = oldestPendingQuery.eq("tenant_id", tenantId);

  let newestProcessedQuery = supabase
    .from("fi_external_events")
    .select("processed_at")
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "processed")
    .not("processed_at", "is", null)
    .order("processed_at", { ascending: false })
    .limit(1);
  if (tenantId) newestProcessedQuery = newestProcessedQuery.eq("tenant_id", tenantId);

  const [{ data: oldestPending }, { data: newestProcessed }] = await Promise.all([
    oldestPendingQuery.maybeSingle(),
    newestProcessedQuery.maybeSingle(),
  ]);

  return {
    tenant_id: tenantId,
    provider: HUBSPOT_PROVIDER,
    counts: { pending, retrying, processing, processed, failed },
    oldest_pending_at: (oldestPending as { created_at?: string } | null)?.created_at ?? null,
    newest_processed_at:
      (newestProcessed as { processed_at?: string } | null)?.processed_at ?? null,
    failed_last_24h: failedLast24h,
    processed_last_24h: processedLast24h,
  };
}
