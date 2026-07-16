import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hubspotReadJson, HubspotReadError } from "./hubspotBackupEngine.server";

export const HUBSPOT_ENGAGEMENT_MILESTONE = "FI-HUBSPOT-ENGAGEMENT-COMMUNICATIONS-BACKUP-1";

export const HUBSPOT_ENGAGEMENT_KINDS = [
  "notes",
  "emails",
  "conversation_threads",
  "conversation_messages",
  "files",
  "forms",
  "form_submissions",
] as const;

export type HubspotEngagementKind = (typeof HUBSPOT_ENGAGEMENT_KINDS)[number];

export type EngagementCapabilityStatus = "PASS" | "MISSING_SCOPE" | "UNSUPPORTED" | "FAIL";

export type EngagementCapability = {
  granted: boolean;
  status: number | null;
  archivedSupported: boolean;
  result: EngagementCapabilityStatus;
  requiredScope: string;
  formsApiPath?: string | null;
};

export type EngagementCounter = {
  active: number;
  archived: number;
  discovered: number;
  staged: number;
  updated: number;
  duplicates: number;
  skipped: number;
  failed: number;
  associations: number;
  attachmentReferences: number;
  contentBackedUp: number;
  distinctIds: number;
  complete: boolean;
  checkpointStatus: "pending" | "in_progress" | "complete" | "skipped_missing_scope";
  reconciliationStatus: "pending" | "exact" | "explained" | "unexplained" | "skipped";
  exportDifference: number | null;
  baseline: number | null;
};

export const ENGAGEMENT_MANUAL_BASELINES: Partial<Record<HubspotEngagementKind, number>> = {
  notes: 244,
  emails: 5248,
  conversation_threads: 1918,
  forms: 48,
  form_submissions: 4220,
};

type Phase = "active" | "archived" | "complete";
type RawObject = {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  associations?: Record<string, { results?: { id?: string; type?: string }[] }>;
  properties?: Record<string, unknown>;
  [key: string]: unknown;
};
type Page = { results?: RawObject[]; paging?: { next?: { after?: string } } };

const CRM_ASSOC = "contacts,deals,companies,tickets";

const checksum = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

const hashText = (value: string | null | undefined): string | null => {
  if (!value) return null;
  return createHash("sha256").update(value, "utf8").digest("hex");
};

export function engagementScopeFor(kind: HubspotEngagementKind): string {
  switch (kind) {
    case "notes":
      return "crm.objects.notes.read";
    case "emails":
      return "crm.objects.emails.read";
    case "conversation_threads":
    case "conversation_messages":
      return "conversations.read";
    case "files":
      return "files";
    case "forms":
    case "form_submissions":
      return "forms";
    default:
      return "unknown";
  }
}

export function blankEngagementCounter(kind: HubspotEngagementKind): EngagementCounter {
  return {
    active: 0,
    archived: 0,
    discovered: 0,
    staged: 0,
    updated: 0,
    duplicates: 0,
    skipped: 0,
    failed: 0,
    associations: 0,
    attachmentReferences: 0,
    contentBackedUp: 0,
    distinctIds: 0,
    complete: false,
    checkpointStatus: "pending",
    reconciliationStatus: "pending",
    exportDifference: null,
    baseline: ENGAGEMENT_MANUAL_BASELINES[kind] ?? null,
  };
}

function classifyCapability(
  status: number | null,
  granted: boolean
): EngagementCapabilityStatus {
  if (granted) return "PASS";
  if (status === 403) return "MISSING_SCOPE";
  if (status === 404 || status === 405) return "UNSUPPORTED";
  return "FAIL";
}

function contentChecksumFromRaw(raw: RawObject, kind: HubspotEngagementKind): string | null {
  try {
    if (kind === "notes") {
      const body = raw.properties?.hs_note_body ?? raw.properties?.hs_body_preview;
      return body == null ? null : checksum({ body });
    }
    if (kind === "emails") {
      const body = raw.properties?.hs_email_text ?? raw.properties?.hs_email_html;
      return body == null ? null : checksum({ body });
    }
    if (kind === "conversation_messages") {
      const text = raw.text ?? raw.richText;
      return text == null ? null : checksum({ text });
    }
    if (kind === "form_submissions") {
      const values = raw.values ?? raw.fieldValues;
      return values == null ? null : checksum({ values });
    }
  } catch {
    return null;
  }
  return null;
}

const CLINICAL_FORM_NAME_HINTS = [
  "pre-consultation",
  "preconsultation",
  "questionnaire",
  "post-consultation",
  "post-surgery",
  "medical",
  "clinical",
  "treatment",
  "health",
];

export function classifyFormSubmission(
  formName: string | null | undefined,
  fieldNames: readonly string[] = []
): "standard" | "restricted_clinical_intake" {
  const haystack = [formName ?? "", ...fieldNames].join(" ").toLowerCase();
  if (CLINICAL_FORM_NAME_HINTS.some((hint) => haystack.includes(hint))) {
    return "restricted_clinical_intake";
  }
  return "standard";
}

function prop(raw: RawObject, key: string): string | null {
  const value = raw.properties?.[key];
  if (value == null) return null;
  return String(value);
}

function extractFileIds(raw: RawObject): string[] {
  const ids = new Set<string>();
  const props = raw.properties ?? {};
  for (const key of ["hs_attachment_ids", "hs_attached_file_ids"]) {
    const value = props[key];
    if (typeof value === "string" && value.trim()) {
      for (const part of value.split(/[;,]/)) {
        const id = part.trim();
        if (id) ids.add(id);
      }
    }
  }
  const attachments = raw.attachments;
  if (Array.isArray(attachments)) {
    for (const item of attachments) {
      if (item && typeof item === "object") {
        const fileId = (item as { fileId?: string }).fileId?.trim();
        if (fileId) ids.add(fileId);
      }
    }
  }
  return [...ids];
}

function associationTargetType(plural: string): string | null {
  switch (plural) {
    case "contacts":
      return "contact";
    case "deals":
      return "deal";
    case "companies":
      return "company";
    case "tickets":
      return "ticket";
    default:
      return null;
  }
}

