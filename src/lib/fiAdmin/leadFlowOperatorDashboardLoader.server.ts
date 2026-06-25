import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import { loadLeadFlowQueueDiagnostics } from "@/src/lib/leadFlow/leadFlowQueueDiagnostics.server";
import { loadLeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";
import {
  formatLeadFlowOperatorName,
  labelLeadFlowOperatorActivityType,
  summarizeLeadFlowOperatorActivityMetadata,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCore";
import { composeLeadFlowOperatorDashboardPayload } from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCompose";
import type {
  LeadFlowOperatorActivityRow,
  LeadFlowOperatorDashboardPayload,
  LeadFlowOperatorHubSpotStatus,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardTypes";

export type { LeadFlowOperatorDashboardPayload } from "@/src/lib/fiAdmin/leadFlowOperatorDashboardTypes";

const LEAD_SELECT =
  "id, tenant_id, first_name, last_name, email, phone, lead_source, procedure_interest, current_stage, lead_score, priority_band, predicted_procedure, updated_at, created_at";

const RECENT_ACTIVITY_LIMIT = 20;

function mapLeadRow(row: Record<string, unknown>): FiLeadRow {
  return row as unknown as FiLeadRow;
}

async function loadTenantFiLeads(tenantId: string, supabase: SupabaseClient): Promise<FiLeadRow[]> {
  const { data, error } = await supabase
    .from("fi_leads")
    .select(LEAD_SELECT)
    .eq("tenant_id", tenantId.trim())
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapLeadRow(row as Record<string, unknown>));
}

async function loadHubSpotConnectionStatus(
  tenantId: string,
  supabase: SupabaseClient
): Promise<LeadFlowOperatorHubSpotStatus> {
  const { data, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, config, status")
    .eq("tenant_id", tenantId.trim())
    .eq("provider", "hubspot")
    .neq("status", "disabled")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[loadLeadFlowOperatorDashboard.hubspot]", error.message);
    return { connected: false, label: null };
  }

  if (!data) return { connected: false, label: null };

  const config = (data as { config?: Record<string, unknown> }).config;
  const label = typeof config?.label === "string" ? config.label : "HubSpot";
  return { connected: true, label };
}

type ActivityJoinRow = {
  id: string;
  activity_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  fi_leads: { first_name: string | null; last_name: string | null; tenant_id: string } | null;
};

async function loadRecentLeadFlowOperatorActivity(
  tenantId: string,
  supabase: SupabaseClient
): Promise<LeadFlowOperatorActivityRow[]> {
  const { data, error } = await supabase
    .from("fi_lead_activity")
    .select("id, activity_type, metadata, created_at, fi_leads!inner(first_name, last_name, tenant_id)")
    .eq("fi_leads.tenant_id", tenantId.trim())
    .order("created_at", { ascending: false })
    .limit(RECENT_ACTIVITY_LIMIT);

  if (error) {
    console.error("[loadLeadFlowOperatorDashboard.activity]", error.message);
    return [];
  }

  return (data ?? []).map((row) => {
    const typed = row as unknown as ActivityJoinRow;
    const lead = typed.fi_leads;
    const metadata = typed.metadata && typeof typed.metadata === "object" ? typed.metadata : {};
    return {
      id: String(typed.id),
      activityType: String(typed.activity_type),
      activityLabel: labelLeadFlowOperatorActivityType(String(typed.activity_type)),
      leadName: lead ? formatLeadFlowOperatorName(lead) : null,
      metadataSummary: summarizeLeadFlowOperatorActivityMetadata(String(typed.activity_type), metadata),
      createdAt: String(typed.created_at),
    };
  });
}

/**
 * LeadFlowOS Phase LF-4 — operator dashboard payload (read-only, tenant-scoped).
 */
export async function loadLeadFlowOperatorDashboardPayload(
  tenantId: string,
  opts?: { supabase?: SupabaseClient }
): Promise<LeadFlowOperatorDashboardPayload> {
  const tid = tenantId.trim();
  const supabase = opts?.supabase ?? supabaseAdmin();

  const [leads, queueHealth, diagnostics, hubspot, recentActivity] = await Promise.all([
    loadTenantFiLeads(tid, supabase),
    loadLeadFlowQueueHealth({ tenantId: tid, supabase }),
    loadLeadFlowQueueDiagnostics({ tenantId: tid, supabase }),
    loadHubSpotConnectionStatus(tid, supabase),
    loadRecentLeadFlowOperatorActivity(tid, supabase),
  ]);

  return composeLeadFlowOperatorDashboardPayload({
    tenantId: tid,
    leads,
    queueHealth,
    failedEvents: diagnostics.failed_events,
    hubspot,
    recentActivity,
  });
}
