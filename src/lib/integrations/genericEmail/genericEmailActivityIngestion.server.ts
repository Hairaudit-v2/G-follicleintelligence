import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { revalidatePath } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { appendCrmActivityEvent } from "@/src/lib/crm/activity";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import { revalidateLiveDataSurfacesForTenant } from "@/src/lib/integrations/revalidateLiveDataPaths.server";
import {
  buildGenericEmailActivityTitle,
  buildGenericEmailCrmActivityDetail,
  buildGenericEmailToPreview,
  genericEmailActivityKind,
  normalizeGenericEmailToHashes,
  truncateBodyPreview,
  truncateSubjectPreview,
  type GenericEmailActivityInput,
  type GenericEmailDirection,
} from "./genericEmailActivityCore";
import { resolveGenericEmailActivityMatch } from "./genericEmailActivityMatch.server";

export type GenericEmailActivityRow = {
  id: string;
  tenant_id: string;
  source: string;
  external_message_id: string;
  external_thread_id: string | null;
  direction: GenericEmailDirection;
  from_email: string | null;
  to_email_hashes: string[];
  to_email_preview: string | null;
  subject_preview: string | null;
  body_preview: string | null;
  received_at: string | null;
  sent_at: string | null;
  matched_lead_id: string | null;
  matched_patient_id: string | null;
  match_confidence: number | null;
  match_reason: string | null;
  match_status: string;
  crm_activity_event_id: string | null;
  match_audit: Record<string, unknown>;
  created_at: string;
};

export type IngestGenericEmailActivityResult =
  | { ok: true; duplicate: true; activityId: string }
  | { ok: true; duplicate: false; activity: GenericEmailActivityRow; crmActivityEventId: string | null }
  | { ok: false; httpStatus: number; publicMessage: string };

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  now?: Date;
  skipRevalidation?: boolean;
};

function mapActivityRow(row: Record<string, unknown>): GenericEmailActivityRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    source: String(row.source),
    external_message_id: String(row.external_message_id),
    external_thread_id: row.external_thread_id != null ? String(row.external_thread_id) : null,
    direction: String(row.direction) as GenericEmailDirection,
    from_email: row.from_email != null ? String(row.from_email) : null,
    to_email_hashes: Array.isArray(row.to_email_hashes)
      ? row.to_email_hashes.map(String)
      : [],
    to_email_preview: row.to_email_preview != null ? String(row.to_email_preview) : null,
    subject_preview: row.subject_preview != null ? String(row.subject_preview) : null,
    body_preview: row.body_preview != null ? String(row.body_preview) : null,
    received_at: row.received_at != null ? String(row.received_at) : null,
    sent_at: row.sent_at != null ? String(row.sent_at) : null,
    matched_lead_id: row.matched_lead_id != null ? String(row.matched_lead_id) : null,
    matched_patient_id: row.matched_patient_id != null ? String(row.matched_patient_id) : null,
    match_confidence:
      row.match_confidence != null && Number.isFinite(Number(row.match_confidence))
        ? Number(row.match_confidence)
        : null,
    match_reason: row.match_reason != null ? String(row.match_reason) : null,
    match_status: String(row.match_status),
    crm_activity_event_id:
      row.crm_activity_event_id != null ? String(row.crm_activity_event_id) : null,
    match_audit:
      row.match_audit && typeof row.match_audit === "object" && !Array.isArray(row.match_audit)
        ? (row.match_audit as Record<string, unknown>)
        : {},
    created_at: String(row.created_at),
  };
}

function validateIngestInput(input: GenericEmailActivityInput): string | null {
  const tid = input.tenantId?.trim();
  if (!tid) return "tenantId is required.";
  const source = input.source?.trim();
  if (!source) return "source is required.";
  const messageId = input.externalMessageId?.trim();
  if (!messageId) return "externalMessageId is required.";
  if (input.direction !== "inbound" && input.direction !== "outbound") {
    return "direction must be inbound or outbound.";
  }
  return null;
}

function occurredAtForActivity(input: GenericEmailActivityInput): string {
  const raw =
    input.direction === "inbound"
      ? input.receivedAt?.trim()
      : input.sentAt?.trim() || input.receivedAt?.trim();
  if (raw && Number.isFinite(Date.parse(raw))) return raw;
  return new Date().toISOString();
}

