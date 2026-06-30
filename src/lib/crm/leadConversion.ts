import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { shallowMergeMetadata } from "@/src/lib/fi/foundation/internal";
import { resolveOrCreateCaseFoundation } from "@/src/lib/fi/foundation/resolveCaseFoundation";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { appendCrmActivityEvent } from "./activity";
import { publishLeadFlowEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";
import {
  CRM_LEAD_CONVERSION_SOURCE_SYSTEM,
  assertCaseSeedAllowed,
  assertConversionNoteBounded,
  assertLeadNotYetConverted,
  type CrmLeadConversionMode,
} from "./crmLeadConversionPolicy";
import {
  assertNoAmbiguousPersonIdentityInTenant,
  extractPersonIdentitySignals,
} from "./crmLeadConversionIdentity";
import { loadCrmLeadById } from "./leads";
import { mapFiCrmLeadRow } from "./leadRow";
import type { CrmLeadConversionState, FiCrmLeadRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

export type ExecuteCrmLeadConversionParams = {
  tenantId: string;
  leadId: string;
  seedCase: boolean;
  caseType?: string | null;
  treatmentInterest?: string | null;
  conversionNote?: string | null;
  /** Server-resolved fi_users.id only; never from client JSON. */
  convertedByUserId?: string | null;
};

export type ExecuteCrmLeadConversionResult = {
  lead: FiCrmLeadRow;
  patientId: string;
  caseId: string | null;
  caseSeeded: boolean;
  conversionMode: CrmLeadConversionMode;
};

async function assertFiUserInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  fiUserId: string
): Promise<void> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", fiUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("converted_by user is not a member of this tenant.");
}

export async function loadCrmLeadConversionState(
  tenantId: string,
  leadId: string,
  client?: SupabaseClient
): Promise<CrmLeadConversionState | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const lead = await loadCrmLeadById(lid, tid, supabase);
  if (!lead) return null;

  const { data: personRow, error: pErr } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tid)
    .eq("id", lead.person_id)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  const person = personRow
    ? {
        id: String((personRow as { id: string }).id),
        metadata:
          (personRow as { metadata: unknown }).metadata &&
          typeof (personRow as { metadata: unknown }).metadata === "object" &&
          !Array.isArray((personRow as { metadata: unknown }).metadata)
            ? ((personRow as { metadata: Record<string, unknown> }).metadata as Record<
                string,
                unknown
              >)
            : {},
      }
    : null;

  let patient: { id: string; person_id: string } | null = null;
  if (lead.patient_id) {
    const { data: pat, error: patErr } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tid)
      .eq("id", lead.patient_id)
      .maybeSingle();
    if (patErr) throw new Error(patErr.message);
    if (pat?.id) {
      patient = { id: String(pat.id), person_id: String((pat as { person_id: string }).person_id) };
    }
  }

  let caseRow: { id: string; status: string } | null = null;
  if (lead.case_id) {
    const { data: c, error: cErr } = await supabase
      .from("fi_cases")
      .select("id, status")
      .eq("tenant_id", tid)
      .eq("id", lead.case_id)
      .is("deleted_at", null)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (c?.id) {
      caseRow = { id: String(c.id), status: String((c as { status: string }).status) };
    }
  }

  return { lead, person, patient, case: caseRow };
}

