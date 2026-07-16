import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeHubspotContact, normalizeHubspotDeal } from "./hubspotConnectorCore";
import type { HubspotApiContact, HubspotApiDeal } from "./hubspotConnectorTypes";

const API_BASE = "https://api.hubapi.com";
const PAGE_SIZE = 100;
const MAX_RETRIES = 4;

type ObjectKind = "contacts" | "deals";
type Phase = "active" | "archived" | "complete";
type AssociationResult = { id?: string; type?: string };
type HubspotObject = (HubspotApiContact | HubspotApiDeal) & {
  archived?: boolean;
  associations?: Record<string, { results?: AssociationResult[] }>;
};
type Page = { results?: HubspotObject[]; paging?: { next?: { after?: string } } };

export type HubspotBackupCounters = {
  contactsDiscovered: number;
  contactsStaged: number;
  contactsArchived: number;
  contactsDuplicates: number;
  contactsSkipped: number;
  contactsFailed: number;
  dealsDiscovered: number;
  dealsStaged: number;
  dealsArchived: number;
  dealsDuplicates: number;
  dealsSkipped: number;
  dealsFailed: number;
  associationCount: number;
};

export class HubspotReadError extends Error {
  constructor(
    public readonly status: number,
    public readonly category: "auth" | "permission" | "rate_limit" | "provider" | "network",
    message: string,
    public readonly retryAfterSeconds: number | null = null
  ) {
    super(message);
    this.name = "HubspotReadError";
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checksum(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function safeProviderError(status: number): HubspotReadError {
  if (status === 401) return new HubspotReadError(status, "auth", "HubSpot rejected the credential.");
  if (status === 403)
    return new HubspotReadError(status, "permission", "HubSpot denied the required read capability.");
  return new HubspotReadError(status, "provider", `HubSpot read request failed with status ${status}.`);
}

export async function hubspotReadJson<T>(
  path: string,
  accessToken: string,
  params: Record<string, string> = {},
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        cache: "no-store",
      });
    } catch {
      if (attempt === MAX_RETRIES) {
        throw new HubspotReadError(0, "network", "HubSpot read request failed after bounded retries.");
      }
      await wait(Math.min(8000, 250 * 2 ** attempt));
      continue;
    }

    if (response.ok) return (await response.json()) as T;
    if (response.status === 429 || response.status >= 500) {
      const rawRetryAfter = response.headers.get("retry-after");
      const retryAfter = rawRetryAfter ? Number.parseInt(rawRetryAfter, 10) : Number.NaN;
      const seconds = Number.isFinite(retryAfter) ? Math.max(0, Math.min(retryAfter, 60)) : null;
      if (attempt === MAX_RETRIES) {
        throw new HubspotReadError(
          response.status,
          response.status === 429 ? "rate_limit" : "provider",
          `HubSpot read request exhausted ${MAX_RETRIES + 1} attempts.`,
          seconds
        );
      }
      await wait((seconds ?? Math.min(8, 2 ** attempt)) * 1000);
      continue;
    }
    throw safeProviderError(response.status);
  }
  throw new HubspotReadError(0, "network", "HubSpot read request did not complete.");
}

/** POST JSON helper for HubSpot CRM Search (and similar read-style POSTs). */
export async function hubspotPostJson<T>(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch
): Promise<T> {
  const url = `${API_BASE}${path}`;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    let response: Response;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      });
    } catch {
      if (attempt === MAX_RETRIES) {
        throw new HubspotReadError(0, "network", "HubSpot post request failed after bounded retries.");
      }
      await wait(Math.min(8000, 250 * 2 ** attempt));
      continue;
    }

    if (response.ok) return (await response.json()) as T;
    if (response.status === 429 || response.status >= 500) {
      const rawRetryAfter = response.headers.get("retry-after");
      const retryAfter = rawRetryAfter ? Number.parseInt(rawRetryAfter, 10) : Number.NaN;
      const seconds = Number.isFinite(retryAfter) ? Math.max(0, Math.min(retryAfter, 60)) : null;
      if (attempt === MAX_RETRIES) {
        throw new HubspotReadError(
          response.status,
          response.status === 429 ? "rate_limit" : "provider",
          `HubSpot post request exhausted ${MAX_RETRIES + 1} attempts.`,
          seconds
        );
      }
      await wait((seconds ?? Math.min(8, 2 ** attempt)) * 1000);
      continue;
    }
    throw safeProviderError(response.status);
  }
  throw new HubspotReadError(0, "network", "HubSpot post request did not complete.");
}