/** Idempotent ingest + conservative match + optional CRM projection. */
export async function ingestGenericEmailActivity(
  input: GenericEmailActivityInput,
  opts: ServerOpts = {}
): Promise<IngestGenericEmailActivityResult> {
  const validationError = validateIngestInput(input);
  if (validationError) {
    return { ok: false, httpStatus: 400, publicMessage: validationError };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = input.tenantId.trim();
  const source = input.source.trim();
  const externalMessageId = input.externalMessageId.trim();
  const now = opts.now ?? new Date();

  const { data: existing, error: existingError } = await supabase
    .from("fi_generic_clinic_email_activities")
    .select("id")
    .eq("tenant_id", tid)
    .eq("source", source)
    .eq("external_message_id", externalMessageId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (existing?.id) {
    return { ok: true, duplicate: true, activityId: String(existing.id) };
  }

  const match = await resolveGenericEmailActivityMatch(supabase, {
    tenantId: tid,
    direction: input.direction,
    fromEmail: input.fromEmail,
    toEmails: input.toEmails,
    now,
  });

  const subjectPreview = truncateSubjectPreview(input.subject);
  const bodyPreview = truncateBodyPreview(input.bodyText);
  const fromEmail = normalizeEmail(input.fromEmail);
  const toHashes = normalizeGenericEmailToHashes(input.toEmails ?? []);
  const toPreview = buildGenericEmailToPreview(input.toEmails ?? []);

  const { data: inserted, error: insertError } = await supabase
    .from("fi_generic_clinic_email_activities")
    .insert({
      tenant_id: tid,
      source,
      external_message_id: externalMessageId,
      external_thread_id: input.externalThreadId?.trim() || null,
      direction: input.direction,
      from_email: fromEmail,
      to_email_hashes: toHashes,
      to_email_preview: toPreview,
      subject_preview: subjectPreview,
      body_preview: bodyPreview,
      received_at: input.receivedAt?.trim() || null,
      sent_at: input.sentAt?.trim() || null,
      matched_lead_id: match.matchedLeadId,
      matched_patient_id: match.matchedPatientId,
      match_confidence: match.matchConfidence,
      match_reason: match.matchReason,
      match_status: match.matchStatus,
      match_audit: match.matchAudit,
    })
    .select("*")
    .single();
  if (insertError) throw new Error(insertError.message);

  const activity = mapActivityRow(inserted as Record<string, unknown>);
  let crmActivityEventId: string | null = null;

  if (match.matchStatus === "matched" && match.matchedLeadId) {
    const crmEvent = await appendCrmActivityEvent(
      {
        tenantId: tid,
        leadId: match.matchedLeadId,
        patientId: match.matchedPatientId,
        activityKind: genericEmailActivityKind(input.direction),
        title: buildGenericEmailActivityTitle(input.direction),
        detail: buildGenericEmailCrmActivityDetail({
          genericEmailActivityId: activity.id,
          direction: input.direction,
          subjectPreview,
          matchConfidence: match.matchConfidence,
          matchReason: match.matchReason,
          externalMessageId,
        }),
        occurredAt: occurredAtForActivity(input),
      },
      supabase
    );
    crmActivityEventId = crmEvent.id;

    const { error: linkError } = await supabase
      .from("fi_generic_clinic_email_activities")
      .update({ crm_activity_event_id: crmActivityEventId })
      .eq("tenant_id", tid)
      .eq("id", activity.id);
    if (linkError) throw new Error(linkError.message);

    activity.crm_activity_event_id = crmActivityEventId;
  }

  if (!opts.skipRevalidation) {
    revalidateLiveDataSurfacesForTenant(tid, { includeIntegrationsSettings: true });
    if (match.matchedPatientId) {
      revalidatePath(`/fi-admin/${tid}/patients/${match.matchedPatientId}`);
      revalidatePath(`/fi-admin/${tid}/patients/${match.matchedPatientId}/timeline`);
    }
  }

  return { ok: true, duplicate: false, activity, crmActivityEventId };
}

export type GenericEmailIngestPayload = {
  source?: string;
  external_message_id?: string;
  external_thread_id?: string | null;
  direction?: string;
  from_email?: string | null;
  to_emails?: string[] | null;
  subject?: string | null;
  body_text?: string | null;
  received_at?: string | null;
  sent_at?: string | null;
};

export function normalizeGenericEmailIngestPayload(
  body: Record<string, unknown>
): Omit<GenericEmailActivityInput, "tenantId"> {
  const directionRaw = String(body.direction ?? "inbound").trim().toLowerCase();
  const direction: GenericEmailDirection = directionRaw === "outbound" ? "outbound" : "inbound";
  const toRaw = body.to_emails;
  const toEmails = Array.isArray(toRaw)
    ? toRaw.map((v) => String(v)).filter(Boolean)
    : typeof body.to_email === "string"
      ? [body.to_email]
      : [];

  return {
    source: String(body.source ?? "manual_test").trim() || "manual_test",
    externalMessageId: String(body.external_message_id ?? "").trim(),
    externalThreadId:
      body.external_thread_id != null ? String(body.external_thread_id).trim() : null,
    direction,
    fromEmail: body.from_email != null ? String(body.from_email) : null,
    toEmails,
    subject: body.subject != null ? String(body.subject) : null,
    bodyText: body.body_text != null ? String(body.body_text) : null,
    receivedAt: body.received_at != null ? String(body.received_at) : null,
    sentAt: body.sent_at != null ? String(body.sent_at) : null,
  };
}