export async function executeCrmLeadConversion(
  params: ExecuteCrmLeadConversionParams,
  client?: SupabaseClient
): Promise<ExecuteCrmLeadConversionResult> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");
  const note = assertConversionNoteBounded(params.conversionNote);

  const lead = await loadCrmLeadById(leadId, tenantId, supabase);
  if (!lead) throw new Error("Lead not found for this tenant.");

  assertLeadNotYetConverted(lead);

  const convertedBy = params.convertedByUserId?.trim() || null;
  if (convertedBy) {
    await assertFiUserInTenant(supabase, tenantId, convertedBy);
  }

  const { data: personData, error: personErr } = await supabase
    .from("fi_persons")
    .select("id, metadata")
    .eq("tenant_id", tenantId)
    .eq("id", lead.person_id)
    .maybeSingle();
  if (personErr) throw new Error(personErr.message);
  if (!personData) throw new Error("Lead person not found in this tenant.");

  const personMeta =
    personData.metadata &&
    typeof personData.metadata === "object" &&
    !Array.isArray(personData.metadata)
      ? (personData.metadata as Record<string, unknown>)
      : {};

  const signals = extractPersonIdentitySignals(personMeta);
  await assertNoAmbiguousPersonIdentityInTenant(supabase, tenantId, lead.person_id, signals);

  if (lead.patient_id) {
    const { data: existingPat, error: epErr } = await supabase
      .from("fi_patients")
      .select("id, person_id")
      .eq("tenant_id", tenantId)
      .eq("id", lead.patient_id)
      .maybeSingle();
    if (epErr) throw new Error(epErr.message);
    if (!existingPat) {
      throw new Error("Lead references a patient that no longer exists.");
    }
    if (String((existingPat as { person_id: string }).person_id) !== lead.person_id) {
      throw new Error(
        "Lead patient link does not match the lead person; resolve before converting."
      );
    }
  }

  const { patient, created: patientCreated } = await resolveOrCreatePatient(
    {
      tenant_id: tenantId,
      person_id: lead.person_id,
      source_system: CRM_LEAD_CONVERSION_SOURCE_SYSTEM,
      source_patient_id: lead.id,
      primary_clinic_id: lead.clinic_id,
      metadata: { crm_lead_id: lead.id },
    },
    supabase
  );

  if (lead.patient_id && lead.patient_id !== patient.id) {
    throw new Error(
      "Lead patient link conflicts with resolved patient; resolve before converting."
    );
  }

  const conversionMode: CrmLeadConversionMode = patientCreated
    ? "patient_created"
    : "patient_linked";

  let caseSeeded = false;
  let newCaseId: string | null = null;

  if (params.seedCase) {
    assertCaseSeedAllowed(true, patient.id);
    if (lead.case_id) {
      // Lead already linked to a case — do not create another shell from this action.
    } else {
      const caseMeta = params.treatmentInterest?.trim()
        ? { treatment_interest: params.treatmentInterest.trim() }
        : undefined;
      const { case: caseRow, created } = await resolveOrCreateCaseFoundation(
        {
          tenant_id: tenantId,
          source_system: CRM_LEAD_CONVERSION_SOURCE_SYSTEM,
          source_case_id: lead.id,
          foundation_patient_id: patient.id,
          clinic_id: lead.clinic_id,
          organisation_id: lead.organisation_id,
          case_type: params.caseType?.trim() || null,
          status: "draft",
          metadata: caseMeta,
        },
        supabase
      );
      newCaseId = caseRow.id;
      caseSeeded = created;
    }
  }

  const nowIso = new Date().toISOString();
  let nextMetadata = lead.metadata;
  if (note) {
    nextMetadata = shallowMergeMetadata(lead.metadata, {
      crm_conversion: { note, at: nowIso },
    });
  }

  const patch: Record<string, unknown> = {
    patient_id: patient.id,
    converted_person_id: lead.person_id,
    converted_at: nowIso,
    converted_by_user_id: convertedBy,
    metadata: nextMetadata,
    updated_at: nowIso,
  };

  if (newCaseId) {
    patch.case_id = newCaseId;
    patch.converted_case_id = newCaseId;
  }

  const { data: updated, error: upErr } = await supabase
    .from("fi_crm_leads")
    .update(patch)
    .eq("id", lead.id)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (upErr) throw new Error(upErr.message);
  const outLead = mapFiCrmLeadRow(updated as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId: lead.id,
      activityKind: "lead.converted_to_person",
      title: "Lead converted to patient",
      detail: {
        person_id: lead.person_id,
        patient_id: patient.id,
        conversion_mode: conversionMode,
      },
    },
    supabase
  );

  if (caseSeeded && newCaseId) {
    await appendCrmActivityEvent(
      {
        tenantId,
        leadId: lead.id,
        activityKind: "lead.case_seeded",
        title: "Draft case created from lead",
        detail: {
          person_id: lead.person_id,
          patient_id: patient.id,
          case_id: newCaseId,
          conversion_mode: conversionMode,
        },
      },
      supabase
    );
  }

  void publishLeadFlowEvent({
    tenantId,
    clinicId: outLead.clinic_id,
    eventType: "lead_converted",
    entityId: lead.id,
    entityType: "lead",
    eventMetadata: {
      patient_id: patient.id,
      case_id: newCaseId,
      case_seeded: caseSeeded,
      conversion_mode: conversionMode,
    },
  });

  return {
    lead: outLead,
    patientId: patient.id,
    caseId: newCaseId,
    caseSeeded,
    conversionMode,
  };
}

/** Convert lead to foundation patient only (no new case shell). */
export async function convertCrmLeadToPerson(
  params: Omit<ExecuteCrmLeadConversionParams, "seedCase">,
  client?: SupabaseClient
): Promise<ExecuteCrmLeadConversionResult> {
  return executeCrmLeadConversion({ ...params, seedCase: false }, client);
}

/** Convert lead and seed a draft `fi_cases` row when the lead has no case yet. */
export async function convertCrmLeadToPersonAndSeedCase(
  params: Omit<ExecuteCrmLeadConversionParams, "seedCase">,
  client?: SupabaseClient
): Promise<ExecuteCrmLeadConversionResult> {
  return executeCrmLeadConversion({ ...params, seedCase: true }, client);
}