function checkpointFor(row: Record<string, unknown>, kind: ObjectKind): { phase: Phase; after: string | null } {
  const raw = (row[`${kind}_checkpoint`] ?? {}) as Record<string, unknown>;
  const phase = raw.phase === "archived" || raw.phase === "complete" ? raw.phase : "active";
  const cursor = phase === "archived" ? raw.archived : raw.active;
  return { phase, after: typeof cursor === "string" && cursor ? cursor : null };
}

function associationRows(
  objects: HubspotObject[],
  kind: ObjectKind,
  tenantId: string,
  integrationId: string,
  syncRunId: string
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = [];
  const fromType = kind === "contacts" ? "contact" : "deal";
  for (const object of objects) {
    const fromId = object.id?.trim();
    if (!fromId) continue;
    for (const [plural, group] of Object.entries(object.associations ?? {})) {
      const toType = plural === "companies" ? "company" : plural === "contacts" ? "contact" : "deal";
      for (const association of group.results ?? []) {
        if (!association.id?.trim()) continue;
        rows.push({
          tenant_id: tenantId,
          integration_id: integrationId,
          sync_run_id: syncRunId,
          from_object_type: fromType,
          from_hubspot_id: fromId,
          to_object_type: toType,
          to_hubspot_id: association.id.trim(),
          association_types: association.type ? [association.type] : [],
          updated_at: new Date().toISOString(),
        });
      }
    }
  }
  const unique = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    const key = [row.tenant_id, row.integration_id, row.from_object_type, row.from_hubspot_id, row.to_object_type, row.to_hubspot_id].join("|");
    const previous = unique.get(key);
    if (!previous) {
      unique.set(key, row);
      continue;
    }
    const types = new Set([...(previous.association_types as string[]), ...(row.association_types as string[])]);
    previous.association_types = [...types];
  }
  return [...unique.values()];
}

async function existingIds(
  supabase: SupabaseClient,
  kind: ObjectKind,
  tenantId: string,
  integrationId: string,
  ids: string[]
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const table = kind === "contacts" ? "fi_external_hubspot_contact_staging" : "fi_external_hubspot_deal_staging";
  const column = kind === "contacts" ? "hubspot_contact_id" : "hubspot_deal_id";
  const { data, error } = await supabase
    .from(table)
    .select(column)
    .eq("tenant_id", tenantId)
    .eq("integration_id", integrationId)
    .in(column, ids);
  if (error) throw new Error(`Unable to check existing ${kind} staging IDs.`);
  return new Set((data ?? []).map((row) => String((row as Record<string, unknown>)[column])));
}

