import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ResolvePersonInput } from "@/src/lib/fi/foundation/types";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { appendCrmActivityEvent } from "./activity";
import { ensureDefaultPipelineStages, getEntryPipelineStage } from "./pipeline";
import { appendCrmLeadStageHistory } from "./stageHistory";
import type { CrmPipelineScope, FiCrmLeadRow } from "./types";
import { CRM_DEFAULT_PERSON_SOURCE_SYSTEM } from "./types";
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
  summary?: string | null;
  metadata?: Record<string, unknown> | null;
  pipelineKey?: string;
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
      summary: params.summary?.trim() || null,
      metadata,
    })
    .select("*")
    .single();

  if (leadErr) throw new Error(leadErr.message);
  const lead = mapFiCrmLeadRow(inserted as Record<string, unknown>);

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
      },
      patientId: lead.patient_id,
      caseId: lead.case_id,
    },
    supabase
  );

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
