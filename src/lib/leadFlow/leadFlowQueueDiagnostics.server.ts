import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

const HUBSPOT_PROVIDER = "hubspot";
const FAILED_EVENTS_LIMIT = 25;

export type LeadFlowQueueDiagnosticEvent = {
  id: string;
  provider: string;
  event_type: string;
  external_id: string | null;
  provider_event_id: string | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
  last_retry_at: string | null;
};

export type LeadFlowQueueDiagnostics = {
  tenant_id: string | null;
  failed_events: LeadFlowQueueDiagnosticEvent[];
};

/**
 * Backend-only diagnostics for recent failed HubSpot LeadFlow events.
 */
export async function loadLeadFlowQueueDiagnostics(opts?: {
  tenantId?: string;
  supabase?: SupabaseClient;
}): Promise<LeadFlowQueueDiagnostics> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const tenantId = opts?.tenantId?.trim() || null;

  let query = supabase
    .from("fi_external_events")
    .select(
      "id, provider, event_type, external_id, provider_event_id, error_message, retry_count, created_at, last_retry_at"
    )
    .eq("provider", HUBSPOT_PROVIDER)
    .eq("status", "failed")
    .order("last_retry_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(FAILED_EVENTS_LIMIT);

  if (tenantId) {
    query = query.eq("tenant_id", tenantId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[loadLeadFlowQueueDiagnostics]", error.message);
    return { tenant_id: tenantId, failed_events: [] };
  }

  const failed_events = (data ?? []).map((row) => ({
    id: String((row as { id: string }).id),
    provider: String((row as { provider: string }).provider),
    event_type: String((row as { event_type: string }).event_type),
    external_id: ((row as { external_id?: string | null }).external_id ?? null) as string | null,
    provider_event_id: ((row as { provider_event_id?: string | null }).provider_event_id ?? null) as
      | string
      | null,
    error_message: ((row as { error_message?: string | null }).error_message ?? null) as string | null,
    retry_count: Number((row as { retry_count?: number }).retry_count ?? 0),
    created_at: String((row as { created_at: string }).created_at),
    last_retry_at: ((row as { last_retry_at?: string | null }).last_retry_at ?? null) as string | null,
  }));

  return { tenant_id: tenantId, failed_events };
}