async function stagePage(params: {
  supabase: SupabaseClient;
  kind: ObjectKind;
  objects: HubspotObject[];
  tenantId: string;
  integrationId: string;
  syncRunId: string;
  pipelineNames: Record<string, string>;
}): Promise<{ staged: number; duplicates: number; skipped: number; failed: number; archived: number; associations: number }> {
  const { supabase, kind, objects, tenantId, integrationId, syncRunId, pipelineNames } = params;
  const ids = objects.map((row) => row.id?.trim()).filter((id): id is string => Boolean(id));
  const existing = await existingIds(supabase, kind, tenantId, integrationId, ids);
  const rows: Record<string, unknown>[] = [];
  let skipped = 0;
  let failed = 0;

  for (const raw of objects) {
    try {
      if (kind === "contacts") {
        const normalized = normalizeHubspotContact(raw as HubspotApiContact, {
          existingEmails: [],
          existingPhones: [],
        });
        if (!normalized) {
          skipped += 1;
          continue;
        }
        rows.push({
          tenant_id: tenantId,
          integration_id: integrationId,
          sync_run_id: syncRunId,
          hubspot_contact_id: normalized.hubspotContactId,
          email: normalized.email,
          phone: normalized.phone,
          lead_source: normalized.leadSource,
          duplicate_risk: normalized.duplicateRisk,
          normalized_lead_type: normalized.normalizedLeadType,
          raw_payload: raw,
          hubspot_created_at: raw.createdAt ?? null,
          hubspot_updated_at: raw.updatedAt ?? null,
          archived: Boolean(raw.archived),
          payload_checksum: checksum(raw),
        });
      } else {
        const pipelineId = raw.properties?.pipeline ?? null;
        const normalized = normalizeHubspotDeal(raw as HubspotApiDeal, {
          pipelineName: pipelineId ? pipelineNames[String(pipelineId)] ?? String(pipelineId) : null,
          existingDealIds: [],
          existingEmails: [],
        });
        if (!normalized) {
          skipped += 1;
          continue;
        }
        rows.push({
          tenant_id: tenantId,
          integration_id: integrationId,
          sync_run_id: syncRunId,
          hubspot_deal_id: normalized.hubspotDealId,
          hubspot_contact_id: normalized.hubspotContactId,
          email: normalized.email,
          phone: normalized.phone,
          lead_source: normalized.leadSource,
          pipeline_name: normalized.pipelineName,
          deal_stage: normalized.dealStage,
          duplicate_risk: normalized.duplicateRisk,
          normalized_lead_type: normalized.normalizedLeadType,
          raw_payload: raw,
          hubspot_created_at: raw.createdAt ?? null,
          hubspot_updated_at: raw.updatedAt ?? null,
          archived: Boolean(raw.archived),
          payload_checksum: checksum(raw),
        });
      }
    } catch {
      failed += 1;
    }
  }

  if (rows.length > 0) {
    const table = kind === "contacts" ? "fi_external_hubspot_contact_staging" : "fi_external_hubspot_deal_staging";
    const conflict = kind === "contacts"
      ? "tenant_id,integration_id,hubspot_contact_id"
      : "tenant_id,integration_id,hubspot_deal_id";
    const { error } = await supabase.from(table).upsert(rows, { onConflict: conflict });
    if (error) throw new Error(`Unable to stage HubSpot ${kind} page.`);
  }

  const associations = associationRows(objects, kind, tenantId, integrationId, syncRunId);
  if (associations.length > 0) {
    const { error } = await supabase.from("fi_external_hubspot_association_staging").upsert(associations, {
      onConflict: "tenant_id,integration_id,from_object_type,from_hubspot_id,to_object_type,to_hubspot_id",
    });
    if (error) throw new Error(`Unable to stage HubSpot ${kind} associations.`);
  }

  return {
    staged: rows.length,
    duplicates: ids.filter((id) => existing.has(id)).length,
    skipped,
    failed,
    archived: objects.filter((row) => Boolean(row.archived)).length,
    associations: associations.length,
  };
}

