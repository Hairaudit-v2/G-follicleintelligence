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

export type LeadFlowDrainTenantSummary = {
  tenant_id: string;
  processed: number;
  failed: number;
  retried: number;
  skipped: number;
};

export type LeadFlowDrainSummary = {
  success: boolean;
  processed: number;
  failed: number;
  retried: number;
  skipped: number;
  tenants: LeadFlowDrainTenantSummary[];
};

export type HubSpotLeadFlowDrainResult = LeadFlowDrainSummary & {
  mode: "single_tenant" | "all_tenants";
  tenant_id: string | null;
  batch_limit: number;
  reclaimed_stale_processing: number;
  tenants_touched: number;
  events: HubSpotExternalEventProcessResult[];
  health: LeadFlowQueueHealth;
};

function normalizeBatchLimit(limit?: number): number {
  return Math.min(Math.max(limit ?? LEADFLOW_HUBSPOT_DRAIN_DEFAULT_BATCH, 1), LEADFLOW_HUBSPOT_DRAIN_MAX_BATCH);
}

export function summarizeLeadFlowDrainResults(
  results: HubSpotExternalEventProcessResult[]
): LeadFlowDrainSummary {
  const tenantMap = new Map<string, LeadFlowDrainTenantSummary>();

  let processed = 0;
  let failed = 0;
  let retried = 0;
  let skipped = 0;

  for (const result of results) {
    let summary = tenantMap.get(result.tenantId);
    if (!summary) {
      summary = { tenant_id: result.tenantId, processed: 0, failed: 0, retried: 0, skipped: 0 };
      tenantMap.set(result.tenantId, summary);
    }

    switch (result.outcome) {
      case "processed":
        processed += 1;
        summary.processed += 1;
        break;
      case "failed":
        failed += 1;
        summary.failed += 1;
        break;
      case "retried":
        retried += 1;
        summary.retried += 1;
        break;
      case "skipped":
        skipped += 1;
        summary.skipped += 1;
        break;
    }
  }

  return {
    success: true,
    processed,
    failed,
    retried,
    skipped,
    tenants: [...tenantMap.values()].sort((a, b) => a.tenant_id.localeCompare(b.tenant_id)),
  };
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

  let events: HubSpotExternalEventProcessResult[] = [];
  let tenantsTouched = 0;
  let mode: HubSpotLeadFlowDrainResult["mode"] = "all_tenants";

  if (tenantId) {
    mode = "single_tenant";
    events = await processPendingHubSpotExternalEvents({
      tenantId,
      limit: batchLimit,
      supabase,
    });
    tenantsTouched = events.length > 0 ? 1 : 0;
  } else {
    const allTenants = await processAllTenantsPendingHubSpotExternalEvents({
      limit: batchLimit,
      supabase,
    });
    events = allTenants.results;
    tenantsTouched = allTenants.tenantsTouched;
  }

  const summary = summarizeLeadFlowDrainResults(events);
  const health = await loadLeadFlowQueueHealth({ tenantId: tenantId ?? undefined, supabase });

  return {
    ...summary,
    mode,
    tenant_id: tenantId,
    batch_limit: batchLimit,
    reclaimed_stale_processing: reclaimedStaleProcessing,
    tenants_touched: tenantsTouched,
    events,
    health,
  };
}
