import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { hubspotReadJson } from "./hubspotBackupEngine.server";

export const HUBSPOT_SECONDARY_KINDS = ["companies", "tickets", "owners", "calls", "tasks", "meetings"] as const;
export type HubspotSecondaryKind = (typeof HUBSPOT_SECONDARY_KINDS)[number];
type Phase = "active" | "archived" | "complete";
type RawObject = {
  id?: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: boolean;
  associations?: Record<string, { results?: { id?: string; type?: string }[] }>;
  [key: string]: unknown;
};
type Page = { results?: RawObject[]; paging?: { next?: { after?: string } } };

export type SecondaryCapability = { granted: boolean; status: number | null; archivedSupported: boolean };
export type SecondaryCounter = {
  active: number; archived: number; discovered: number; staged: number; duplicates: number;
  skipped: number; failed: number; associations: number; complete: boolean;
};

const CONFIG: Record<HubspotSecondaryKind, {
  path: string; table: string; idColumn: string; singular: string; associations: string; properties: string;
}> = {
  companies: { path: "/crm/v3/objects/companies", table: "fi_external_hubspot_company_staging", idColumn: "hubspot_record_id", singular: "company", associations: "contacts,deals", properties: "name,domain,industry,hs_object_id" },
  tickets: { path: "/crm/v3/objects/tickets", table: "fi_external_hubspot_ticket_staging", idColumn: "hubspot_record_id", singular: "ticket", associations: "contacts,companies,deals", properties: "subject,content,hs_pipeline,hs_pipeline_stage,hs_ticket_priority,hs_object_id" },
  owners: { path: "/crm/v3/owners", table: "fi_external_hubspot_owner_inventory", idColumn: "hubspot_owner_id", singular: "owner", associations: "", properties: "" },
  calls: { path: "/crm/v3/objects/calls", table: "fi_external_hubspot_call_staging", idColumn: "hubspot_record_id", singular: "call", associations: "contacts,deals", properties: "hs_timestamp,hs_call_status,hs_call_direction,hs_call_duration,hubspot_owner_id,hs_object_id" },
  tasks: { path: "/crm/v3/objects/tasks", table: "fi_external_hubspot_task_staging", idColumn: "hubspot_record_id", singular: "task", associations: "contacts,deals", properties: "hs_timestamp,hs_task_status,hs_task_priority,hs_task_type,hubspot_owner_id,hs_object_id" },
  meetings: { path: "/crm/v3/objects/meetings", table: "fi_external_hubspot_meeting_staging", idColumn: "hubspot_record_id", singular: "meeting", associations: "contacts,deals", properties: "hs_timestamp,hs_meeting_start_time,hs_meeting_end_time,hs_meeting_outcome,hubspot_owner_id,hs_object_id" },
};

const blankCounter = (): SecondaryCounter => ({ active: 0, archived: 0, discovered: 0, staged: 0, duplicates: 0, skipped: 0, failed: 0, associations: 0, complete: false });
const checksum = (value: unknown): string => createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");

export function secondaryScopeFor(kind: HubspotSecondaryKind): string {
  return kind === "owners" ? "crm.objects.owners.read" : `crm.objects.${kind}.read`;
}

export async function probeHubspotSecondaryCapabilities(accessToken: string): Promise<Record<HubspotSecondaryKind, SecondaryCapability>> {
  const capabilities = {} as Record<HubspotSecondaryKind, SecondaryCapability>;
  for (const kind of HUBSPOT_SECONDARY_KINDS) {
    const config = CONFIG[kind];
    try {
      await hubspotReadJson<Page>(config.path, accessToken, { limit: "1", archived: "false" });
      let archivedSupported = true;
      try { await hubspotReadJson<Page>(config.path, accessToken, { limit: "1", archived: "true" }); }
      catch { archivedSupported = false; }
      capabilities[kind] = { granted: true, status: 200, archivedSupported };
    } catch (error) {
      const status = typeof error === "object" && error && "status" in error ? Number((error as { status: unknown }).status) : null;
      capabilities[kind] = { granted: false, status: Number.isFinite(status) ? status : null, archivedSupported: false };
    }
  }
  return capabilities;
}

function checkpointFor(checkpoints: Record<string, unknown>, kind: HubspotSecondaryKind): { phase: Phase; after: string | null } {
  const raw = (checkpoints[kind] ?? {}) as Record<string, unknown>;
  const phase: Phase = raw.phase === "archived" || raw.phase === "complete" ? raw.phase : "active";
  const cursor = phase === "archived" ? raw.archived : raw.active;
  return { phase, after: typeof cursor === "string" && cursor ? cursor : null };
}

function associationRows(objects: RawObject[], kind: HubspotSecondaryKind, tenantId: string, integrationId: string, syncRunId: string) {
  if (kind === "owners") return [];
  const unique = new Map<string, Record<string, unknown>>();
  for (const object of objects) {
    const fromId = object.id?.trim();
    if (!fromId) continue;
    for (const [plural, group] of Object.entries(object.associations ?? {})) {
      const toType = plural === "companies" ? "company" : plural === "deals" ? "deal" : "contact";
      for (const association of group.results ?? []) {
        const toId = association.id?.trim();
        if (!toId) continue;
        const key = [tenantId, integrationId, CONFIG[kind].singular, fromId, toType, toId].join("|");
        const prior = unique.get(key);
        const types = new Set<string>(prior ? prior.association_types as string[] : []);
        if (association.type) types.add(association.type);
        unique.set(key, { tenant_id: tenantId, integration_id: integrationId, sync_run_id: syncRunId,
          from_object_type: CONFIG[kind].singular, from_hubspot_id: fromId, to_object_type: toType,
          to_hubspot_id: toId, association_types: [...types], updated_at: new Date().toISOString() });
      }
    }
  }
  return [...unique.values()];
}

