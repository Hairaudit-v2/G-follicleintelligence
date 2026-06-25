import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  processAllTenantsPendingHubSpotExternalEvents,
  processPendingHubSpotExternalEvents,
  reclaimStaleProcessingHubSpotExternalEvents,
  type HubSpotExternalEventProcessResult,
} from "@/src/lib/leadFlow/hubspotLeadFlowProcessor.server";
import {
  loadLeadFlowQueueHealth,
  type LeadFlowQueueHealth,
} from "@/src/lib/leadFlow/leadFlowQueueHealth.server";

export const LEADFLOW_HUBSPOT_DRAIN_DEFAULT_BATCH = 50;
export const LEADFLOW_HUBSPOT_DRAIN_MAX_BATCH = 100;

export type HubSpotLeadFlowDrainResult = {
  mode: "single_tenant" | "all_tenants";
  tenantId: string | null;
  batchLimit: number;
  reclaimedStaleProcessing: number;
  tenantsTouched: number;
  processed: HubSpotExternalEventProcessResult[];
  health: LeadFlowQueueHealth;
};

function normalizeBatchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? LEADFLOW_HUBSPOT_DRAIN_DEFAULT_BATCH, 1), LEADFLOW_HUBSPOT_DRAIN_MAX_BATCH);
}

/**
 * Drain pending HubSpot LeadFlow events into fi_leads with operational guardrails.
 * When tenantId is omitted, processes tenant-safe batches across all tenants with pending work.
 */
export async function drainHubSpotLeadFlowQueue(opts?: {
  tenantId?: string;
  limit?: number;
  supabase?: SupabaseClient;
}): Promise<HubSpotLeadFlowDrainResult> {
  const supabase = opts?.supabase ?? supabaseAdmin();
  const batchLimit = normalizeBatchLimit(opts?.limit);
  const tenantId = opts?.tenantId?.trim() || null;

  const reclaimedStaleProcessing = await reclaimStaleProcessingHubSpotExternalEvents({
    tenantId: tenantId ?? undefined,
    supabase,
  });

  if (tenantId) {
    const processed = await processPendingHubSpotExternalEvents({
      tenantId,
      limit: batchLimit,
      supabase,
    });
    const health = await loadLeadFlowQueueHealth({ tenantId, supabase });
    return {
      mode: "single_tenant",
      tenantId,
      batchLimit,
      reclaimedStaleProcessing,
      tenantsTouched: 1,
      processed,
      health,
    };
  }

  const allTenants = await processAllTenantsPendingHubSpotExternalEvents({
    limit: batchLimit,
    supabase,
  });

  const health = await loadLeadFlowQueueHealth({ supabase });

  return {
    mode: "all_tenants",
    tenantId: null,
    batchLimit,
    reclaimedStaleProcessing,
    tenantsTouched: allTenants.tenantsTouched,
    processed: allTenants.results,
    health,
  };
}
