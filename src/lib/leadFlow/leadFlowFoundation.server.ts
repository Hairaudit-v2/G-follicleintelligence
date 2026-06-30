import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  FiLeadActivityType,
  FiLeadExternalEventStatus,
} from "@/src/lib/leadFlow/leadFlowFoundationCore";
import type {
  FiExternalEventRow,
  FiLeadActivityRow,
  FiLeadRow,
} from "@/src/lib/leadFlow/leadFlowFoundationTypes";

export async function insertFiExternalEvent(input: {
  tenantId: string;
  provider: string;
  eventType: string;
  payloadJson: Record<string, unknown>;
  externalId?: string | null;
  providerEventId?: string | null;
  status?: FiLeadExternalEventStatus;
}): Promise<{ row: FiExternalEventRow | null; duplicate: boolean }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_external_events")
    .insert({
      tenant_id: input.tenantId.trim(),
      provider: input.provider.trim(),
      event_type: input.eventType.trim(),
      external_id: input.externalId?.trim() || null,
      provider_event_id: input.providerEventId?.trim() || null,
      payload_json: input.payloadJson,
      status: input.status ?? "pending",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" && input.providerEventId?.trim()) {
      const { data: existing, error: loadError } = await supabase
        .from("fi_external_events")
        .select("*")
        .eq("tenant_id", input.tenantId.trim())
        .eq("provider", input.provider.trim())
        .eq("provider_event_id", input.providerEventId.trim())
        .maybeSingle();
      if (loadError) {
        console.error("[insertFiExternalEvent]", loadError.message);
        return { row: null, duplicate: false };
      }
      return { row: (existing as FiExternalEventRow | null) ?? null, duplicate: true };
    }
    console.error("[insertFiExternalEvent]", error.message);
    return { row: null, duplicate: false };
  }
  return { row: (data as FiExternalEventRow | null) ?? null, duplicate: false };
}

export async function markFiExternalEventProcessed(input: {
  tenantId: string;
  eventId: string;
  status: Extract<FiLeadExternalEventStatus, "processed" | "failed" | "skipped">;
}): Promise<boolean> {
  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("fi_external_events")
    .update({
      status: input.status,
      processed_at: new Date().toISOString(),
    })
    .eq("tenant_id", input.tenantId.trim())
    .eq("id", input.eventId.trim());

  if (error) {
    console.error("[markFiExternalEventProcessed]", error.message);
    return false;
  }
  return true;
}

export async function insertFiLead(input: {
  tenantId: string;
  hubspotContactId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  leadSource?: string | null;
  procedureInterest?: string | null;
  country?: string | null;
  budgetRange?: string | null;
  currentStage?: string;
  leadScore?: number;
  conversionProbability?: number;
  assignedConsultant?: string | null;
}): Promise<FiLeadRow | null> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_leads")
    .insert({
      tenant_id: input.tenantId.trim(),
      hubspot_contact_id: input.hubspotContactId?.trim() || null,
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      lead_source: input.leadSource?.trim() || null,
      procedure_interest: input.procedureInterest?.trim() || null,
      country: input.country?.trim() || null,
      budget_range: input.budgetRange?.trim() || null,
      current_stage: input.currentStage?.trim() || "new",
      lead_score: input.leadScore ?? 0,
      conversion_probability: input.conversionProbability ?? 0,
      assigned_consultant: input.assignedConsultant?.trim() || null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[insertFiLead]", error.message);
    return null;
  }
  return (data as FiLeadRow | null) ?? null;
}

export async function appendFiLeadActivity(input: {
  leadId: string;
  activityType: FiLeadActivityType | string;
  metadata?: Record<string, unknown>;
  supabase?: SupabaseClient;
}): Promise<FiLeadActivityRow | null> {
  const supabase = input.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_lead_activity")
    .insert({
      lead_id: input.leadId.trim(),
      activity_type: input.activityType,
      metadata: input.metadata && typeof input.metadata === "object" ? input.metadata : {},
    })
    .select("*")
    .maybeSingle();

  if (error) {
    console.error("[appendFiLeadActivity]", error.message);
    return null;
  }
  return (data as FiLeadActivityRow | null) ?? null;
}
