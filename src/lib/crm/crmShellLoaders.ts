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
  loadCrmLeadStageHistory,
  loadCrmLeadsShellPage,
  loadCrmMessagesForLead,
  loadCrmNotesForLead,
  loadCrmTasksForLead,
} from "./server";
import { loadReminderJobsForLead } from "@/src/lib/reminders/reminderJobs.server";
import { loadPatientClinicalDetails, type PatientClinicalDetailsRow } from "@/src/lib/patients/clinicalDetailsServer";
import { formatClinicalScalesSummary } from "@/src/lib/patients/hairLossScales";
import { loadPatientImagesProfileBundle } from "@/src/lib/patientImages/patientImagesServer";
import type { PatientImagesProfileBundle } from "@/src/lib/patientImages/patientImageTypes";
import type { FiReminderJobWithTemplate } from "@/src/lib/reminders/reminderTypes";
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
  FiCrmLeadStageHistoryRow,
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

export type CrmLeadShellSlideOverPayload = {
  detail: CrmLeadShellDetailPageData;
  stages: FiCrmPipelineStageRow[];
  stageHistory: FiCrmLeadStageHistoryRow[];
  reminderJobs: FiReminderJobWithTemplate[];
  clinicalScalesSummary: string | null;
};

export type CrmShellRelatedLeadItem = {
  id: string;
  summary: string | null;
  status: string;
  current_stage_id: string | null;
  stage_label: string | null;
  updated_at: string;
};

/** Other leads for the same person (excludes `excludeLeadId`). For detail-page peek strip. */
export async function loadCrmShellRelatedLeads(
  tenantId: string,
  personId: string,
  excludeLeadId: string,
  stages: FiCrmPipelineStageRow[],
  limit = 12
): Promise<CrmShellRelatedLeadItem[]> {
  const tid = tenantId.trim();
  const pid = personId.trim();
  const exclude = excludeLeadId.trim();
  if (!tid || !pid || !exclude) return [];

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, summary, status, current_stage_id, updated_at")
    .eq("tenant_id", tid)
    .eq("person_id", pid)
    .neq("id", exclude)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const stageById = new Map(stages.map((s) => [s.id, s.label]));
  return (data ?? []).map((row) => {
    const r = row as {
      id: string;
      summary: string | null;
      status: string;
      current_stage_id: string | null;
      updated_at: string;
    };
    const stageId = r.current_stage_id != null ? String(r.current_stage_id) : null;
    return {
      id: String(r.id),
      summary: r.summary != null ? String(r.summary) : null,
      status: String(r.status),
      current_stage_id: stageId,
      stage_label: stageId ? (stageById.get(stageId) ?? null) : null,
      updated_at: String(r.updated_at),
    };
  });
}

async function loadClinicalScalesSummaryForPatient(tenantId: string, patientId: string): Promise<string | null> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data, error } = await supabase
    .from("fi_patient_clinical_details")
    .select("norwood_scale, ludwig_scale, hairline_pattern, primary_concern, primary_hair_concern")
    .eq("tenant_id", tid)
    .eq("patient_id", pid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const r = data as Record<string, unknown>;
  const primaryConcern = r.primary_concern != null ? String(r.primary_concern) : null;
  const primaryHair = r.primary_hair_concern != null ? String(r.primary_hair_concern) : null;
  return formatClinicalScalesSummary({
    norwood_scale: r.norwood_scale != null ? String(r.norwood_scale) : null,
    ludwig_scale: r.ludwig_scale != null ? String(r.ludwig_scale) : null,
    hairline_pattern: r.hairline_pattern != null ? String(r.hairline_pattern) : null,
    primary_concern: primaryConcern ?? primaryHair,
  });
}

/**
 * CRM lead slide-over: detail bundle + pipeline + stage history + reminder jobs + clinical summary (when patient linked).
 * Call only after {@link assertCrmShellPageAccess} or equivalent gate.
 */
export async function loadCrmShellLeadSlideOverPayload(
  tenantId: string,
  leadId: string
): Promise<CrmLeadShellSlideOverPayload | null> {
  const detail = await loadCrmShellLeadDetailPageData(tenantId, leadId);
  if (!detail.lead) return null;
  const pid = detail.lead.patient_id?.trim() || null;
  const [stages, stageHistory, reminderJobs, clinicalScalesSummary] = await Promise.all([
    loadCrmShellPipelineStages(tenantId),
    loadCrmLeadStageHistory(tenantId, leadId),
    loadReminderJobsForLead(tenantId, leadId),
    pid ? loadClinicalScalesSummaryForPatient(tenantId, pid) : Promise.resolve(null),
  ]);
  return { detail, stages, stageHistory, reminderJobs, clinicalScalesSummary };
}

export type CrmLeadShellDetailPagePayload = CrmLeadShellSlideOverPayload & {
  relatedLeads: CrmShellRelatedLeadItem[];
  clinicalDetails: PatientClinicalDetailsRow | null;
  patientImages: PatientImagesProfileBundle | null;
};

/** Full lead detail page: slide-over bundle + related leads + patient clinical + image gallery. */
export async function loadCrmShellLeadDetailPagePayload(
  tenantId: string,
  leadId: string
): Promise<CrmLeadShellDetailPagePayload | null> {
  const base = await loadCrmShellLeadSlideOverPayload(tenantId, leadId);
  if (!base?.detail.lead) return null;
  const lead = base.detail.lead;
  const pid = lead.patient_id?.trim() || null;
  const [relatedLeads, clinicalDetails, patientImages] = await Promise.all([
    loadCrmShellRelatedLeads(tenantId, lead.person_id, lead.id, base.stages),
    pid ? loadPatientClinicalDetails(tenantId, pid) : Promise.resolve(null),
    pid ? loadPatientImagesProfileBundle(tenantId, pid) : Promise.resolve(null),
  ]);
  return { ...base, relatedLeads, clinicalDetails, patientImages };
}
