import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "./activity";
import {
  collectChangedLeadCommunicationDetailKeys,
  leadCommunicationDetailSnapshotFromRowLike,
} from "./crmLeadCommunicationChangedFields";
import {
  assertCrmLeadCommunicationDirectionAllowed,
  assertCrmLeadCommunicationMetadataObject,
  assertCrmLeadCommunicationOutcomeAllowed,
  assertCrmLeadCommunicationPreviewBounded,
  assertCrmLeadCommunicationSubjectBounded,
  assertCrmLeadCommunicationTypeAllowed,
  assertLeadCommunicationNotArchived,
} from "./crmLeadCommunicationPolicy";
import type { FiCrmLeadCommunicationRow } from "./types";
import { assertNonEmptyUuid } from "./validation";

const MAX_EXTERNAL_REF_LEN = 512;

function assertOptionalExternalRef(value: string | null | undefined, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  const t = String(value).trim();
  if (t.length > MAX_EXTERNAL_REF_LEN) {
    throw new Error(`${fieldName} must be at most ${MAX_EXTERNAL_REF_LEN} characters.`);
  }
  return t.length === 0 ? null : t;
}

export type CreateCrmLeadCommunicationParams = {
  tenantId: string;
  leadId: string;
  communicationType: string;
  direction: string;
  outcome?: string | null;
  subject?: string | null;
  preview?: string | null;
  externalMessageId?: string | null;
  externalThreadId?: string | null;
  contactAt?: string | null;
  nextFollowUpAt?: string | null;
  metadata?: unknown;
  /** Set only from trusted server context (not client input). */
  actorUserId?: string | null;
};

export type UpdateCrmLeadCommunicationParams = {
  tenantId: string;
  leadId: string;
  communicationId: string;
  communicationType?: string;
  direction?: string;
  outcome?: string | null;
  subject?: string | null;
  preview?: string | null;
  contactAt?: string | null;
  nextFollowUpAt?: string | null;
  metadata?: unknown;
};

