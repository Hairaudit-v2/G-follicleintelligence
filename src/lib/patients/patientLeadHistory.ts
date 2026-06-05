import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { mapFiCrmLeadRow } from "@/src/lib/crm/leadRow";
import {
  mapPersonCrmActivityRows,
  type PatientPersonCrmActivityItem,
  type PatientPersonLeadHistoryItem,
} from "./patientLeadHistoryShared";

export type {
  PatientLeadHistoryTimelineRow,
  PatientPersonCrmActivityItem,
  PatientPersonLeadHistoryItem,
} from "./patientLeadHistoryShared";
export { buildPatientLeadHistoryTimeline, pickPrimaryLeadForPatient } from "./patientLeadHistoryShared";

export async function loadPatientPersonLeadHistory(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string,
  foundationPatientId: string
): Promise<PatientPersonLeadHistoryItem[]> {
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const leads = (data ?? []).map((r) => mapFiCrmLeadRow(r as Record<string, unknown>));
  const stageIds = Array.from(new Set(leads.map((l) => l.current_stage_id).filter(Boolean) as string[]));
  const ownerIds = Array.from(new Set(leads.map((l) => l.primary_owner_user_id).filter(Boolean) as string[]));

  const stageLabelById = new Map<string, string>();
  if (stageIds.length) {
    const { data: stages, error: se } = await supabase
      .from("fi_crm_pipeline_stages")
      .select("id, label")
      .eq("tenant_id", tenantId)
      .in("id", stageIds);
    if (se) throw new Error(se.message);
    for (const s of stages ?? []) {
      stageLabelById.set(String((s as { id: string }).id), String((s as { label: string }).label));
    }
  }

  const ownerLabelById = new Map<string, string>();
  if (ownerIds.length) {
    const { data: users, error: ue } = await supabase
      .from("fi_users")
      .select("id, email")
      .eq("tenant_id", tenantId)
      .in("id", ownerIds);
    if (ue) throw new Error(ue.message);
    for (const u of users ?? []) {
      const id = String((u as { id: string }).id);
      const em = (u as { email: string | null }).email;
      ownerLabelById.set(id, em?.trim() || id.slice(0, 8));
    }
  }

  return leads.map((lead) => ({
    lead,
    stageLabel: lead.current_stage_id ? stageLabelById.get(lead.current_stage_id) ?? null : null,
    ownerLabel: lead.primary_owner_user_id ? ownerLabelById.get(lead.primary_owner_user_id) ?? null : null,
    linkedToThisPatient: lead.patient_id?.trim() === foundationPatientId,
  }));
}

export async function loadPersonCrmActivityForLeads(
  supabase: SupabaseClient,
  tenantId: string,
  foundationPatientId: string,
  leadItems: PatientPersonLeadHistoryItem[],
  limit = 80
): Promise<PatientPersonCrmActivityItem[]> {
  const leadIds = leadItems.map((i) => i.lead.id);

  if (leadIds.length === 0) {
    const { data, error } = await supabase
      .from("fi_crm_activity_events")
      .select("id, occurred_at, activity_kind, title, lead_id")
      .eq("tenant_id", tenantId)
      .eq("patient_id", foundationPatientId)
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return mapPersonCrmActivityRows((data ?? []) as Record<string, unknown>[], leadItems).slice(0, limit);
  }

  const orParts = [`patient_id.eq.${foundationPatientId}`, `lead_id.in.(${leadIds.join(",")})`];
  const { data, error } = await supabase
    .from("fi_crm_activity_events")
    .select("id, occurred_at, activity_kind, title, lead_id")
    .eq("tenant_id", tenantId)
    .or(orParts.join(","))
    .order("occurred_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return mapPersonCrmActivityRows((data ?? []) as Record<string, unknown>[], leadItems).slice(0, limit);
}
