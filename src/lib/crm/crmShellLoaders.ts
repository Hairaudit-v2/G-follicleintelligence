import "server-only";

/**
 * Server loaders for FI Admin CRM shell (Stage 2E). Each route must call
 * `assertCrmShellPageAccess(tenantId)` before invoking these functions.
 */

import {
  ensureDefaultPipelineStages,
  loadCrmActivityTimelineForLead,
  loadCrmLeadById,
  loadCrmLeadsShellPage,
  loadCrmMessagesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "./server";
import type {
  CrmShellClinicOption,
  CrmShellLeadListPage,
  CrmShellOrgOption,
  CrmShellUserPickerOption,
  FiCrmActivityEventRow,
  FiCrmLeadRow,
  FiCrmMessageRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
  FiCrmTaskRow,
} from "./types";
import { DEFAULT_CRM_PIPELINE_KEY } from "./types";
import { attachSearchPattern, parseCrmLeadListQuery, type ParsedCrmLeadListQuery } from "./crmLeadListQuery";
import { escapeIlikePattern } from "@/src/lib/fi/foundation/search";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type { CrmShellLeadListItem, CrmShellLeadListPage } from "./types";

export async function loadCrmShellPipelineStages(tenantId: string): Promise<FiCrmPipelineStageRow[]> {
  const scope = {
    tenantId,
    organisationId: null as string | null,
    clinicId: null as string | null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  };
  const { stages } = await ensureDefaultPipelineStages(scope);
  return stages;
}

export type CrmLeadShellBundle = {
  lead: FiCrmLeadRow | null;
  events: FiCrmActivityEventRow[];
  tasks: FiCrmTaskRow[];
  notes: FiCrmNoteRow[];
  messages: FiCrmMessageRow[];
};

export async function loadCrmShellLeadBundle(tenantId: string, leadId: string): Promise<CrmLeadShellBundle> {
  const lid = leadId.trim();
  const lead = await loadCrmLeadById(lid, tenantId);
  if (!lead) {
    return { lead: null, events: [], tasks: [], notes: [], messages: [] };
  }
  const [events, tasks, notes, messages] = await Promise.all([
    loadCrmActivityTimelineForLead(tenantId, lid, { limit: 80 }),
    loadCrmTasksForLead(tenantId, lid, { limit: 40 }),
    loadCrmNotesForLead(tenantId, lid, { limit: 40 }),
    loadCrmMessagesForLead(tenantId, lid, { limit: 40 }),
  ]);
  return { lead, events, tasks, notes, messages };
}

export type CrmShellLeadsIndexResult = CrmShellLeadListPage & {
  query: ParsedCrmLeadListQuery;
};

/**
 * Lead index for CRM shell home: lazy default pipeline seed + paginated list (Stage 2F).
 */
export async function loadCrmShellLeadsIndex(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<CrmShellLeadsIndexResult> {
  const tid = tenantId.trim();
  const base = parseCrmLeadListQuery(searchParams);
  const esc = base.searchRaw ? escapeIlikePattern(base.searchRaw) : null;
  const parsed = attachSearchPattern(base, esc);
  await ensureDefaultPipelineStages({
    tenantId: tid,
    organisationId: null,
    clinicId: null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  });
  const page = await loadCrmLeadsShellPage(tid, parsed);
  return { ...page, query: parsed };
}

export async function loadCrmShellUserPickerOptions(tenantId: string): Promise<CrmShellUserPickerOption[]> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .order("email", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as { id: string; email: string | null }[];
  return rows.map((r) => ({ id: String(r.id), email: r.email != null ? String(r.email) : null }));
}

export async function loadCrmShellScopePickerOptions(tenantId: string): Promise<{
  organisations: CrmShellOrgOption[];
  clinics: CrmShellClinicOption[];
}> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const [orgsRes, clinicsRes] = await Promise.all([
    supabase.from("fi_organisations").select("id, name").eq("tenant_id", tid).order("name", { ascending: true }),
    supabase
      .from("fi_clinics")
      .select("id, display_name, organisation_id")
      .eq("tenant_id", tid)
      .order("display_name", { ascending: true }),
  ]);
  if (orgsRes.error) throw new Error(orgsRes.error.message);
  if (clinicsRes.error) throw new Error(clinicsRes.error.message);
  const organisations = (orgsRes.data ?? []).map((o) => {
    const r = o as { id: string; name: string };
    return { id: String(r.id), name: String(r.name) };
  });
  const clinics = (clinicsRes.data ?? []).map((c) => {
    const r = c as { id: string; display_name: string; organisation_id: string | null };
    return {
      id: String(r.id),
      display_name: String(r.display_name),
      organisation_id: r.organisation_id != null ? String(r.organisation_id) : null,
    };
  });
  return { organisations, clinics };
}