async function stagePage(supabase: SupabaseClient, kind: HubspotSecondaryKind, objects: RawObject[], tenantId: string, integrationId: string, syncRunId: string) {
  const config = CONFIG[kind];
  const valid = objects.filter((row) => Boolean(row.id?.trim()));
  const ids = valid.map((row) => row.id!.trim());
  const { data, error: selectError } = ids.length ? await supabase.from(config.table).select(config.idColumn)
    .eq("tenant_id", tenantId).eq("integration_id", integrationId).in(config.idColumn, ids) : { data: [], error: null };
  if (selectError) throw new Error(`Unable to check existing HubSpot ${kind} IDs.`);
  const existing = new Set((data ?? []).map((row) => String(((row as unknown) as Record<string, unknown>)[config.idColumn])));
  const now = new Date().toISOString();
  const rows = valid.map((raw) => ({ tenant_id: tenantId, integration_id: integrationId, sync_run_id: syncRunId,
    [config.idColumn]: raw.id!.trim(), hubspot_created_at: raw.createdAt ?? null, hubspot_updated_at: raw.updatedAt ?? null,
    archived: Boolean(raw.archived), raw_payload: raw, payload_checksum: checksum(raw), updated_at: now }));
  if (rows.length) {
    const { error } = await supabase.from(config.table).upsert(rows, { onConflict: `tenant_id,integration_id,${config.idColumn}` });
    if (error) throw new Error(`Unable to stage HubSpot ${kind} page.`);
  }
  const associations = associationRows(valid, kind, tenantId, integrationId, syncRunId);
  if (associations.length) {
    const { error } = await supabase.from("fi_external_hubspot_association_staging").upsert(associations, {
      onConflict: "tenant_id,integration_id,from_object_type,from_hubspot_id,to_object_type,to_hubspot_id",
    });
    if (error) throw new Error(`Unable to stage HubSpot ${kind} associations.`);
  }
  return { staged: rows.length, duplicates: ids.filter((id) => existing.has(id)).length,
    skipped: objects.length - valid.length, archived: valid.filter((row) => row.archived).length, associations: associations.length };
}

export async function runHubspotSecondaryBackup(params: {
  supabase: SupabaseClient; accessToken: string; integrationId: string; tenantId: string;
  syncRun: Record<string, unknown>; capabilities: Record<HubspotSecondaryKind, SecondaryCapability>;
}): Promise<Record<HubspotSecondaryKind, SecondaryCounter>> {
  const { supabase, accessToken, integrationId, tenantId, syncRun, capabilities } = params;
  const checkpoints = (syncRun.secondary_checkpoints ?? {}) as Record<string, unknown>;
  const counters = (syncRun.secondary_counters ?? {}) as Record<string, SecondaryCounter>;
  for (const kind of HUBSPOT_SECONDARY_KINDS) {
    counters[kind] = { ...blankCounter(), ...(counters[kind] ?? {}) };
    if (!capabilities[kind].granted) continue;
    let checkpoint = checkpointFor(checkpoints, kind);
    while (checkpoint.phase !== "complete") {
      const archived = checkpoint.phase === "archived";
      if (archived && !capabilities[kind].archivedSupported) {
        checkpoint = { phase: "complete", after: null };
        checkpoints[kind] = { ...(checkpoints[kind] as object ?? {}), phase: "complete", archived: null };
        counters[kind].complete = true;
      } else {
        const config = CONFIG[kind];
        const query: Record<string, string> = { limit: "100", archived: String(archived) };
        if (checkpoint.after) query.after = checkpoint.after;
        if (config.associations) query.associations = config.associations;
        if (config.properties) query.properties = config.properties;
        const page = await hubspotReadJson<Page>(config.path, accessToken, query);
        const objects = page.results ?? [];
        const staged = await stagePage(supabase, kind, objects, tenantId, integrationId, String(syncRun.id));
        const counter = counters[kind];
        counter.discovered += objects.length; counter.staged += staged.staged; counter.duplicates += staged.duplicates;
        counter.skipped += staged.skipped; counter.archived += staged.archived; counter.active += objects.length - staged.archived;
        counter.associations += staged.associations;
        const next = page.paging?.next?.after ?? null;
        const nextPhase: Phase = next ? checkpoint.phase : archived || !capabilities[kind].archivedSupported ? "complete" : "archived";
        checkpoints[kind] = { active: checkpoint.phase === "active" ? next : (checkpoints[kind] as Record<string, unknown>)?.active ?? null,
          archived: checkpoint.phase === "archived" ? next : null, phase: nextPhase };
        counter.complete = nextPhase === "complete";
        checkpoint = { phase: nextPhase, after: next };
      }
      const { error } = await supabase.from("fi_external_hubspot_sync_runs").update({ secondary_checkpoints: checkpoints,
        secondary_counters: counters, secondary_capabilities: capabilities, last_checkpoint_at: new Date().toISOString() }).eq("id", syncRun.id);
      if (error) throw new Error("Unable to persist HubSpot secondary checkpoint.");
    }
  }
  return counters as Record<HubspotSecondaryKind, SecondaryCounter>;
}
