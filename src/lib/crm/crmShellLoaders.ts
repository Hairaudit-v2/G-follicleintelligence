import "server-only";

/**
 * Server loaders for FI Admin CRM shell (Stage 2E). Each route must call
 * `assertCrmShellPageAccess(tenantId)` before invoking these functions.
 */

import { loadBookingsForLead } from "@/src/lib/bookings/server";
import {
  ensureDefaultPipelineStages,
  loadCrmActivityTimelineForLead,
  loadCrmLeadById,
  loadCrmLeadCommunicationsForLead,
  loadCrmLeadConversionState,
  loadCrmLeadNotesForLead,
  loadCrmLeadsShellPage,
  loadCrmMessagesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "./server";
import type { FiBookingRow } from "@/src/lib/bookings/types";
import type {
  CrmKanbanLeadCard,
  CrmLeadConversionState,
  CrmShellClinicOption,
  CrmShellLeadListPage,
  CrmShellOrgOption,
  CrmShellUserPickerOption,
  FiCrmActivityEventRow,
  FiCrmLeadCommunicationRow,
  FiCrmLeadNoteRow,
  FiCrmLeadRow,
  FiCrmMessageRow,
  FiCrmNoteRow,
  FiCrmPipelineStageRow,
  FiCrmTaskRow,
} from "./types";
import { DEFAULT_CRM_PIPELINE_KEY } from "./types";
import { attachSearchPattern, parseCrmLeadListQuery, type ParsedCrmLeadListQuery } from "./crmLeadListQuery";
import { enrichCrmKanbanCards } from "./crmKanbanExtras.server";
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
  leadNotes: FiCrmLeadNoteRow[];
  leadCommunications: FiCrmLeadCommunicationRow[];
  messages: FiCrmMessageRow[];
  conversionState: CrmLeadConversionState | null;
  leadBookings: FiBookingRow[];
};

export type CrmLeadShellDetailPageData = CrmLeadShellBundle & {
  owners: CrmShellUserPickerOption[];
  organisations: CrmShellOrgOption[];
  clinics: CrmShellClinicOption[];
};

export async function loadCrmShellLeadBundle(tenantId: string, leadId: string): Promise<CrmLeadShellBundle> {
  const lid = leadId.trim();
  const lead = await loadCrmLeadById(lid, tenantId);
  if (!lead) {
    return {
      lead: null,
      events: [],
      tasks: [],
      notes: [],
      leadNotes: [],
      leadCommunications: [],
      messages: [],
      conversionState: null,
      leadBookings: [],
    };
  }
  const [events, tasks, notes, leadNotes, leadCommunications, messages, conversionState, leadBookings] =
    await Promise.all([
      loadCrmActivityTimelineForLead(tenantId, lid, { limit: 80 }),
      loadCrmTasksForLead(tenantId, lid, { limit: 40 }),
      loadCrmNotesForLead(tenantId, lid, { limit: 40 }),
      loadCrmLeadNotesForLead(tenantId, lid, { limit: 80 }),
      loadCrmLeadCommunicationsForLead(tenantId, lid, { limit: 80 }),
      loadCrmMessagesForLead(tenantId, lid, { limit: 40 }),
      loadCrmLeadConversionState(tenantId, lid),
      loadBookingsForLead(tenantId, lid),
    ]);
  return { lead, events, tasks, notes, leadNotes, leadCommunications, messages, conversionState, leadBookings };
}

export type CrmShellLeadsIndexResult = CrmShellLeadListPage & {
  query: ParsedCrmLeadListQuery;
};

const CRM_BOARD_PAGE_SIZE = 100;
const CRM_BOARD_MAX_PAGES = 25;

export type CrmShellLeadsBoardIndexResult = {
  cards: CrmKanbanLeadCard[];
  total: number;
  truncated: boolean;
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

/**
 * Kanban: all matching leads (up to CRM_BOARD_PAGE_SIZE * CRM_BOARD_MAX_PAGES) with card enrichment.
 */
export async function loadCrmShellLeadsBoardIndex(
  tenantId: string,
  searchParams: Record<string, string | string[] | undefined>
): Promise<CrmShellLeadsBoardIndexResult> {
  const tid = tenantId.trim();
  const base = parseCrmLeadListQuery(searchParams);
  const esc = base.searchRaw ? escapeIlikePattern(base.searchRaw) : null;
  const parsedBase = attachSearchPattern(base, esc);
  await ensureDefaultPipelineStages({
    tenantId: tid,
    organisationId: null,
    clinicId: null,
    pipelineKey: DEFAULT_CRM_PIPELINE_KEY,
  });

  const collected: CrmShellLeadListPage["items"] = [];
  let total = 0;
  for (let pageNum = 1; pageNum <= CRM_BOARD_MAX_PAGES; pageNum++) {
    const parsed: ParsedCrmLeadListQuery = {
      ...parsedBase,
      page: pageNum,
      pageSize: CRM_BOARD_PAGE_SIZE,
    };
    const page = await loadCrmLeadsShellPage(tid, parsed);
    total = page.total;
    collected.push(...page.items);
    if (collected.length >= total || page.items.length < CRM_BOARD_PAGE_SIZE) break;
  }

  const truncated = collected.length < total;
  const cards = await enrichCrmKanbanCards(tid, collected);
  return { cards, total, truncated, query: parsedBase };
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

/** Lead detail page: bundle + owner/org/clinic pickers for the edit panel (Stage 2H). */
export async function loadCrmShellLeadDetailPageData(tenantId: string, leadId: string): Promise<CrmLeadShellDetailPageData> {
  const [bundle, owners, scope] = await Promise.all([
    loadCrmShellLeadBundle(tenantId, leadId),
    loadCrmShellUserPickerOptions(tenantId),
    loadCrmShellScopePickerOptions(tenantId),
  ]);
  return {
    ...bundle,
    owners,
    organisations: scope.organisations,
    clinics: scope.clinics,
  };
}