export async function runHubspotObjectBackup(params: {
  supabase: SupabaseClient;
  accessToken: string;
  integrationId: string;
  tenantId: string;
  syncRun: Record<string, unknown>;
  pipelineNames: Record<string, string>;
}): Promise<HubspotBackupCounters> {
  const { supabase, accessToken, integrationId, tenantId, syncRun, pipelineNames } = params;
  const counters: HubspotBackupCounters = {
    contactsDiscovered: Number(syncRun.contacts_discovered ?? 0), contactsStaged: Number(syncRun.contacts_staged ?? 0),
    contactsArchived: Number(syncRun.contacts_archived ?? 0), contactsDuplicates: Number(syncRun.contacts_duplicates ?? 0),
    contactsSkipped: Number(syncRun.contacts_skipped ?? 0), contactsFailed: Number(syncRun.contacts_failed ?? 0),
    dealsDiscovered: Number(syncRun.deals_discovered ?? 0), dealsStaged: Number(syncRun.deals_staged ?? 0),
    dealsArchived: Number(syncRun.deals_archived ?? 0), dealsDuplicates: Number(syncRun.deals_duplicates ?? 0),
    dealsSkipped: Number(syncRun.deals_skipped ?? 0), dealsFailed: Number(syncRun.deals_failed ?? 0),
    associationCount: Number(syncRun.association_count ?? 0),
  };

  for (const kind of ["contacts", "deals"] as const) {
    let checkpoint = checkpointFor(syncRun, kind);
    while (checkpoint.phase !== "complete") {
      const archived = checkpoint.phase === "archived";
      const associations = kind === "contacts" ? "deals,companies" : "contacts,companies";
      const properties = kind === "contacts"
        ? "firstname,lastname,email,phone,mobilephone,hs_lead_status,lead_source,hs_analytics_source,lifecyclestage,contact_type,stage_of_journey"
        : "dealname,dealstage,pipeline,hs_analytics_source,lead_source,amount";
      const query: Record<string, string> = {
        limit: String(PAGE_SIZE), properties, associations, archived: String(archived),
      };
      if (checkpoint.after) query.after = checkpoint.after;
      const page = await hubspotReadJson<Page>(`/crm/v3/objects/${kind}`, accessToken, query);
      const objects = page.results ?? [];
      const result = await stagePage({ supabase, kind, objects, tenantId, integrationId, syncRunId: String(syncRun.id), pipelineNames });
      const prefix = kind === "contacts" ? "contacts" : "deals";
      counters[`${prefix}Discovered`] += objects.length;
      counters[`${prefix}Staged`] += result.staged;
      counters[`${prefix}Archived`] += result.archived;
      counters[`${prefix}Duplicates`] += result.duplicates;
      counters[`${prefix}Skipped`] += result.skipped;
      counters[`${prefix}Failed`] += result.failed;
      counters.associationCount += result.associations;

      const next = page.paging?.next?.after ?? null;
      const nextPhase: Phase = next ? checkpoint.phase : archived ? "complete" : "archived";
      const nextCheckpoint = {
        active: checkpoint.phase === "active" ? next : ((syncRun[`${kind}_checkpoint`] as Record<string, unknown>)?.active ?? null),
        archived: checkpoint.phase === "archived" ? next : null,
        phase: nextPhase,
      };
      const patch: Record<string, unknown> = {
        [`${kind}_checkpoint`]: nextCheckpoint,
        [`${kind}_complete`]: nextPhase === "complete",
        contacts_discovered: counters.contactsDiscovered, contacts_staged: counters.contactsStaged,
        contacts_archived: counters.contactsArchived, contacts_duplicates: counters.contactsDuplicates,
        contacts_skipped: counters.contactsSkipped, contacts_failed: counters.contactsFailed,
        deals_discovered: counters.dealsDiscovered, deals_staged: counters.dealsStaged,
        deals_archived: counters.dealsArchived, deals_duplicates: counters.dealsDuplicates,
        deals_skipped: counters.dealsSkipped, deals_failed: counters.dealsFailed,
        association_count: counters.associationCount, last_checkpoint_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("fi_external_hubspot_sync_runs").update(patch).eq("id", syncRun.id);
      if (error) throw new Error("Unable to persist HubSpot sync checkpoint.");
      syncRun[`${kind}_checkpoint`] = nextCheckpoint;
      checkpoint = { phase: nextPhase, after: next };
    }
  }
  return counters;
}