function mapMetadata(row: Record<string, unknown>): Record<string, unknown> {
  const m = row.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function mapLeadCommunicationRow(row: Record<string, unknown>): FiCrmLeadCommunicationRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    lead_id: String(row.lead_id),
    actor_user_id: row.actor_user_id != null ? String(row.actor_user_id) : null,
    communication_type: String(row.communication_type),
    direction: String(row.direction),
    outcome: row.outcome != null ? String(row.outcome) : null,
    subject: row.subject != null ? String(row.subject) : null,
    preview: row.preview != null ? String(row.preview) : null,
    external_message_id: row.external_message_id != null ? String(row.external_message_id) : null,
    external_thread_id: row.external_thread_id != null ? String(row.external_thread_id) : null,
    contact_at: String(row.contact_at),
    next_follow_up_at: row.next_follow_up_at != null ? String(row.next_follow_up_at) : null,
    metadata: mapMetadata(row),
    archived_at: row.archived_at != null ? String(row.archived_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function loadCrmLeadCommunicationsForLead(
  tenantId: string,
  leadId: string,
  opts?: { limit?: number; client?: SupabaseClient }
): Promise<FiCrmLeadCommunicationRow[]> {
  const supabase: SupabaseClient = opts?.client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const limit = Math.min(Math.max(opts?.limit ?? 80, 1), 200);

  const { data, error } = await supabase
    .from("fi_crm_lead_communications")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .order("contact_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapLeadCommunicationRow);
}

export async function loadCrmLeadCommunicationForLead(
  tenantId: string,
  leadId: string,
  communicationId: string,
  client?: SupabaseClient
): Promise<FiCrmLeadCommunicationRow | null> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tid = assertNonEmptyUuid(tenantId, "tenantId");
  const lid = assertNonEmptyUuid(leadId, "leadId");
  const cid = assertNonEmptyUuid(communicationId, "communicationId");

  const { data, error } = await supabase
    .from("fi_crm_lead_communications")
    .select("*")
    .eq("tenant_id", tid)
    .eq("lead_id", lid)
    .eq("id", cid)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapLeadCommunicationRow(data as Record<string, unknown>);
}

async function assertActorBelongsToTenant(supabase: SupabaseClient, tenantId: string, fiUserId: string): Promise<void> {
  const { data, error } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", fiUserId.trim())
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("actor_user_id is not a user in this tenant.");
}

function parseIsoOrThrow(value: string, fieldLabel: string): string {
  const t = value.trim();
  if (!t) throw new Error(`${fieldLabel} is required.`);
  if (Number.isNaN(Date.parse(t))) throw new Error(`Invalid ${fieldLabel} datetime.`);
  return t;
}

export async function createCrmLeadCommunication(
  params: CreateCrmLeadCommunicationParams,
  client?: SupabaseClient
): Promise<FiCrmLeadCommunicationRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const tenantId = assertNonEmptyUuid(params.tenantId, "tenantId");
  const leadId = assertNonEmptyUuid(params.leadId, "leadId");

  const { data: leadExists, error: chk } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("id", leadId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (chk) throw new Error(chk.message);
  if (!leadExists) throw new Error("Lead not found for tenant.");

  const communicationType = assertCrmLeadCommunicationTypeAllowed(params.communicationType);
  const direction = assertCrmLeadCommunicationDirectionAllowed(params.direction);
  const outcome = assertCrmLeadCommunicationOutcomeAllowed(params.outcome);
  const subject = assertCrmLeadCommunicationSubjectBounded(params.subject);
  const preview = assertCrmLeadCommunicationPreviewBounded(params.preview);
  const externalMessageId = assertOptionalExternalRef(params.externalMessageId, "externalMessageId");
  const externalThreadId = assertOptionalExternalRef(params.externalThreadId, "externalThreadId");
  const metadata = assertCrmLeadCommunicationMetadataObject(params.metadata);

  const contactAt =
    params.contactAt != null && String(params.contactAt).trim()
      ? parseIsoOrThrow(String(params.contactAt), "contact_at")
      : new Date().toISOString();

  let nextFollowUpAt: string | null = null;
  if (params.nextFollowUpAt !== undefined) {
    if (params.nextFollowUpAt === null || !String(params.nextFollowUpAt).trim()) {
      nextFollowUpAt = null;
    } else {
      nextFollowUpAt = parseIsoOrThrow(String(params.nextFollowUpAt), "next_follow_up_at");
    }
  }

  const actorUserId = params.actorUserId?.trim() || null;
  if (actorUserId) {
    await assertActorBelongsToTenant(supabase, tenantId, actorUserId);
  }

  const { data, error } = await supabase
    .from("fi_crm_lead_communications")
    .insert({
      tenant_id: tenantId,
      lead_id: leadId,
      actor_user_id: actorUserId,
      communication_type: communicationType,
      direction,
      outcome,
      subject,
      preview,
      external_message_id: externalMessageId,
      external_thread_id: externalThreadId,
      contact_at: contactAt,
      next_follow_up_at: nextFollowUpAt,
      metadata,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const row = mapLeadCommunicationRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId,
      leadId,
      activityKind: "lead_communication.created",
      title: "Contact log entry created",
      detail: { communication_id: row.id, communication_type: row.communication_type, direction: row.direction },
    },
    supabase
  );

  return row;
}

export async function updateCrmLeadCommunication(
  params: UpdateCrmLeadCommunicationParams,
  client?: SupabaseClient
): Promise<FiCrmLeadCommunicationRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const row = await loadCrmLeadCommunicationForLead(params.tenantId, params.leadId, params.communicationId, supabase);
  if (!row) throw new Error("Contact log entry not found for this lead.");

  assertLeadCommunicationNotArchived(row);

  const hasPatch =
    params.communicationType !== undefined ||
    params.direction !== undefined ||
    params.outcome !== undefined ||
    params.subject !== undefined ||
    params.preview !== undefined ||
    params.contactAt !== undefined ||
    params.nextFollowUpAt !== undefined ||
    params.metadata !== undefined;
  if (!hasPatch) throw new Error("No contact log fields to update.");

  let nextType = row.communication_type;
  if (params.communicationType !== undefined) {
    nextType = assertCrmLeadCommunicationTypeAllowed(params.communicationType);
  }

  let nextDir = row.direction;
  if (params.direction !== undefined) {
    nextDir = assertCrmLeadCommunicationDirectionAllowed(params.direction);
  }

  let nextOutcome = row.outcome;
  if (params.outcome !== undefined) {
    nextOutcome = assertCrmLeadCommunicationOutcomeAllowed(params.outcome);
  }

  let nextSubject = row.subject;
  if (params.subject !== undefined) {
    nextSubject = assertCrmLeadCommunicationSubjectBounded(params.subject);
  }

  let nextPreview = row.preview;
  if (params.preview !== undefined) {
    nextPreview = assertCrmLeadCommunicationPreviewBounded(params.preview);
  }

  let nextContactAt = row.contact_at;
  if (params.contactAt !== undefined) {
    nextContactAt =
      params.contactAt === null || !String(params.contactAt).trim()
        ? row.contact_at
        : parseIsoOrThrow(String(params.contactAt), "contact_at");
  }

  let nextFollowUp = row.next_follow_up_at;
  if (params.nextFollowUpAt !== undefined) {
    if (params.nextFollowUpAt === null || !String(params.nextFollowUpAt).trim()) {
      nextFollowUp = null;
    } else {
      nextFollowUp = parseIsoOrThrow(String(params.nextFollowUpAt), "next_follow_up_at");
    }
  }

  let nextMeta = row.metadata;
  if (params.metadata !== undefined) {
    nextMeta = assertCrmLeadCommunicationMetadataObject(params.metadata);
  }

  const before = leadCommunicationDetailSnapshotFromRowLike(row);
  const after = leadCommunicationDetailSnapshotFromRowLike({
    ...row,
    communication_type: nextType,
    direction: nextDir,
    outcome: nextOutcome,
    subject: nextSubject,
    preview: nextPreview,
    contact_at: nextContactAt,
    next_follow_up_at: nextFollowUp,
    metadata: nextMeta,
  });
  const changed = collectChangedLeadCommunicationDetailKeys(before, after);
  if (changed.length === 0) {
    return row;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_lead_communications")
    .update({
      communication_type: nextType,
      direction: nextDir,
      outcome: nextOutcome,
      subject: nextSubject,
      preview: nextPreview,
      contact_at: nextContactAt,
      next_follow_up_at: nextFollowUp,
      metadata: nextMeta,
      updated_at: nowIso,
    })
    .eq("id", row.id)
    .eq("tenant_id", row.tenant_id)
    .eq("lead_id", row.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapLeadCommunicationRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      activityKind: "lead_communication.updated",
      title: "Contact log entry updated",
      detail: { communication_id: updated.id, changed_keys: changed },
    },
    supabase
  );

  return updated;
}

export async function archiveCrmLeadCommunication(
  params: { tenantId: string; leadId: string; communicationId: string },
  client?: SupabaseClient
): Promise<FiCrmLeadCommunicationRow> {
  const supabase: SupabaseClient = client ?? supabaseAdmin();
  const row = await loadCrmLeadCommunicationForLead(params.tenantId, params.leadId, params.communicationId, supabase);
  if (!row) throw new Error("Contact log entry not found for this lead.");

  if (row.archived_at) {
    return row;
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("fi_crm_lead_communications")
    .update({
      archived_at: nowIso,
      updated_at: nowIso,
    })
    .eq("id", row.id)
    .eq("tenant_id", row.tenant_id)
    .eq("lead_id", row.lead_id)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const updated = mapLeadCommunicationRow(data as Record<string, unknown>);

  await appendCrmActivityEvent(
    {
      tenantId: row.tenant_id,
      leadId: row.lead_id,
      activityKind: "lead_communication.archived",
      title: "Contact log entry archived",
      detail: { communication_id: updated.id },
    },
    supabase
  );

  return updated;
}
