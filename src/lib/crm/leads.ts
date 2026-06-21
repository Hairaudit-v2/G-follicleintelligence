import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ResolvePersonInput } from "@/src/lib/fi/foundation/types";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { appendCrmActivityEvent } from "./activity";
import { appendCrmLeadStageHistory } from "./stageHistory";
import { ensureDefaultPipelineStages, getEntryPipelineStage } from "./pipeline";
import { syncLeadCreatedReminderJobs } from "@/src/lib/reminders/reminderEnqueue.server";
import { publishLeadFlowEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import type { CrmPipelineScope, FiCrmLeadRow } from "./types";
import { CRM_DEFAULT_PERSON_SOURCE_SYSTEM } from "./types";
import { organisationBelongsToTenant, clinicBelongsToTenant } from "@/src/lib/fi/foundation/tenantSettings";
import {
  leadSourceDuplicateErrorMessage,
  leadSourceInsertRaceErrorMessage,
  normaliseOptionalLeadSource,
} from "./leadSourceMappingPolicy";
import { normaliseOrgClinicScope } from "./scope";
import { mapFiCrmLeadRow } from "./leadRow";

async function assertPersonInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_persons")
    .select("id")
    .eq("id", personId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("person_id does not exist or is not in this tenant.");
}

export type CreateCrmLeadShared = {
  tenantId: string;
  organisationId?: string | null;
  clinicId?: string | null;
  patientId?: string | null;
  caseId?: string | null;
  primaryOwnerUserId?: string | null;
  status?: string;
  priority?: string | null;
  /** Required for staff-created leads (non-empty after trim). */
  summary: string;
  metadata?: Record<string, unknown> | null;
  pipelineKey?: string;
  /** When both set (after trim), inserted into `fi_crm_lead_source_ids` after the lead row. */
  sourceSystem?: string | null;
  sourceLeadId?: string | null;
};

export type CreateCrmLeadWithResolvedPersonParams = CreateCrmLeadShared & {
  /** When set, must already belong to `tenantId` — no lead is created without this check. */
  personId: string;
};

export type CreateCrmLeadWithPersonResolutionParams = CreateCrmLeadShared & {
  /** Passed to `resolveOrCreatePerson` (`tenant_id` and default `source_system` applied by the CRM layer). */
  person: Omit<ResolvePersonInput, "tenant_id" | "source_system"> & { source_system?: string | null };
};

/**
 * Creates a CRM lead. Always ensures `fi_persons` exists first: either verifies `personId`
 * belongs to the tenant or runs `resolveOrCreatePerson` before inserting `fi_crm_leads`.
 */
export async function createCrmLeadWithPerson(
  params: CreateCrmLeadWithResolvedPersonParams | CreateCrmLeadWithPersonResolutionParams,
  client?: SupabaseClient
): Promise<FiCrmLeadRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = params.tenantId.trim();
  const { organisationId, clinicId } = normaliseOrgClinicScope({
    organisationId: params.organisationId,
    clinicId: params.clinicId,
  });

  if (organisationId) {
    const ok = await organisationBelongsToTenant(tenantId, organisationId, supabase);
    if (!ok) throw new Error("Organisation not found for this tenant.");
  }
  if (clinicId) {
    const ok = await clinicBelongsToTenant(tenantId, clinicId, supabase);
    if (!ok) throw new Error("Clinic not found for this tenant.");
    if (organisationId) {
      const { data: clinicRow, error: cErr } = await supabase
        .from("fi_clinics")
        .select("organisation_id")
        .eq("tenant_id", tenantId)
        .eq("id", clinicId)
        .maybeSingle();
      if (cErr) throw new Error(cErr.message);
      const cOrg = (clinicRow as { organisation_id: string | null } | null)?.organisation_id ?? null;
      if (cOrg && cOrg !== organisationId) {
        throw new Error("Selected clinic does not belong to the selected organisation.");
      }
    }
  }

  const leadSource = normaliseOptionalLeadSource(params.sourceSystem, params.sourceLeadId);
  if (leadSource) {
    const { data: existingMap, error: mapLookupErr } = await supabase
      .from("fi_crm_lead_source_ids")
      .select("lead_id")
      .eq("tenant_id", tenantId)
      .eq("source_system", leadSource.source_system)
      .eq("source_lead_id", leadSource.source_lead_id)
      .maybeSingle();
    if (mapLookupErr) throw new Error(mapLookupErr.message);
    const existingLeadId = (existingMap as { lead_id: string } | null)?.lead_id;
    if (existingLeadId) {
      throw new Error(leadSourceDuplicateErrorMessage(leadSource, existingLeadId));
    }
  }

  const scope: CrmPipelineScope = {
    tenantId,
    organisationId,
    clinicId,
    pipelineKey: params.pipelineKey,
  };

  await ensureDefaultPipelineStages(scope, supabase);
  const entry = await getEntryPipelineStage(scope, supabase);
  if (!entry) throw new Error("CRM pipeline has no entry stage; cannot create lead.");

  let personId: string;
  if ("personId" in params && params.personId) {
    personId = params.personId.trim();
    await assertPersonInTenant(supabase, tenantId, personId);
  } else if ("person" in params && params.person) {
    const resolution: ResolvePersonInput = {
      ...params.person,
      tenant_id: tenantId,
      source_system: params.person.source_system?.trim() || CRM_DEFAULT_PERSON_SOURCE_SYSTEM,
    };
    const { person } = await resolveOrCreatePerson(resolution, supabase);
    personId = person.id;
  } else {
    throw new Error("createCrmLeadWithPerson requires personId or person resolution input.");
  }

  const metadata =
    params.metadata && typeof params.metadata === "object" && !Array.isArray(params.metadata)
      ? params.metadata
      : {};

  const summaryTrimmed = params.summary.trim();
  if (!summaryTrimmed) throw new Error("Lead summary is required.");

  const { data: inserted, error: leadErr } = await supabase
    .from("fi_crm_leads")
    .insert({
      tenant_id: tenantId,
      organisation_id: organisationId,
      clinic_id: clinicId,
      person_id: personId,
      patient_id: params.patientId?.trim() || null,
      case_id: params.caseId?.trim() || null,
      current_stage_id: entry.id,
      primary_owner_user_id: params.primaryOwnerUserId?.trim() || null,
      status: (params.status ?? "open").trim() || "open",
      priority: params.priority?.trim() || null,
      summary: summaryTrimmed,
      metadata,
    })
    .select("*")
    .single();

  if (leadErr) throw new Error(leadErr.message);
  const lead = mapFiCrmLeadRow(inserted as Record<string, unknown>);

  if (leadSource) {
    const { error: srcErr } = await supabase.from("fi_crm_lead_source_ids").insert({
      tenant_id: tenantId,
      lead_id: lead.id,
      source_system: leadSource.source_system,
      source_lead_id: leadSource.source_lead_id,
    });
    if (srcErr?.code === "23505") {
      await supabase.from("fi_crm_leads").delete().eq("id", lead.id).eq("tenant_id", tenantId);
      throw new Error(leadSourceInsertRaceErrorMessage(leadSource));
    }
    if (srcErr) {
      await supabase.from("fi_crm_leads").delete().eq("id", lead.id).eq("tenant_id", tenantId);
      throw new Error(srcErr.message);
    }
  }

  await appendCrmLeadStageHistory(
    {
      tenantId,
      leadId: lead.id,
      fromStageId: null,
      toStageId: entry.id,
      changedBy: params.primaryOwnerUserId?.trim() || null,
      source: "system",
      reason: "lead.created",
      metadata: { event: "initial_stage" },
    },
    supabase
  );

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId: lead.id,
      activityKind: "lead.created",
      title: "Lead created",
      detail: {
        person_id: personId,
        current_stage_id: entry.id,
        organisation_id: organisationId,
        clinic_id: clinicId,
        ...(leadSource
          ? { source_system: leadSource.source_system, source_lead_id: leadSource.source_lead_id }
          : {}),
      },
      patientId: lead.patient_id,
      caseId: lead.case_id,
    },
    supabase
  );

  await syncLeadCreatedReminderJobs(lead, supabase);

  void publishLeadFlowEvent({
    tenantId,
    clinicId: lead.clinic_id,
    eventType: "lead_created",
    entityId: lead.id,
    entityType: "lead",
    eventMetadata: {
      source: leadSource?.source_system ?? "direct",
      stage: entry.slug,
      patient_id: lead.patient_id,
      case_id: lead.case_id,
    },
  });

  return lead;
}

export async function loadCrmLeadById(
  leadId: string,
  tenantId: string,
  client?: SupabaseClient
): Promise<FiCrmLeadRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("*")
    .eq("id", leadId.trim())
    .eq("tenant_id", tenantId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapFiCrmLeadRow(data as Record<string, unknown>);
}