function crmAssociationRows(
  objects: RawObject[],
  fromType: "note" | "email",
  tenantId: string,
  integrationId: string,
  syncRunId: string
) {
  const unique = new Map<string, Record<string, unknown>>();
  for (const object of objects) {
    const fromId = object.id?.trim();
    if (!fromId) continue;
    for (const [plural, group] of Object.entries(object.associations ?? {})) {
      const toType = associationTargetType(plural);
      if (!toType) continue;
      for (const association of group.results ?? []) {
        const toId = association.id?.trim();
        if (!toId) continue;
        const key = [tenantId, integrationId, fromType, fromId, toType, toId].join("|");
        const prior = unique.get(key);
        const types = new Set<string>(prior ? (prior.association_types as string[]) : []);
        if (association.type) types.add(association.type);
        unique.set(key, {
          tenant_id: tenantId,
          integration_id: integrationId,
          sync_run_id: syncRunId,
          from_object_type: fromType,
          from_hubspot_id: fromId,
          to_object_type: toType,
          to_hubspot_id: toId,
          association_types: [...types],
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
  return [...unique.values()];
}

async function upsertAssociations(
  supabase: SupabaseClient,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (!rows.length) return 0;
  const { error } = await supabase.from("fi_external_hubspot_association_staging").upsert(rows, {
    onConflict: "tenant_id,integration_id,from_object_type,from_hubspot_id,to_object_type,to_hubspot_id",
  });
  if (error) throw new Error("Unable to stage HubSpot engagement associations.");
  return rows.length;
}

function reconcileCounter(counter: EngagementCounter): EngagementCounter {
  if (counter.baseline == null) {
    return { ...counter, reconciliationStatus: counter.complete ? "exact" : "pending", exportDifference: null };
  }
  const total = counter.active + counter.archived;
  const diff = total - counter.baseline;
  if (!counter.complete) return { ...counter, exportDifference: diff, reconciliationStatus: "pending" };
  if (diff === 0) return { ...counter, exportDifference: 0, reconciliationStatus: "exact" };
  // Archived extras or post-export growth/churn are treated as explainable when non-zero archive present
  // or when absolute drift is small relative to baseline; otherwise unexplained until operator review.
  if (counter.archived > 0 || Math.abs(diff) <= Math.max(5, Math.floor(counter.baseline * 0.02))) {
    return { ...counter, exportDifference: diff, reconciliationStatus: "explained" };
  }
  return { ...counter, exportDifference: diff, reconciliationStatus: "unexplained" };
}

export async function probeHubspotEngagementCapabilities(
  accessToken: string
): Promise<Record<HubspotEngagementKind, EngagementCapability>> {
  const capabilities = {} as Record<HubspotEngagementKind, EngagementCapability>;

  async function probePath(
    path: string,
    params: Record<string, string> = {}
  ): Promise<{ ok: boolean; status: number | null }> {
    try {
      await hubspotReadJson<Page>(path, accessToken, params);
      return { ok: true, status: 200 };
    } catch (error) {
      const status =
        error instanceof HubspotReadError
          ? error.status
          : typeof error === "object" && error && "status" in error
            ? Number((error as { status: unknown }).status)
            : null;
      return { ok: false, status: Number.isFinite(status) ? status : null };
    }
  }

  // Notes
  {
    const scope = engagementScopeFor("notes");
    const active = await probePath("/crm/v3/objects/notes", { limit: "1", archived: "false" });
    let archivedSupported = false;
    if (active.ok) {
      const archived = await probePath("/crm/v3/objects/notes", { limit: "1", archived: "true" });
      archivedSupported = archived.ok;
    }
    capabilities.notes = {
      granted: active.ok,
      status: active.status,
      archivedSupported,
      result: classifyCapability(active.status, active.ok),
      requiredScope: scope,
    };
  }

  // Emails
  {
    const scope = engagementScopeFor("emails");
    const active = await probePath("/crm/v3/objects/emails", { limit: "1", archived: "false" });
    let archivedSupported = false;
    if (active.ok) {
      const archived = await probePath("/crm/v3/objects/emails", { limit: "1", archived: "true" });
      archivedSupported = archived.ok;
    }
    capabilities.emails = {
      granted: active.ok,
      status: active.status,
      archivedSupported,
      result: classifyCapability(active.status, active.ok),
      requiredScope: scope,
    };
  }

  // Conversation threads
  {
    const scope = engagementScopeFor("conversation_threads");
    const active = await probePath("/conversations/v3/conversations/threads", {
      limit: "1",
      archived: "false",
    });
    let archivedSupported = false;
    if (active.ok) {
      const archived = await probePath("/conversations/v3/conversations/threads", {
        limit: "1",
        archived: "true",
      });
      archivedSupported = archived.ok;
    }
    capabilities.conversation_threads = {
      granted: active.ok,
      status: active.status,
      archivedSupported,
      result: classifyCapability(active.status, active.ok),
      requiredScope: scope,
    };
  }

  // Conversation messages (probe nested endpoint using first thread if available)
  {
    const scope = engagementScopeFor("conversation_messages");
    let granted = false;
    let status: number | null = null;
    if (capabilities.conversation_threads.granted) {
      try {
        const threads = await hubspotReadJson<Page>(
          "/conversations/v3/conversations/threads",
          accessToken,
          { limit: "1", archived: "false" }
        );
        const threadId = threads.results?.[0]?.id?.trim();
        if (threadId) {
          const msg = await probePath(
            `/conversations/v3/conversations/threads/${threadId}/messages`,
            { limit: "1" }
          );
          granted = msg.ok;
          status = msg.status;
        } else {
          // Threads readable but empty — treat messages as granted if threads passed.
          granted = true;
          status = 200;
        }
      } catch (error) {
        status = error instanceof HubspotReadError ? error.status : null;
        granted = false;
      }
    } else {
      status = capabilities.conversation_threads.status;
      granted = false;
    }
    capabilities.conversation_messages = {
      granted,
      status,
      archivedSupported: false,
      result: classifyCapability(status, granted),
      requiredScope: scope,
    };
  }

  // Files (metadata endpoint)
  {
    const scope = engagementScopeFor("files");
    const probe = await probePath("/files/v3/files", { limit: "1" });
    capabilities.files = {
      granted: probe.ok,
      status: probe.status,
      archivedSupported: false,
      result: classifyCapability(probe.status, probe.ok),
      requiredScope: scope,
    };
  }

  // Forms — try marketing v3 then legacy v2
  {
    const scope = engagementScopeFor("forms");
    const v3 = await probePath("/marketing/v3/forms/", { limit: "1" });
    if (v3.ok) {
      capabilities.forms = {
        granted: true,
        status: 200,
        archivedSupported: false,
        result: "PASS",
        requiredScope: scope,
        formsApiPath: "/marketing/v3/forms/",
      };
    } else {
      const v2 = await probePath("/forms/v2/forms");
      capabilities.forms = {
        granted: v2.ok,
        status: v2.status ?? v3.status,
        archivedSupported: false,
        result: classifyCapability(v2.status ?? v3.status, v2.ok),
        requiredScope: scope,
        formsApiPath: v2.ok ? "/forms/v2/forms" : null,
      };
    }
  }

  // Form submissions depend on forms scope; probe first form if available
  {
    const scope = engagementScopeFor("form_submissions");
    let granted = false;
    let status: number | null = null;
    if (capabilities.forms.granted && capabilities.forms.formsApiPath) {
      try {
        let formId: string | null = null;
        if (capabilities.forms.formsApiPath === "/marketing/v3/forms/") {
          const page = await hubspotReadJson<Page>("/marketing/v3/forms/", accessToken, {
            limit: "1",
          });
          formId = page.results?.[0]?.id?.trim() ?? null;
        } else {
          const list = await hubspotReadJson<RawObject[] | Page>("/forms/v2/forms", accessToken);
          const results = Array.isArray(list) ? list : list.results ?? [];
          const first = results[0] as RawObject | undefined;
          formId =
            first?.guid?.toString()?.trim() ??
            first?.id?.toString()?.trim() ??
            null;
        }
        if (formId) {
          const sub = await probePath(
            `/form-integrations/v1/submissions/forms/${formId}`,
            { limit: "1" }
          );
          granted = sub.ok;
          status = sub.status;
        } else {
          granted = true;
          status = 200;
        }
      } catch (error) {
        status = error instanceof HubspotReadError ? error.status : null;
        granted = false;
      }
    } else {
      status = capabilities.forms.status;
      granted = false;
    }
    capabilities.form_submissions = {
      granted,
      status,
      archivedSupported: false,
      result: classifyCapability(status, granted),
      requiredScope: scope,
      formsApiPath: capabilities.forms.formsApiPath,
    };
  }

  return capabilities;
}

function checkpointFor(
  checkpoints: Record<string, unknown>,
  kind: HubspotEngagementKind
): { phase: Phase; after: string | null } {
  const raw = (checkpoints[kind] ?? {}) as Record<string, unknown>;
  const phase: Phase =
    raw.phase === "archived" || raw.phase === "complete" ? raw.phase : "active";
  const cursor = phase === "archived" ? raw.archived : raw.active;
  return { phase, after: typeof cursor === "string" && cursor ? cursor : null };
}

/** Advance or end a paging phase. Stalled/repeated cursors must never loop forever. */
export function resolvePagingPhase(input: {
  currentPhase: Phase;
  currentAfter: string | null;
  nextAfter: string | null;
  archivedSupported: boolean;
}): { phase: Phase; after: string | null } {
  const next =
    typeof input.nextAfter === "string" && input.nextAfter.trim()
      ? input.nextAfter.trim()
      : null;
  const stalled = Boolean(next && input.currentAfter && next === input.currentAfter);
  if (next && !stalled) {
    return { phase: input.currentPhase, after: next };
  }
  if (input.currentPhase === "active" && input.archivedSupported) {
    return { phase: "archived", after: null };
  }
  return { phase: "complete", after: null };
}

async function persistEngagementCheckpoint(
  supabase: SupabaseClient,
  syncRunId: string,
  checkpoints: Record<string, unknown>,
  counters: Record<string, EngagementCounter>,
  capabilities: Record<HubspotEngagementKind, EngagementCapability>
): Promise<void> {
  const { error } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .update({
      engagement_checkpoints: checkpoints,
      engagement_counters: counters,
      engagement_capabilities: capabilities,
      last_checkpoint_at: new Date().toISOString(),
    })
    .eq("id", syncRunId);
  if (error) throw new Error("Unable to persist HubSpot engagement checkpoint.");
}

async function stageNotesOrEmails(
  supabase: SupabaseClient,
  kind: "notes" | "emails",
  objects: RawObject[],
  tenantId: string,
  integrationId: string,
  syncRunId: string
) {
  const table =
    kind === "notes" ? "fi_external_hubspot_note_staging" : "fi_external_hubspot_email_staging";
  const valid = objects.filter((row) => Boolean(row.id?.trim()));
  const ids = valid.map((row) => row.id!.trim());
  const { data, error: selectError } = ids.length
    ? await supabase
        .from(table)
        .select("hubspot_record_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .in("hubspot_record_id", ids)
    : { data: [], error: null };
  if (selectError) throw new Error(`Unable to check existing HubSpot ${kind} IDs.`);
  const existing = new Set(
    (data ?? []).map((row) => String((row as { hubspot_record_id: string }).hubspot_record_id))
  );
  const now = new Date().toISOString();
  const rows = valid.map((raw) => {
    const base = {
      tenant_id: tenantId,
      integration_id: integrationId,
      sync_run_id: syncRunId,
      hubspot_record_id: raw.id!.trim(),
      hubspot_created_at: raw.createdAt ?? null,
      hubspot_updated_at: raw.updatedAt ?? null,
      archived: Boolean(raw.archived),
      owner_id: prop(raw, "hubspot_owner_id"),
      activity_timestamp: prop(raw, "hs_timestamp"),
      raw_payload: raw,
      payload_checksum: checksum(raw),
      content_checksum: contentChecksumFromRaw(raw, kind),
      updated_at: now,
    };
    if (kind === "emails") {
      return {
        ...base,
        direction: prop(raw, "hs_email_direction"),
        status: prop(raw, "hs_email_status"),
        thread_id: prop(raw, "hs_email_thread_id"),
      };
    }
    return base;
  });
  if (rows.length) {
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: "tenant_id,integration_id,hubspot_record_id" });
    if (error) throw new Error(`Unable to stage HubSpot ${kind} page.`);
  }
  const associations = await upsertAssociations(
    supabase,
    crmAssociationRows(valid, kind === "notes" ? "note" : "email", tenantId, integrationId, syncRunId)
  );
  const attachmentReferences = valid.reduce(
    (sum, row) => sum + extractFileIds(row).length,
    0
  );
  return {
    staged: rows.length,
    duplicates: ids.filter((id) => existing.has(id)).length,
    updated: ids.filter((id) => existing.has(id)).length,
    skipped: objects.length - valid.length,
    archived: valid.filter((row) => row.archived).length,
    associations,
    attachmentReferences,
    fileRefs: valid.flatMap((row) =>
      extractFileIds(row).map((fileId) => ({
        fileId,
        sourceType: kind === "notes" ? "note" : "email",
        sourceId: row.id!.trim(),
      }))
    ),
  };
}

async function stageThreads(
  supabase: SupabaseClient,
  objects: RawObject[],
  tenantId: string,
  integrationId: string,
  syncRunId: string
) {
  const valid = objects.filter((row) => Boolean(row.id?.trim()));
  const ids = valid.map((row) => row.id!.trim());
  const { data, error: selectError } = ids.length
    ? await supabase
        .from("fi_external_hubspot_conversation_thread_staging")
        .select("hubspot_thread_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .in("hubspot_thread_id", ids)
    : { data: [], error: null };
  if (selectError) throw new Error("Unable to check existing HubSpot conversation thread IDs.");
  const existing = new Set(
    (data ?? []).map((row) => String((row as { hubspot_thread_id: string }).hubspot_thread_id))
  );
  const now = new Date().toISOString();
  const rows = valid.map((raw) => ({
    tenant_id: tenantId,
    integration_id: integrationId,
    sync_run_id: syncRunId,
    hubspot_thread_id: raw.id!.trim(),
    hubspot_created_at: (raw.createdAt as string | undefined) ?? null,
    hubspot_updated_at: (raw.latestMessageTimestamp as string | undefined) ??
      (raw.updatedAt as string | undefined) ??
      null,
    archived: Boolean(raw.archived),
    thread_status: raw.status != null ? String(raw.status) : null,
    source_channel:
      raw.originalChannelType != null
        ? String(raw.originalChannelType)
        : raw.channelAccountId != null
          ? String(raw.channelAccountId)
          : null,
    inbox_id: raw.inboxId != null ? String(raw.inboxId) : null,
    owner_id: raw.assignedTo != null ? String(raw.assignedTo) : null,
    closed_at: raw.closedAt != null ? String(raw.closedAt) : null,
    first_message_at:
      raw.latestMessageReceivedTimestamp != null
        ? String(raw.latestMessageReceivedTimestamp)
        : null,
    last_message_at:
      raw.latestMessageTimestamp != null ? String(raw.latestMessageTimestamp) : null,
    message_count: null,
    raw_payload: raw,
    payload_checksum: checksum(raw),
    content_checksum: null,
    updated_at: now,
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("fi_external_hubspot_conversation_thread_staging")
      .upsert(rows, { onConflict: "tenant_id,integration_id,hubspot_thread_id" });
    if (error) throw new Error("Unable to stage HubSpot conversation threads.");
  }

  const associationRows: Record<string, unknown>[] = [];
  for (const raw of valid) {
    const threadId = raw.id!.trim();
    const contactId =
      raw.associatedContactId != null ? String(raw.associatedContactId).trim() : "";
    const ticketId =
      raw.associatedTicketId != null ? String(raw.associatedTicketId).trim() : "";
    if (contactId) {
      associationRows.push({
        tenant_id: tenantId,
        integration_id: integrationId,
        sync_run_id: syncRunId,
        from_object_type: "conversation",
        from_hubspot_id: threadId,
        to_object_type: "contact",
        to_hubspot_id: contactId,
        association_types: ["associatedContactId"],
        updated_at: now,
      });
    }
    if (ticketId) {
      associationRows.push({
        tenant_id: tenantId,
        integration_id: integrationId,
        sync_run_id: syncRunId,
        from_object_type: "conversation",
        from_hubspot_id: threadId,
        to_object_type: "ticket",
        to_hubspot_id: ticketId,
        association_types: ["associatedTicketId"],
        updated_at: now,
      });
    }
  }
  const associations = await upsertAssociations(supabase, associationRows);
  return {
    staged: rows.length,
    duplicates: ids.filter((id) => existing.has(id)).length,
    updated: ids.filter((id) => existing.has(id)).length,
    skipped: objects.length - valid.length,
    archived: valid.filter((row) => row.archived).length,
    associations,
    threadIds: ids,
  };
}

async function stageMessages(
  supabase: SupabaseClient,
  threadId: string,
  objects: RawObject[],
  tenantId: string,
  integrationId: string,
  syncRunId: string
) {
  const valid = objects.filter((row) => Boolean(row.id?.trim()));
  const now = new Date().toISOString();
  const rows = valid.map((raw) => ({
    tenant_id: tenantId,
    integration_id: integrationId,
    sync_run_id: syncRunId,
    hubspot_thread_id: threadId,
    hubspot_message_id: raw.id!.trim(),
    hubspot_created_at: (raw.createdAt as string | undefined) ?? null,
    hubspot_updated_at: (raw.updatedAt as string | undefined) ?? null,
    archived: Boolean(raw.archived),
    direction: raw.direction != null ? String(raw.direction) : null,
    message_type: raw.type != null ? String(raw.type) : null,
    sender_role: Array.isArray(raw.senders)
      ? String((raw.senders[0] as { type?: string } | undefined)?.type ?? "") || null
      : null,
    raw_payload: raw,
    payload_checksum: checksum(raw),
    content_checksum: contentChecksumFromRaw(raw, "conversation_messages"),
    updated_at: now,
  }));
  if (rows.length) {
    const { error } = await supabase
      .from("fi_external_hubspot_conversation_message_staging")
      .upsert(rows, {
        onConflict: "tenant_id,integration_id,hubspot_thread_id,hubspot_message_id",
      });
    if (error) throw new Error("Unable to stage HubSpot conversation messages.");
  }
  const associationRows = valid.map((raw) => ({
    tenant_id: tenantId,
    integration_id: integrationId,
    sync_run_id: syncRunId,
    from_object_type: "message",
    from_hubspot_id: raw.id!.trim(),
    to_object_type: "conversation",
    to_hubspot_id: threadId,
    association_types: ["thread"],
    updated_at: now,
  }));
  const associations = await upsertAssociations(supabase, associationRows);
  const fileRefs = valid.flatMap((row) =>
    extractFileIds(row).map((fileId) => ({
      fileId,
      sourceType: "message",
      sourceId: row.id!.trim(),
    }))
  );
  return {
    staged: rows.length,
    skipped: objects.length - valid.length,
    associations,
    attachmentReferences: fileRefs.length,
    fileRefs,
  };
}

async function stageForms(
  supabase: SupabaseClient,
  objects: RawObject[],
  tenantId: string,
  integrationId: string,
  syncRunId: string,
  apiPath: string
) {
  const valid = objects
    .map((raw) => {
      const id =
        apiPath === "/forms/v2/forms"
          ? String(raw.guid ?? raw.id ?? "").trim()
          : String(raw.id ?? "").trim();
      return id ? { raw, id } : null;
    })
    .filter((row): row is { raw: RawObject; id: string } => Boolean(row));
  const ids = valid.map((row) => row.id);
  const { data, error: selectError } = ids.length
    ? await supabase
        .from("fi_external_hubspot_form_definition_staging")
        .select("hubspot_form_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .in("hubspot_form_id", ids)
    : { data: [], error: null };
  if (selectError) throw new Error("Unable to check existing HubSpot form IDs.");
  const existing = new Set(
    (data ?? []).map((row) => String((row as { hubspot_form_id: string }).hubspot_form_id))
  );
  const now = new Date().toISOString();
  const rows = valid.map(({ raw, id }) => {
    const name =
      typeof raw.name === "string"
        ? raw.name
        : typeof raw.formName === "string"
          ? raw.formName
          : null;
    return {
      tenant_id: tenantId,
      integration_id: integrationId,
      sync_run_id: syncRunId,
      hubspot_form_id: id,
      hubspot_created_at:
        typeof raw.createdAt === "string"
          ? raw.createdAt
          : typeof raw.createdAt === "number"
            ? new Date(raw.createdAt).toISOString()
            : null,
      hubspot_updated_at:
        typeof raw.updatedAt === "string"
          ? raw.updatedAt
          : typeof raw.updatedAt === "number"
            ? new Date(raw.updatedAt).toISOString()
            : null,
      archived: Boolean(raw.archived ?? raw.deletedAt),
      form_name_hash: hashText(name),
      raw_payload: raw,
      payload_checksum: checksum(raw),
      content_checksum: null,
      updated_at: now,
    };
  });
  if (rows.length) {
    const { error } = await supabase
      .from("fi_external_hubspot_form_definition_staging")
      .upsert(rows, { onConflict: "tenant_id,integration_id,hubspot_form_id" });
    if (error) throw new Error("Unable to stage HubSpot form definitions.");
  }
  return {
    staged: rows.length,
    duplicates: ids.filter((id) => existing.has(id)).length,
    updated: ids.filter((id) => existing.has(id)).length,
    skipped: objects.length - valid.length,
    archived: rows.filter((row) => row.archived).length,
    formIds: ids,
    formMeta: valid.map(({ raw, id }) => ({
      id,
      name: typeof raw.name === "string" ? raw.name : null,
      fieldNames: Array.isArray(raw.fieldGroups)
        ? (raw.fieldGroups as { fields?: { name?: string }[] }[]).flatMap((group) =>
            (group.fields ?? []).map((field) => field.name ?? "").filter(Boolean)
          )
        : Array.isArray(raw.formFieldGroups)
          ? (raw.formFieldGroups as { fields?: { name?: string }[] }[]).flatMap((group) =>
              (group.fields ?? []).map((field) => field.name ?? "").filter(Boolean)
            )
          : [],
    })),
  };
}

async function stageSubmissions(
  supabase: SupabaseClient,
  formId: string,
  formName: string | null,
  fieldNames: readonly string[],
  objects: RawObject[],
  tenantId: string,
  integrationId: string,
  syncRunId: string
) {
  const valid = objects
    .map((raw) => {
      const id = String(
        raw.conversionId ?? raw.submissionId ?? raw.id ?? ""
      ).trim();
      return id ? { raw, id } : null;
    })
    .filter((row): row is { raw: RawObject; id: string } => Boolean(row));
  const now = new Date().toISOString();
  const classification = classifyFormSubmission(formName, fieldNames);
  const rows = valid.map(({ raw, id }) => {
    const pageUrl =
      typeof raw.pageUrl === "string"
        ? raw.pageUrl
        : typeof (raw as { submittedAt?: unknown }).submittedAt === "string"
          ? null
          : null;
    const contactId =
      raw.contactId != null
        ? String(raw.contactId)
        : Array.isArray(raw.values)
          ? null
          : null;
    return {
      tenant_id: tenantId,
      integration_id: integrationId,
      sync_run_id: syncRunId,
      hubspot_form_id: formId,
      hubspot_submission_id: id,
      hubspot_created_at:
        raw.submittedAt != null
          ? typeof raw.submittedAt === "number"
            ? new Date(raw.submittedAt).toISOString()
            : String(raw.submittedAt)
          : null,
      hubspot_updated_at: null,
      archived: false,
      linked_contact_id: contactId,
      page_url_hash: hashText(pageUrl),
      content_classification: classification,
      raw_payload: raw,
      payload_checksum: checksum(raw),
      content_checksum: contentChecksumFromRaw(raw, "form_submissions"),
      updated_at: now,
    };
  });
  if (rows.length) {
    const { error } = await supabase
      .from("fi_external_hubspot_form_submission_staging")
      .upsert(rows, {
        onConflict: "tenant_id,integration_id,hubspot_form_id,hubspot_submission_id",
      });
    if (error) throw new Error("Unable to stage HubSpot form submissions.");
  }
  const associationRows: Record<string, unknown>[] = valid.flatMap(({ raw, id }) => {
    const edges: Record<string, unknown>[] = [
      {
        tenant_id: tenantId,
        integration_id: integrationId,
        sync_run_id: syncRunId,
        from_object_type: "form_submission",
        from_hubspot_id: id,
        to_object_type: "form",
        to_hubspot_id: formId,
        association_types: ["form"],
        updated_at: now,
      },
    ];
    const contactId = raw.contactId != null ? String(raw.contactId).trim() : "";
    if (contactId) {
      edges.push({
        tenant_id: tenantId,
        integration_id: integrationId,
        sync_run_id: syncRunId,
        from_object_type: "form_submission",
        from_hubspot_id: id,
        to_object_type: "contact",
        to_hubspot_id: contactId,
        association_types: ["contact"],
        updated_at: now,
      });
    }
    return edges;
  });
  const associations = await upsertAssociations(supabase, associationRows);
  return {
    staged: rows.length,
    skipped: objects.length - valid.length,
    associations,
  };
}

async function stageFileInventory(
  supabase: SupabaseClient,
  refs: { fileId: string; sourceType: string; sourceId: string }[],
  tenantId: string,
  integrationId: string,
  syncRunId: string,
  accessToken: string,
  filesGranted: boolean
) {
  const unique = new Map<string, { fileId: string; sourceType: string; sourceId: string }>();
  for (const ref of refs) {
    if (!unique.has(ref.fileId)) unique.set(ref.fileId, ref);
  }
  const now = new Date().toISOString();
  let staged = 0;
  let failed = 0;
  let attachmentReferences = 0;
  const associationRows: Record<string, unknown>[] = [];

  for (const ref of unique.values()) {
    attachmentReferences += 1;
    let inventoryStatus:
      | "metadata_backed_up"
      | "access_denied"
      | "expired_reference"
      | "unsupported"
      | "failed_validation" = "metadata_backed_up";
    let mimeType: string | null = null;
    let sizeBytes: number | null = null;
    let createdAt: string | null = null;
    let updatedAt: string | null = null;
    let archived = false;
    let raw: Record<string, unknown> = {
      id: ref.fileId,
      source_object_type: ref.sourceType,
      source_object_id: ref.sourceId,
      content_download: false,
    };
    let retrievalFailure: string | null = null;
    let secureDownloadStatus = "not_requested";

    if (!filesGranted) {
      inventoryStatus = "access_denied";
      retrievalFailure = "missing_files_scope";
      secureDownloadStatus = "denied";
    } else {
      try {
        const meta = await hubspotReadJson<Record<string, unknown>>(
          `/files/v3/files/${ref.fileId}`,
          accessToken
        );
        raw = { ...meta, content_download: false };
        mimeType =
          typeof meta.type === "string"
            ? meta.type
            : typeof meta.extension === "string"
              ? meta.extension
              : null;
        sizeBytes =
          typeof meta.size === "number"
            ? meta.size
            : typeof meta.bytes === "number"
              ? meta.bytes
              : null;
        createdAt = typeof meta.createdAt === "string" ? meta.createdAt : null;
        updatedAt = typeof meta.updatedAt === "string" ? meta.updatedAt : null;
        archived = Boolean(meta.archived);
        inventoryStatus = "metadata_backed_up";
        secureDownloadStatus = "metadata_only";
      } catch (error) {
        const status = error instanceof HubspotReadError ? error.status : 0;
        if (status === 403) {
          inventoryStatus = "access_denied";
          retrievalFailure = "access_denied";
        } else if (status === 404) {
          inventoryStatus = "expired_reference";
          retrievalFailure = "not_found";
        } else if (status === 405 || status === 501) {
          inventoryStatus = "unsupported";
          retrievalFailure = "unsupported";
        } else {
          inventoryStatus = "failed_validation";
          retrievalFailure = "metadata_fetch_failed";
          failed += 1;
        }
        secureDownloadStatus = "denied";
      }
    }

    const row = {
      tenant_id: tenantId,
      integration_id: integrationId,
      sync_run_id: syncRunId,
      hubspot_file_id: ref.fileId,
      source_object_type: ref.sourceType,
      source_object_id: ref.sourceId,
      mime_type: mimeType,
      size_bytes: sizeBytes,
      hubspot_created_at: createdAt,
      hubspot_updated_at: updatedAt,
      archived,
      inventory_status: inventoryStatus,
      secure_download_status: secureDownloadStatus,
      retrieval_failure_reason: retrievalFailure,
      malware_validation_status: null,
      raw_payload: raw,
      payload_checksum: checksum(raw),
      content_checksum: null,
      updated_at: now,
    };
    const { error } = await supabase
      .from("fi_external_hubspot_file_inventory")
      .upsert(row, { onConflict: "tenant_id,integration_id,hubspot_file_id" });
    if (error) {
      failed += 1;
      continue;
    }
    staged += 1;
    associationRows.push({
      tenant_id: tenantId,
      integration_id: integrationId,
      sync_run_id: syncRunId,
      from_object_type: "file",
      from_hubspot_id: ref.fileId,
      to_object_type: ref.sourceType,
      to_hubspot_id: ref.sourceId,
      association_types: ["attachment"],
      updated_at: now,
    });
  }

  const associations = await upsertAssociations(supabase, associationRows);
  return { staged, failed, attachmentReferences, associations, contentBackedUp: 0 };
}

async function runCrmObjectKind(
  params: {
    supabase: SupabaseClient;
    accessToken: string;
    tenantId: string;
    integrationId: string;
    syncRunId: string;
    kind: "notes" | "emails";
    capability: EngagementCapability;
    checkpoints: Record<string, unknown>;
    counters: Record<string, EngagementCounter>;
    capabilities: Record<HubspotEngagementKind, EngagementCapability>;
    fileRefs: { fileId: string; sourceType: string; sourceId: string }[];
  }
): Promise<void> {
  const { kind, capability } = params;
  const counter = params.counters[kind];
  if (!capability.granted) {
    counter.checkpointStatus = "skipped_missing_scope";
    counter.complete = false;
    counter.reconciliationStatus = "skipped";
    await persistEngagementCheckpoint(
      params.supabase,
      params.syncRunId,
      params.checkpoints,
      params.counters,
      params.capabilities
    );
    return;
  }

  let checkpoint = checkpointFor(params.checkpoints, kind);
  counter.checkpointStatus = "in_progress";
  const path = kind === "notes" ? "/crm/v3/objects/notes" : "/crm/v3/objects/emails";
  const properties =
    kind === "notes"
      ? "hs_note_body,hs_timestamp,hubspot_owner_id,hs_attachment_ids,hs_object_id"
      : "hs_email_text,hs_email_html,hs_email_direction,hs_email_status,hs_email_thread_id,hs_timestamp,hubspot_owner_id,hs_attachment_ids,hs_object_id";

  while (checkpoint.phase !== "complete") {
    const archived = checkpoint.phase === "archived";
    if (archived && !capability.archivedSupported) {
      checkpoint = { phase: "complete", after: null };
      params.checkpoints[kind] = {
        ...(params.checkpoints[kind] as object ?? {}),
        phase: "complete",
        archived: null,
      };
      counter.complete = true;
      counter.checkpointStatus = "complete";
    } else {
      const query: Record<string, string> = {
        limit: "100",
        archived: String(archived),
        associations: CRM_ASSOC,
        properties,
      };
      if (checkpoint.after) query.after = checkpoint.after;
      const page = await hubspotReadJson<Page>(path, params.accessToken, query);
      const objects = page.results ?? [];
      const staged = await stageNotesOrEmails(
        params.supabase,
        kind,
        objects,
        params.tenantId,
        params.integrationId,
        params.syncRunId
      );
      counter.discovered += objects.length;
      counter.staged += staged.staged;
      counter.updated += staged.updated;
      counter.duplicates += staged.duplicates;
      counter.skipped += staged.skipped;
      counter.archived += staged.archived;
      counter.active += objects.length - staged.archived;
      counter.associations += staged.associations;
      counter.attachmentReferences += staged.attachmentReferences;
      params.fileRefs.push(...staged.fileRefs);
      const advanced = resolvePagingPhase({
        currentPhase: checkpoint.phase,
        currentAfter: checkpoint.after,
        nextAfter: page.paging?.next?.after ?? null,
        archivedSupported: capability.archivedSupported,
      });
      params.checkpoints[kind] = {
        active:
          checkpoint.phase === "active"
            ? advanced.phase === "active"
              ? advanced.after
              : null
            : ((params.checkpoints[kind] as Record<string, unknown>)?.active ?? null),
        archived: advanced.phase === "archived" ? advanced.after : null,
        phase: advanced.phase,
      };
      counter.complete = advanced.phase === "complete";
      counter.checkpointStatus = advanced.phase === "complete" ? "complete" : "in_progress";
      checkpoint = { phase: advanced.phase, after: advanced.after };
    }
    counter.distinctIds = counter.staged;
    Object.assign(counter, reconcileCounter(counter));
    await persistEngagementCheckpoint(
      params.supabase,
      params.syncRunId,
      params.checkpoints,
      params.counters,
      params.capabilities
    );
  }
}

export async function runHubspotEngagementBackup(params: {
  supabase: SupabaseClient;
  accessToken: string;
  integrationId: string;
  tenantId: string;
  syncRun: Record<string, unknown>;
  capabilities: Record<HubspotEngagementKind, EngagementCapability>;
}): Promise<Record<HubspotEngagementKind, EngagementCounter>> {
  const { supabase, accessToken, integrationId, tenantId, syncRun, capabilities } = params;
  const syncRunId = String(syncRun.id);
  const checkpoints = (syncRun.engagement_checkpoints ?? {}) as Record<string, unknown>;
  const counters = (syncRun.engagement_counters ?? {}) as Record<string, EngagementCounter>;
  const fileRefs: { fileId: string; sourceType: string; sourceId: string }[] = [];

  for (const kind of HUBSPOT_ENGAGEMENT_KINDS) {
    counters[kind] = { ...blankEngagementCounter(kind), ...(counters[kind] ?? {}) };
  }

  // Notes + emails
  await runCrmObjectKind({
    supabase,
    accessToken,
    tenantId,
    integrationId,
    syncRunId,
    kind: "notes",
    capability: capabilities.notes,
    checkpoints,
    counters,
    capabilities,
    fileRefs,
  });
  await runCrmObjectKind({
    supabase,
    accessToken,
    tenantId,
    integrationId,
    syncRunId,
    kind: "emails",
    capability: capabilities.emails,
    checkpoints,
    counters,
    capabilities,
    fileRefs,
  });

  // Conversation threads
  {
    const kind: HubspotEngagementKind = "conversation_threads";
    const counter = counters[kind];
    if (!capabilities[kind].granted) {
      counter.checkpointStatus = "skipped_missing_scope";
      counter.reconciliationStatus = "skipped";
      await persistEngagementCheckpoint(supabase, syncRunId, checkpoints, counters, capabilities);
    } else {
      let checkpoint = checkpointFor(checkpoints, kind);
      counter.checkpointStatus = "in_progress";
      while (checkpoint.phase !== "complete") {
        const archived = checkpoint.phase === "archived";
        if (archived && !capabilities[kind].archivedSupported) {
          checkpoint = { phase: "complete", after: null };
          checkpoints[kind] = { ...(checkpoints[kind] as object ?? {}), phase: "complete" };
          counter.complete = true;
          counter.checkpointStatus = "complete";
        } else {
          const query: Record<string, string> = { limit: "100", archived: String(archived) };
          if (checkpoint.after) query.after = checkpoint.after;
          const page = await hubspotReadJson<Page>(
            "/conversations/v3/conversations/threads",
            accessToken,
            query
          );
          const objects = page.results ?? [];
          const staged = await stageThreads(
            supabase,
            objects,
            tenantId,
            integrationId,
            syncRunId
          );
          counter.discovered += objects.length;
          counter.staged += staged.staged;
          counter.updated += staged.updated;
          counter.duplicates += staged.duplicates;
          counter.skipped += staged.skipped;
          counter.archived += staged.archived;
          counter.active += objects.length - staged.archived;
          counter.associations += staged.associations;
          const advanced = resolvePagingPhase({
            currentPhase: checkpoint.phase,
            currentAfter: checkpoint.after,
            nextAfter: page.paging?.next?.after ?? null,
            archivedSupported: capabilities[kind].archivedSupported,
          });
          const priorIds = new Set(
            (((checkpoints[kind] as Record<string, unknown>)?.thread_ids as string[]) ?? []).filter(
              Boolean
            )
          );
          for (const id of staged.threadIds) priorIds.add(id);
          checkpoints[kind] = {
            active:
              checkpoint.phase === "active"
                ? advanced.phase === "active"
                  ? advanced.after
                  : null
                : ((checkpoints[kind] as Record<string, unknown>)?.active ?? null),
            archived: advanced.phase === "archived" ? advanced.after : null,
            phase: advanced.phase,
            thread_ids: [...priorIds],
          };
          counter.complete = advanced.phase === "complete";
          counter.checkpointStatus = advanced.phase === "complete" ? "complete" : "in_progress";
          checkpoint = { phase: advanced.phase, after: advanced.after };
        }
        counter.distinctIds = counter.staged;
        Object.assign(counter, reconcileCounter(counter));
        await persistEngagementCheckpoint(
          supabase,
          syncRunId,
          checkpoints,
          counters,
          capabilities
        );
      }
    }
  }

  // Conversation messages — resume-aware nested pagination
  {
    const kind: HubspotEngagementKind = "conversation_messages";
    const counter = counters[kind];
    if (!capabilities[kind].granted) {
      counter.checkpointStatus = "skipped_missing_scope";
      counter.reconciliationStatus = "skipped";
      await persistEngagementCheckpoint(supabase, syncRunId, checkpoints, counters, capabilities);
    } else {
      const threadCp = (checkpoints.conversation_threads ?? {}) as Record<string, unknown>;
      const threadIds = Array.isArray(threadCp.thread_ids)
        ? (threadCp.thread_ids as string[])
        : [];
      // Also load from staging if checkpoint thread list empty (resume safety)
      let ids = threadIds;
      if (!ids.length) {
        const { data } = await supabase
          .from("fi_external_hubspot_conversation_thread_staging")
          .select("hubspot_thread_id")
          .eq("tenant_id", tenantId)
          .eq("integration_id", integrationId);
        ids = (data ?? []).map((row) =>
          String((row as { hubspot_thread_id: string }).hubspot_thread_id)
        );
      }
      const msgCp = (checkpoints[kind] ?? {}) as Record<string, unknown>;
      let startIndex = 0;
      if (typeof msgCp.current_thread_id === "string" && msgCp.current_thread_id) {
        const idx = ids.indexOf(msgCp.current_thread_id);
        startIndex = idx >= 0 ? idx : 0;
      }
      counter.checkpointStatus = "in_progress";

      for (let i = startIndex; i < ids.length; i += 1) {
        const threadId = ids[i]!;
        let after =
          i === startIndex && typeof msgCp.message_after === "string"
            ? msgCp.message_after
            : null;
        let pageDone = false;
        while (!pageDone) {
          const query: Record<string, string> = { limit: "100" };
          if (after) query.after = after;
          const page = await hubspotReadJson<Page>(
            `/conversations/v3/conversations/threads/${threadId}/messages`,
            accessToken,
            query
          );
          const objects = page.results ?? [];
          const staged = await stageMessages(
            supabase,
            threadId,
            objects,
            tenantId,
            integrationId,
            syncRunId
          );
          counter.discovered += objects.length;
          counter.staged += staged.staged;
          counter.skipped += staged.skipped;
          counter.active += staged.staged;
          counter.associations += staged.associations;
          counter.attachmentReferences += staged.attachmentReferences;
          fileRefs.push(...staged.fileRefs);
          const next = page.paging?.next?.after ?? null;
          if (next) {
            after = next;
            checkpoints[kind] = {
              current_thread_id: threadId,
              message_after: next,
              thread_index: i,
              phase: "active",
            };
          } else {
            pageDone = true;
            after = null;
            checkpoints[kind] = {
              current_thread_id: i + 1 < ids.length ? ids[i + 1] : null,
              message_after: null,
              thread_index: i + 1,
              phase: i + 1 < ids.length ? "active" : "complete",
            };
          }
          counter.distinctIds = counter.staged;
          counter.complete =
            (checkpoints[kind] as Record<string, unknown> | undefined)?.phase === "complete";
          counter.checkpointStatus = counter.complete ? "complete" : "in_progress";
          Object.assign(counter, reconcileCounter(counter));
          await persistEngagementCheckpoint(
            supabase,
            syncRunId,
            checkpoints,
            counters,
            capabilities
          );
        }
      }
      if (!ids.length) {
        counter.complete = true;
        counter.checkpointStatus = "complete";
        checkpoints[kind] = { phase: "complete", current_thread_id: null, message_after: null };
        Object.assign(counter, reconcileCounter(counter));
        await persistEngagementCheckpoint(
          supabase,
          syncRunId,
          checkpoints,
          counters,
          capabilities
        );
      }
    }
  }

  // Forms
  const formMetaById = new Map<string, { name: string | null; fieldNames: string[] }>();
  {
    const kind: HubspotEngagementKind = "forms";
    const counter = counters[kind];
    if (!capabilities[kind].granted || !capabilities[kind].formsApiPath) {
      counter.checkpointStatus = "skipped_missing_scope";
      counter.reconciliationStatus = "skipped";
      await persistEngagementCheckpoint(supabase, syncRunId, checkpoints, counters, capabilities);
    } else {
      const apiPath = capabilities[kind].formsApiPath!;
      let after =
        typeof (checkpoints[kind] as Record<string, unknown> | undefined)?.active === "string"
          ? String((checkpoints[kind] as Record<string, unknown>).active)
          : null;
      let phase =
        (checkpoints[kind] as Record<string, unknown> | undefined)?.phase === "complete"
          ? ("complete" as const)
          : ("active" as const);
      counter.checkpointStatus = "in_progress";
      while (phase !== "complete") {
        if (apiPath === "/forms/v2/forms") {
          const list = await hubspotReadJson<RawObject[] | Page>(apiPath, accessToken);
          const objects = Array.isArray(list) ? list : list.results ?? [];
          const staged = await stageForms(
            supabase,
            objects,
            tenantId,
            integrationId,
            syncRunId,
            apiPath
          );
          for (const meta of staged.formMeta) {
            formMetaById.set(meta.id, { name: meta.name, fieldNames: meta.fieldNames });
          }
          counter.discovered += objects.length;
          counter.staged += staged.staged;
          counter.updated += staged.updated;
          counter.duplicates += staged.duplicates;
          counter.skipped += staged.skipped;
          counter.archived += staged.archived;
          counter.active += staged.staged - staged.archived;
          checkpoints[kind] = {
            active: null,
            phase: "complete",
            form_ids: staged.formIds,
          };
          phase = "complete";
          counter.complete = true;
          counter.checkpointStatus = "complete";
        } else {
          const query: Record<string, string> = { limit: "100" };
          if (after) query.after = after;
          const page = await hubspotReadJson<Page>(apiPath, accessToken, query);
          const objects = page.results ?? [];
          const staged = await stageForms(
            supabase,
            objects,
            tenantId,
            integrationId,
            syncRunId,
            apiPath
          );
          for (const meta of staged.formMeta) {
            formMetaById.set(meta.id, { name: meta.name, fieldNames: meta.fieldNames });
          }
          counter.discovered += objects.length;
          counter.staged += staged.staged;
          counter.updated += staged.updated;
          counter.duplicates += staged.duplicates;
          counter.skipped += staged.skipped;
          counter.archived += staged.archived;
          counter.active += staged.staged - staged.archived;
          const next = page.paging?.next?.after ?? null;
          const priorIds =
            ((checkpoints[kind] as Record<string, unknown>)?.form_ids as string[]) ?? [];
          checkpoints[kind] = {
            active: next,
            phase: next ? "active" : "complete",
            form_ids: [...priorIds, ...staged.formIds],
          };
          after = next;
          phase = next ? "active" : "complete";
          counter.complete = !next;
          counter.checkpointStatus = next ? "in_progress" : "complete";
        }
        counter.distinctIds = counter.staged;
        Object.assign(counter, reconcileCounter(counter));
        await persistEngagementCheckpoint(
          supabase,
          syncRunId,
          checkpoints,
          counters,
          capabilities
        );
      }
    }
  }

  // Form submissions
  {
    const kind: HubspotEngagementKind = "form_submissions";
    const counter = counters[kind];
    if (!capabilities[kind].granted) {
      counter.checkpointStatus = "skipped_missing_scope";
      counter.reconciliationStatus = "skipped";
      await persistEngagementCheckpoint(supabase, syncRunId, checkpoints, counters, capabilities);
    } else {
      const formsCp = (checkpoints.forms ?? {}) as Record<string, unknown>;
      let formIds = Array.isArray(formsCp.form_ids) ? (formsCp.form_ids as string[]) : [];
      if (!formIds.length) {
        const { data } = await supabase
          .from("fi_external_hubspot_form_definition_staging")
          .select("hubspot_form_id")
          .eq("tenant_id", tenantId)
          .eq("integration_id", integrationId);
        formIds = (data ?? []).map((row) =>
          String((row as { hubspot_form_id: string }).hubspot_form_id)
        );
      }
      const subCp = (checkpoints[kind] ?? {}) as Record<string, unknown>;
      let startIndex = 0;
      if (typeof subCp.form_id_cursor === "string" && subCp.form_id_cursor) {
        const idx = formIds.indexOf(subCp.form_id_cursor);
        startIndex = idx >= 0 ? idx : 0;
      }
      counter.checkpointStatus = "in_progress";
      for (let i = startIndex; i < formIds.length; i += 1) {
        const formId = formIds[i]!;
        const meta = formMetaById.get(formId) ?? { name: null, fieldNames: [] as string[] };
        let after =
          i === startIndex && typeof subCp.submission_after === "string"
            ? subCp.submission_after
            : null;
        let pageDone = false;
        while (!pageDone) {
          const query: Record<string, string> = { limit: "50" };
          if (after) query.after = after;
          const page = await hubspotReadJson<{
            results?: RawObject[];
            paging?: { next?: { after?: string } };
          }>(`/form-integrations/v1/submissions/forms/${formId}`, accessToken, query);
          const objects = page.results ?? [];
          const staged = await stageSubmissions(
            supabase,
            formId,
            meta.name,
            meta.fieldNames,
            objects,
            tenantId,
            integrationId,
            syncRunId
          );
          counter.discovered += objects.length;
          counter.staged += staged.staged;
          counter.skipped += staged.skipped;
          counter.active += staged.staged;
          counter.associations += staged.associations;
          const next = page.paging?.next?.after ?? null;
          if (next) {
            after = next;
            checkpoints[kind] = {
              form_id_cursor: formId,
              submission_after: next,
              phase: "active",
            };
          } else {
            pageDone = true;
            checkpoints[kind] = {
              form_id_cursor: i + 1 < formIds.length ? formIds[i + 1] : null,
              submission_after: null,
              phase: i + 1 < formIds.length ? "active" : "complete",
            };
          }
          counter.distinctIds = counter.staged;
          counter.complete =
            (checkpoints[kind] as Record<string, unknown>).phase === "complete";
          counter.checkpointStatus = counter.complete ? "complete" : "in_progress";
          Object.assign(counter, reconcileCounter(counter));
          await persistEngagementCheckpoint(
            supabase,
            syncRunId,
            checkpoints,
            counters,
            capabilities
          );
        }
      }
      if (!formIds.length) {
        counter.complete = true;
        counter.checkpointStatus = "complete";
        checkpoints[kind] = { phase: "complete" };
        Object.assign(counter, reconcileCounter(counter));
        await persistEngagementCheckpoint(
          supabase,
          syncRunId,
          checkpoints,
          counters,
          capabilities
        );
      }
    }
  }

  // Files — metadata inventory from discovered attachment refs (+ optional listing probe IDs)
  {
    const kind: HubspotEngagementKind = "files";
    const counter = counters[kind];
    counter.checkpointStatus = "in_progress";
    // Deduplicate refs collected during this run; also accept checkpoint-discovered IDs
    const priorRefs = ((checkpoints[kind] as Record<string, unknown> | undefined)?.refs as
      | { fileId: string; sourceType: string; sourceId: string }[]
      | undefined) ?? [];
    const allRefs = [...priorRefs, ...fileRefs];
    const staged = await stageFileInventory(
      supabase,
      allRefs,
      tenantId,
      integrationId,
      syncRunId,
      accessToken,
      capabilities.files.granted
    );
    counter.discovered = allRefs.length;
    counter.staged = staged.staged;
    counter.failed = staged.failed;
    counter.attachmentReferences = staged.attachmentReferences;
    counter.associations = staged.associations;
    counter.contentBackedUp = staged.contentBackedUp;
    counter.active = staged.staged;
    counter.distinctIds = staged.staged;
    counter.complete = true;
    counter.checkpointStatus = capabilities.files.granted
      ? "complete"
      : allRefs.length
        ? "complete"
        : "skipped_missing_scope";
    if (!capabilities.files.granted && !allRefs.length) {
      counter.reconciliationStatus = "skipped";
    } else {
      Object.assign(counter, reconcileCounter(counter));
      if (counter.reconciliationStatus === "pending") {
        counter.reconciliationStatus = "exact";
      }
    }
    checkpoints[kind] = { phase: "complete", refs: allRefs.slice(0, 5000) };
    await persistEngagementCheckpoint(supabase, syncRunId, checkpoints, counters, capabilities);
  }

  return counters as Record<HubspotEngagementKind, EngagementCounter>;
}

export function isEngagementHubspotMilestone(milestone: unknown): boolean {
  const value = String(milestone ?? "").toUpperCase();
  return (
    value.includes("ENGAGEMENT-COMMUNICATIONS") ||
    value === HUBSPOT_ENGAGEMENT_MILESTONE.toUpperCase()
  );
}
