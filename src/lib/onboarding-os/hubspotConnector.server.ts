import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import { createConnectorSyncEvent } from "./externalConnector.server";
import {
  decryptExternalConnectorSecret,
  deriveExternalConnectorMasterKey,
} from "./externalConnectorSecretCrypto.server";
import {
  calculateHubspotSyncHealth,
  coerceHubspotLeadType,
  coerceHubspotSyncRunStatus,
  detectDuplicateHubspotContact,
  detectDuplicateHubspotDeal,
  normalizeHubspotContact,
  normalizeHubspotDeal,
  resolveHubspotImportStatus,
} from "./hubspotConnectorCore";
import type {
  HubspotApiContact,
  HubspotApiDeal,
  HubspotApiPipeline,
  HubspotConnectorSnapshot,
  HubspotImportAuditAction,
  HubspotStagingContact,
  HubspotStagingDeal,
  HubspotSyncRun,
} from "./hubspotConnectorTypes";
import { isHubspotImportStatus, isHubspotSyncRunStatus } from "./hubspotConnectorTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
  /** Test hook — inject contacts/deals instead of calling HubSpot API. */
  fetchHubspotOverride?: (accessToken: string) => Promise<{
    contacts: HubspotApiContact[];
    deals: HubspotApiDeal[];
    pipelines: HubspotApiPipeline[];
  }>;
};

type ContactStagingRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  sync_run_id: string | null;
  hubspot_contact_id: string;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  duplicate_risk: boolean;
  normalized_lead_type: string;
  raw_payload: Record<string, unknown>;
  import_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type DealStagingRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  sync_run_id: string | null;
  hubspot_deal_id: string;
  hubspot_contact_id: string | null;
  email: string | null;
  phone: string | null;
  lead_source: string | null;
  pipeline_name: string | null;
  deal_stage: string | null;
  duplicate_risk: boolean;
  normalized_lead_type: string;
  raw_payload: Record<string, unknown>;
  import_status: string;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
};

type SyncRunRow = {
  id: string;
  integration_id: string;
  tenant_id: string;
  status: string;
  contacts_discovered: number;
  contacts_staged: number;
  contacts_skipped: number;
  deals_discovered: number;
  deals_staged: number;
  deals_skipped: number;
  duplicate_risks_detected: number;
  health_score: number;
  detail: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
  config: Record<string, unknown>;
  status: string;
};

type AuthSessionRow = {
  auth_status: string;
};

const HUBSPOT_API_BASE = "https://api.hubapi.com";
const HUBSPOT_CONTACT_PROPERTIES = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "mobilephone",
  "hs_lead_status",
  "lead_source",
  "hs_analytics_source",
  "lifecyclestage",
  "contact_type",
  "stage_of_journey",
].join(",");
const HUBSPOT_DEAL_PROPERTIES = [
  "dealname",
  "dealstage",
  "pipeline",
  "hs_analytics_source",
  "lead_source",
  "amount",
].join(",");

export type HubspotActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

export type RunHubspotSyncResult =
  | { ok: true; syncRun: HubspotSyncRun; snapshot: HubspotConnectorSnapshot }
  | { ok: false; error: string };

function resolveMasterKey(): Buffer | null {
  return deriveExternalConnectorMasterKey(process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY);
}

async function resolvePlatformAdminAuth(
  opts: ServerOpts
): Promise<{ ok: true; actorAuthUserId: string } | { ok: false; error: string }> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };
  if (opts.skipAuthCheck && opts.actorAuthUserId) {
    return { ok: true, actorAuthUserId: authId };
  }
  const os = await loadFiOsIdentity(authId);
  if (!isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    return { ok: false, error: "Platform administrator access is required." };
  }
  return { ok: true, actorAuthUserId: authId };
}

async function resolveTenantAdminAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string; actorLabel: string }
  | { ok: false; error: string }
> {
  const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
  if (!authId) return { ok: false, error: "Authentication required." };

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) {
    if (opts.skipAuthCheck) {
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_users")
    .select("id, email")
    .eq("tenant_id", tenantId.trim())
    .eq("auth_user_id", authId)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Tenant membership required." };

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  if (adminProf?.adminRole !== "clinic_admin" && adminProf?.adminRole !== "operations_admin") {
    if (!opts.skipAuthCheck) {
      const platform = await resolvePlatformAdminAuth(opts);
      if (!platform.ok) return { ok: false, error: "Tenant admin access is required." };
      return { ok: true, actorAuthUserId: authId, fiUserId: "", actorLabel: "Platform admin" };
    }
    return { ok: false, error: "Tenant admin access is required." };
  }

  const row = data as { id: string; email: string | null };
  return {
    ok: true,
    actorAuthUserId: authId,
    fiUserId: String(row.id),
    actorLabel: row.email ?? "Tenant admin",
  };
}

async function resolveWriteAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<
  | { ok: true; actorAuthUserId: string; fiUserId: string | null; actorLabel: string }
  | { ok: false; error: string }
> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) {
    return {
      ok: true,
      actorAuthUserId: platform.actorAuthUserId,
      fiUserId: null,
      actorLabel: "Platform admin",
    };
  }
  const tenant = await resolveTenantAdminAuth(tenantId, opts);
  if (!tenant.ok) return tenant;
  return {
    ok: true,
    actorAuthUserId: tenant.actorAuthUserId,
    fiUserId: tenant.fiUserId || null,
    actorLabel: tenant.actorLabel,
  };
}

async function resolveReadAuth(
  tenantId: string,
  opts: ServerOpts
): Promise<{ ok: true } | { ok: false; error: string }> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (platform.ok) return { ok: true };

  if (opts.allowTenantMemberRead) {
    const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
    if (!authId) return { ok: false, error: "Authentication required." };
    const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
    const { data: member } = await supabase
      .from("fi_users")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("auth_user_id", authId)
      .maybeSingle();
    if (member) return { ok: true };
  }

  const tenant = await resolveTenantAdminAuth(tenantId, { ...opts, skipAuthCheck: true });
  if (tenant.ok) return { ok: true };
  return { ok: false, error: "Access denied." };
}

function mapContactStagingRow(row: ContactStagingRow): HubspotStagingContact {
  const importStatus = isHubspotImportStatus(row.import_status) ? row.import_status : "staged";
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    syncRunId: row.sync_run_id,
    hubspotContactId: row.hubspot_contact_id,
    email: row.email,
    phone: row.phone,
    leadSource: row.lead_source,
    duplicateRisk: Boolean(row.duplicate_risk),
    normalizedLeadType: coerceHubspotLeadType(row.normalized_lead_type),
    rawPayload: row.raw_payload ?? {},
    importStatus,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDealStagingRow(row: DealStagingRow): HubspotStagingDeal {
  const importStatus = isHubspotImportStatus(row.import_status) ? row.import_status : "staged";
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    syncRunId: row.sync_run_id,
    hubspotDealId: row.hubspot_deal_id,
    hubspotContactId: row.hubspot_contact_id,
    email: row.email,
    phone: row.phone,
    leadSource: row.lead_source,
    pipelineName: row.pipeline_name,
    dealStage: row.deal_stage,
    duplicateRisk: Boolean(row.duplicate_risk),
    normalizedLeadType: coerceHubspotLeadType(row.normalized_lead_type),
    rawPayload: row.raw_payload ?? {},
    importStatus,
    importedAt: row.imported_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSyncRunRow(row: SyncRunRow): HubspotSyncRun {
  const status = isHubspotSyncRunStatus(row.status)
    ? row.status
    : coerceHubspotSyncRunStatus(row.status);
  return {
    id: row.id,
    integrationId: row.integration_id,
    tenantId: row.tenant_id,
    status,
    contactsDiscovered: row.contacts_discovered,
    contactsStaged: row.contacts_staged,
    contactsSkipped: row.contacts_skipped,
    dealsDiscovered: row.deals_discovered,
    dealsStaged: row.deals_staged,
    dealsSkipped: row.deals_skipped,
    duplicateRisksDetected: row.duplicate_risks_detected,
    healthScore: row.health_score,
    detail: row.detail ?? {},
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  };
}

function parseAccessTokenFromCredentialPayload(serialized: string): string | null {
  try {
    const parsed = JSON.parse(serialized) as { secret?: string; kind?: string };
    const secret = parsed.secret?.trim();
    if (!secret) return null;

    if (secret.startsWith("{")) {
      const tokenObj = JSON.parse(secret) as { access_token?: string; accessToken?: string };
      return tokenObj.access_token?.trim() || tokenObj.accessToken?.trim() || null;
    }
    return secret;
  } catch {
    return null;
  }
}

async function loadHubspotAccessToken(
  supabase: SupabaseClient,
  integrationId: string
): Promise<string | null> {
  const masterKey = resolveMasterKey();
  if (!masterKey) return null;

  const { data } = await supabase
    .from("fi_external_connector_credentials")
    .select("credentials_encrypted, credential_kind")
    .eq("integration_id", integrationId)
    .in("credential_kind", ["oauth_tokens", "api_key"])
    .order("credential_kind", { ascending: true })
    .limit(2);

  for (const row of (data ?? []) as { credentials_encrypted: string }[]) {
    try {
      const decrypted = decryptExternalConnectorSecret(row.credentials_encrypted, masterKey);
      const token = parseAccessTokenFromCredentialPayload(decrypted);
      if (token) return token;
    } catch {
      continue;
    }
  }
  return null;
}

async function loadAuthVerified(supabase: SupabaseClient, integrationId: string): Promise<boolean> {
  const { data } = await supabase
    .from("fi_external_connector_auth_sessions")
    .select("auth_status")
    .eq("integration_id", integrationId)
    .maybeSingle();
  const row = data as AuthSessionRow | null;
  return row?.auth_status === "verified";
}

async function loadIntegration(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<IntegrationRow | null> {
  const { data, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("id, tenant_id, provider, config, status")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as IntegrationRow | null) ?? null;
}

async function hubspotGet<T>(
  path: string,
  accessToken: string,
  params?: Record<string, string>
): Promise<T> {
  const url = new URL(`${HUBSPOT_API_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HubSpot API error (${res.status}): ${body.slice(0, 300)}`);
  }

  return (await res.json()) as T;
}

async function fetchAllHubspotObjects<T extends { id?: string }>(
  path: string,
  accessToken: string,
  params: Record<string, string>,
  maxPages = 5
): Promise<T[]> {
  const results: T[] = [];
  let after: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const query: Record<string, string> = { ...params, limit: "100" };
    if (after) query.after = after;

    const json = await hubspotGet<{ results?: T[]; paging?: { next?: { after?: string } } }>(
      path,
      accessToken,
      query
    );
    results.push(...(json.results ?? []));
    after = json.paging?.next?.after;
    if (!after) break;
  }

  return results;
}

/** Read-only HubSpot contacts list (GET only — never writes to HubSpot). */
export async function fetchHubspotContactsReadOnly(
  accessToken: string
): Promise<HubspotApiContact[]> {
  return fetchAllHubspotObjects<HubspotApiContact>("/crm/v3/objects/contacts", accessToken, {
    properties: HUBSPOT_CONTACT_PROPERTIES,
  });
}

/** Read-only HubSpot deals list (GET only — never writes to HubSpot). */
export async function fetchHubspotDealsReadOnly(accessToken: string): Promise<HubspotApiDeal[]> {
  return fetchAllHubspotObjects<HubspotApiDeal>("/crm/v3/objects/deals", accessToken, {
    properties: HUBSPOT_DEAL_PROPERTIES,
  });
}

/** Read-only HubSpot deal pipelines (GET only). */
export async function fetchHubspotPipelinesReadOnly(
  accessToken: string
): Promise<HubspotApiPipeline[]> {
  const json = await hubspotGet<{ results?: HubspotApiPipeline[] }>(
    "/crm/v3/pipelines/deals",
    accessToken
  );
  return json.results ?? [];
}

function buildPipelineNameMap(pipelines: HubspotApiPipeline[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const pipeline of pipelines) {
    if (pipeline.id) {
      map[pipeline.id] = pipeline.label?.trim() || pipeline.id;
    }
    for (const stage of pipeline.stages ?? []) {
      if (stage.id) {
        map[stage.id] = stage.label?.trim() || stage.id;
      }
    }
  }
  return map;
}

async function appendHubspotImportAudit(
  supabase: SupabaseClient,
  entry: {
    integrationId: string;
    tenantId: string;
    stagingContactId?: string | null;
    stagingDealId?: string | null;
    syncRunId?: string | null;
    action: HubspotImportAuditAction;
    actorAuthUserId?: string | null;
    actorFiUserId?: string | null;
    actorLabel?: string | null;
    detail?: Record<string, unknown>;
  }
): Promise<void> {
  await supabase.from("fi_external_hubspot_import_audit").insert({
    integration_id: entry.integrationId,
    tenant_id: entry.tenantId,
    staging_contact_id: entry.stagingContactId ?? null,
    staging_deal_id: entry.stagingDealId ?? null,
    sync_run_id: entry.syncRunId ?? null,
    action: entry.action,
    actor_auth_user_id: entry.actorAuthUserId ?? null,
    actor_fi_user_id: entry.actorFiUserId ?? null,
    actor_label: entry.actorLabel ?? null,
    detail: entry.detail ?? {},
  });
}

async function upsertPipelineMappings(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string,
  pipelines: HubspotApiPipeline[]
): Promise<void> {
  for (const pipeline of pipelines) {
    if (!pipeline.id) continue;
    await supabase.from("fi_external_hubspot_pipeline_mappings").upsert(
      {
        integration_id: integrationId,
        tenant_id: tenantId,
        hubspot_pipeline_id: pipeline.id,
        pipeline_name: pipeline.label?.trim() || pipeline.id,
        mapping_status: "pending",
        detail: { read_only_staging: true, fi_pipeline_id: null },
      },
      { onConflict: "integration_id,hubspot_pipeline_id" }
    );
  }
}

async function loadExistingContactStaging(
  supabase: SupabaseClient,
  integrationId: string
): Promise<HubspotStagingContact[]> {
  const { data } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("*")
    .eq("integration_id", integrationId);

  return ((data ?? []) as ContactStagingRow[]).map(mapContactStagingRow);
}

async function loadExistingDealStaging(
  supabase: SupabaseClient,
  integrationId: string
): Promise<HubspotStagingDeal[]> {
  const { data } = await supabase
    .from("fi_external_hubspot_deal_staging")
    .select("*")
    .eq("integration_id", integrationId);

  return ((data ?? []) as DealStagingRow[]).map(mapDealStagingRow);
}

/** Run read-only HubSpot sync into staging tables. Never writes to HubSpot. */
export async function runHubspotSync(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<RunHubspotSyncResult> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };
  if (integration.provider !== "hubspot") {
    return { ok: false, error: "Integration is not a HubSpot connector." };
  }

  const authVerified = await loadAuthVerified(supabase, integrationId);
  if (!authVerified) {
    return { ok: false, error: "Verify HubSpot credentials before syncing." };
  }

  const accessToken = await loadHubspotAccessToken(supabase, integrationId);
  if (!accessToken && !opts.fetchHubspotOverride) {
    return {
      ok: false,
      error: "OAuth access token not available — store connector credentials first.",
    };
  }

  const now = new Date().toISOString();
  const { data: syncRunInserted, error: syncRunErr } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .insert({
      integration_id: integrationId,
      tenant_id: tenantId,
      status: "started",
      detail: { read_only: true, provider: "hubspot" },
      started_at: now,
    })
    .select("*")
    .single();

  if (syncRunErr || !syncRunInserted) {
    return { ok: false, error: syncRunErr?.message ?? "Failed to start sync run." };
  }

  const syncRunRow = syncRunInserted as SyncRunRow;

  await appendHubspotImportAudit(supabase, {
    integrationId,
    tenantId,
    syncRunId: syncRunRow.id,
    action: "sync_started",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: { read_only: true },
  });

  await createConnectorSyncEvent(
    integrationId,
    tenantId,
    {
      eventKind: "sync_started",
      status: "info",
      detail: { provider: "hubspot", read_only: true },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  let discoveredContacts: HubspotApiContact[] = [];
  let discoveredDeals: HubspotApiDeal[] = [];
  let pipelines: HubspotApiPipeline[] = [];
  let contactsStaged = 0;
  let contactsSkipped = 0;
  let dealsStaged = 0;
  let dealsSkipped = 0;
  let duplicateRisksDetected = 0;
  let syncStatus: HubspotSyncRun["status"] = "completed";
  let syncError: string | null = null;

  try {
    if (opts.fetchHubspotOverride) {
      const fetched = await opts.fetchHubspotOverride(accessToken ?? "");
      discoveredContacts = fetched.contacts;
      discoveredDeals = fetched.deals;
      pipelines = fetched.pipelines;
    } else {
      discoveredContacts = await fetchHubspotContactsReadOnly(accessToken!);
      discoveredDeals = await fetchHubspotDealsReadOnly(accessToken!);
      pipelines = await fetchHubspotPipelinesReadOnly(accessToken!);
    }

    await upsertPipelineMappings(supabase, integrationId, tenantId, pipelines);
    const pipelineNames = buildPipelineNameMap(pipelines);

    const existingContacts = await loadExistingContactStaging(supabase, integrationId);
    const existingDeals = await loadExistingDealStaging(supabase, integrationId);

    const contactDedupContext = existingContacts.map((c) => ({
      hubspotContactId: c.hubspotContactId,
      email: c.email,
      phone: c.phone,
      importStatus: c.importStatus,
    }));

    const dealDedupContext = existingDeals.map((d) => ({
      hubspotDealId: d.hubspotDealId,
      email: d.email,
      importStatus: d.importStatus,
    }));

    const existingEmails = existingContacts.map((c) => c.email).filter(Boolean) as string[];
    const existingPhones = existingContacts.map((c) => c.phone).filter(Boolean) as string[];

    for (const raw of discoveredContacts) {
      const contact = normalizeHubspotContact(raw, { existingEmails, existingPhones });
      if (!contact) {
        contactsSkipped += 1;
        continue;
      }

      if (detectDuplicateHubspotContact(contact, contactDedupContext)) {
        contactsSkipped += 1;
        await appendHubspotImportAudit(supabase, {
          integrationId,
          tenantId,
          syncRunId: syncRunRow.id,
          action: "contact_duplicate",
          actorAuthUserId: auth.actorAuthUserId,
          actorFiUserId: auth.fiUserId,
          actorLabel: auth.actorLabel,
          detail: { hubspot_contact_id: contact.hubspotContactId, email: contact.email },
        });
        continue;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("fi_external_hubspot_contact_staging")
        .insert({
          integration_id: integrationId,
          tenant_id: tenantId,
          sync_run_id: syncRunRow.id,
          hubspot_contact_id: contact.hubspotContactId,
          email: contact.email,
          phone: contact.phone,
          lead_source: contact.leadSource,
          duplicate_risk: contact.duplicateRisk,
          normalized_lead_type: contact.normalizedLeadType,
          raw_payload: contact.rawPayload,
          import_status: "staged",
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          contactsSkipped += 1;
          continue;
        }
        throw new Error(insertErr.message);
      }

      const stagingId = String((inserted as { id: string }).id);
      contactsStaged += 1;
      if (contact.duplicateRisk) duplicateRisksDetected += 1;

      await appendHubspotImportAudit(supabase, {
        integrationId,
        tenantId,
        stagingContactId: stagingId,
        syncRunId: syncRunRow.id,
        action: "contact_staged",
        actorAuthUserId: auth.actorAuthUserId,
        actorFiUserId: auth.fiUserId,
        actorLabel: auth.actorLabel,
        detail: {
          hubspot_contact_id: contact.hubspotContactId,
          normalized_lead_type: contact.normalizedLeadType,
          duplicate_risk: contact.duplicateRisk,
        },
      });

      contactDedupContext.push({
        hubspotContactId: contact.hubspotContactId,
        email: contact.email,
        phone: contact.phone,
        importStatus: "staged",
      });
      if (contact.email) existingEmails.push(contact.email);
      if (contact.phone) existingPhones.push(contact.phone);
    }

    const existingDealIds = existingDeals.map((d) => d.hubspotDealId);
    const existingDealEmails = existingDeals.map((d) => d.email).filter(Boolean) as string[];

    for (const raw of discoveredDeals) {
      const pipelineId = raw.properties?.pipeline ?? null;
      const pipelineName = pipelineId
        ? (pipelineNames[String(pipelineId)] ?? String(pipelineId))
        : null;
      const deal = normalizeHubspotDeal(raw, {
        pipelineName,
        existingDealIds,
        existingEmails: existingDealEmails,
      });
      if (!deal) {
        dealsSkipped += 1;
        continue;
      }

      if (detectDuplicateHubspotDeal(deal, dealDedupContext)) {
        dealsSkipped += 1;
        await appendHubspotImportAudit(supabase, {
          integrationId,
          tenantId,
          syncRunId: syncRunRow.id,
          action: "deal_duplicate",
          actorAuthUserId: auth.actorAuthUserId,
          actorFiUserId: auth.fiUserId,
          actorLabel: auth.actorLabel,
          detail: { hubspot_deal_id: deal.hubspotDealId },
        });
        continue;
      }

      const { data: inserted, error: insertErr } = await supabase
        .from("fi_external_hubspot_deal_staging")
        .insert({
          integration_id: integrationId,
          tenant_id: tenantId,
          sync_run_id: syncRunRow.id,
          hubspot_deal_id: deal.hubspotDealId,
          hubspot_contact_id: deal.hubspotContactId,
          email: deal.email,
          phone: deal.phone,
          lead_source: deal.leadSource,
          pipeline_name: deal.pipelineName,
          deal_stage: deal.dealStage,
          duplicate_risk: deal.duplicateRisk,
          normalized_lead_type: deal.normalizedLeadType,
          raw_payload: deal.rawPayload,
          import_status: "staged",
        })
        .select("id")
        .single();

      if (insertErr) {
        if (insertErr.code === "23505") {
          dealsSkipped += 1;
          continue;
        }
        throw new Error(insertErr.message);
      }

      const stagingId = String((inserted as { id: string }).id);
      dealsStaged += 1;
      if (deal.duplicateRisk) duplicateRisksDetected += 1;

      await appendHubspotImportAudit(supabase, {
        integrationId,
        tenantId,
        stagingDealId: stagingId,
        syncRunId: syncRunRow.id,
        action: "deal_staged",
        actorAuthUserId: auth.actorAuthUserId,
        actorFiUserId: auth.fiUserId,
        actorLabel: auth.actorLabel,
        detail: {
          hubspot_deal_id: deal.hubspotDealId,
          pipeline_name: deal.pipelineName,
          normalized_lead_type: deal.normalizedLeadType,
        },
      });

      dealDedupContext.push({
        hubspotDealId: deal.hubspotDealId,
        email: deal.email,
        importStatus: "staged",
      });
    }

    const totalDiscovered = discoveredContacts.length + discoveredDeals.length;
    const totalSkipped = contactsSkipped + dealsSkipped;
    if (
      totalDiscovered > 0 &&
      totalSkipped >= totalDiscovered &&
      contactsStaged === 0 &&
      dealsStaged === 0
    ) {
      syncStatus = "partial";
    }
  } catch (e) {
    syncStatus = "failed";
    syncError = e instanceof Error ? e.message : "HubSpot sync failed.";
  }

  const stagingContacts = await loadExistingContactStaging(supabase, integrationId);
  const stagingDeals = await loadExistingDealStaging(supabase, integrationId);

  const health = calculateHubspotSyncHealth({
    latestSyncRun: {
      ...mapSyncRunRow(syncRunRow),
      status: syncStatus,
      contactsDiscovered: discoveredContacts.length,
      contactsStaged,
      contactsSkipped,
      dealsDiscovered: discoveredDeals.length,
      dealsStaged,
      dealsSkipped,
      duplicateRisksDetected,
    },
    recentSyncRuns: [],
    stagingContacts,
    stagingDeals,
    authVerified: true,
  });

  const completedAt = new Date().toISOString();
  const { data: updatedRun, error: updateErr } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .update({
      status: syncStatus,
      contacts_discovered: discoveredContacts.length,
      contacts_staged: contactsStaged,
      contacts_skipped: contactsSkipped,
      deals_discovered: discoveredDeals.length,
      deals_staged: dealsStaged,
      deals_skipped: dealsSkipped,
      duplicate_risks_detected: duplicateRisksDetected,
      health_score: health.healthScore,
      completed_at: completedAt,
      detail: {
        read_only: true,
        error: syncError,
        warnings: health.warnings,
      },
    })
    .eq("id", syncRunRow.id)
    .select("*")
    .single();

  if (updateErr || !updatedRun) {
    return { ok: false, error: updateErr?.message ?? "Failed to finalize sync run." };
  }

  await appendHubspotImportAudit(supabase, {
    integrationId,
    tenantId,
    syncRunId: syncRunRow.id,
    action: syncStatus === "failed" ? "sync_failed" : "sync_completed",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {
      contacts_discovered: discoveredContacts.length,
      contacts_staged: contactsStaged,
      deals_discovered: discoveredDeals.length,
      deals_staged: dealsStaged,
      duplicate_risks_detected: duplicateRisksDetected,
      error: syncError,
    },
  });

  await supabase.from("fi_external_sync_status").upsert(
    {
      integration_id: integrationId,
      tenant_id: tenantId,
      status: syncStatus === "failed" ? "failed" : syncStatus === "partial" ? "partial" : "success",
      health_score: health.healthScore,
      last_sync_at: completedAt,
      last_success_at: syncStatus === "failed" ? null : completedAt,
      last_error: syncError,
      records_synced: contactsStaged + dealsStaged,
      records_failed:
        syncStatus === "failed"
          ? discoveredContacts.length + discoveredDeals.length
          : contactsSkipped + dealsSkipped,
      detail: { provider: "hubspot", read_only: true },
      updated_at: completedAt,
    },
    { onConflict: "integration_id" }
  );

  await createConnectorSyncEvent(
    integrationId,
    tenantId,
    {
      eventKind: syncStatus === "failed" ? "sync_failed" : "sync_completed",
      status: syncStatus === "failed" ? "error" : "success",
      detail: {
        contacts_staged: contactsStaged,
        deals_staged: dealsStaged,
        read_only: true,
      },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  logStructured(syncStatus === "failed" ? "warn" : "info", "hubspot_sync_completed", {
    tenant_id: tenantId,
    integration_id: integrationId,
    status: syncStatus,
    contacts_staged: contactsStaged,
    deals_staged: dealsStaged,
  });

  if (syncStatus === "failed") {
    return { ok: false, error: syncError ?? "HubSpot sync failed." };
  }

  const snapshot = await buildConnectorSnapshot(supabase, integrationId, tenantId);
  return {
    ok: true,
    syncRun: mapSyncRunRow(updatedRun as SyncRunRow),
    snapshot,
  };
}

/** Load staged HubSpot contacts for review. */
export async function loadHubspotStagingContacts(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts & { importStatus?: string | null } = {}
): Promise<{ ok: true; contacts: HubspotStagingContact[] } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  let query = supabase
    .from("fi_external_hubspot_contact_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (opts.importStatus) {
    query = query.eq("import_status", opts.importStatus);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return { ok: true, contacts: ((data ?? []) as ContactStagingRow[]).map(mapContactStagingRow) };
}

/** Load staged HubSpot deals for review. */
export async function loadHubspotStagingDeals(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts & { importStatus?: string | null } = {}
): Promise<{ ok: true; deals: HubspotStagingDeal[] } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  let query = supabase
    .from("fi_external_hubspot_deal_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (opts.importStatus) {
    query = query.eq("import_status", opts.importStatus);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  return { ok: true, deals: ((data ?? []) as DealStagingRow[]).map(mapDealStagingRow) };
}

async function reviewContactStaging(
  stagingContactId: string,
  integrationId: string,
  tenantId: string,
  action: "approve" | "reject",
  opts: ServerOpts
): Promise<{ ok: true; contact: HubspotStagingContact } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("*")
    .eq("id", stagingContactId)
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr || !existing) return { ok: false, error: "Staged contact not found." };

  const row = existing as ContactStagingRow;
  const nextStatus = resolveHubspotImportStatus(row.import_status, action);
  if (!nextStatus) {
    return {
      ok: false,
      error:
        "Contact is not eligible for review — only staged records can be approved or rejected.",
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .update({
      import_status: nextStatus,
      imported_at: action === "approve" ? now : null,
      updated_at: now,
    })
    .eq("id", stagingContactId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "Failed to update staged contact." };
  }

  await appendHubspotImportAudit(supabase, {
    integrationId,
    tenantId,
    stagingContactId,
    action: action === "approve" ? "contact_approved" : "contact_rejected",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {
      hubspot_contact_id: row.hubspot_contact_id,
      email: row.email,
      normalized_lead_type: row.normalized_lead_type,
      no_fi_lead_created: true,
    },
  });

  return { ok: true, contact: mapContactStagingRow(updated as ContactStagingRow) };
}

/** Approve a staged HubSpot contact (staging only — no FI lead creation). */
export async function approveHubspotLead(
  stagingContactId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; contact: HubspotStagingContact } | { ok: false; error: string }> {
  return reviewContactStaging(stagingContactId, integrationId, tenantId, "approve", opts);
}

/** Reject a staged HubSpot contact. */
export async function rejectHubspotLead(
  stagingContactId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; contact: HubspotStagingContact } | { ok: false; error: string }> {
  return reviewContactStaging(stagingContactId, integrationId, tenantId, "reject", opts);
}

async function reviewDealStaging(
  stagingDealId: string,
  integrationId: string,
  tenantId: string,
  action: "approve" | "reject",
  opts: ServerOpts
): Promise<{ ok: true; deal: HubspotStagingDeal } | { ok: false; error: string }> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_external_hubspot_deal_staging")
    .select("*")
    .eq("id", stagingDealId)
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr || !existing) return { ok: false, error: "Staged deal not found." };

  const row = existing as DealStagingRow;
  const nextStatus = resolveHubspotImportStatus(row.import_status, action);
  if (!nextStatus) {
    return {
      ok: false,
      error: "Deal is not eligible for review — only staged records can be approved or rejected.",
    };
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateErr } = await supabase
    .from("fi_external_hubspot_deal_staging")
    .update({
      import_status: nextStatus,
      imported_at: action === "approve" ? now : null,
      updated_at: now,
    })
    .eq("id", stagingDealId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "Failed to update staged deal." };
  }

  await appendHubspotImportAudit(supabase, {
    integrationId,
    tenantId,
    stagingDealId,
    action: action === "approve" ? "deal_approved" : "deal_rejected",
    actorAuthUserId: auth.actorAuthUserId,
    actorFiUserId: auth.fiUserId,
    actorLabel: auth.actorLabel,
    detail: {
      hubspot_deal_id: row.hubspot_deal_id,
      pipeline_name: row.pipeline_name,
      no_fi_opportunity_created: true,
    },
  });

  return { ok: true, deal: mapDealStagingRow(updated as DealStagingRow) };
}

/** Approve a staged HubSpot deal (staging only — no FI opportunity creation). */
export async function approveHubspotDeal(
  stagingDealId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; deal: HubspotStagingDeal } | { ok: false; error: string }> {
  return reviewDealStaging(stagingDealId, integrationId, tenantId, "approve", opts);
}

/** Reject a staged HubSpot deal. */
export async function rejectHubspotDeal(
  stagingDealId: string,
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; deal: HubspotStagingDeal } | { ok: false; error: string }> {
  return reviewDealStaging(stagingDealId, integrationId, tenantId, "reject", opts);
}

/** Load sync runs for a HubSpot integration. */
export async function loadHubspotSyncRuns(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts & { limit?: number } = {}
): Promise<{ ok: true; runs: HubspotSyncRun[] } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, opts);
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const limit = opts.limit ?? 10;

  const { data, error } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) return { ok: false, error: error.message };
  return { ok: true, runs: ((data ?? []) as SyncRunRow[]).map(mapSyncRunRow) };
}

async function buildConnectorSnapshot(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<HubspotConnectorSnapshot> {
  const authVerified = await loadAuthVerified(supabase, integrationId);

  const { data: contactRows } = await supabase
    .from("fi_external_hubspot_contact_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  const contactQueue = ((contactRows ?? []) as ContactStagingRow[]).map(mapContactStagingRow);

  const { data: dealRows } = await supabase
    .from("fi_external_hubspot_deal_staging")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  const dealQueue = ((dealRows ?? []) as DealStagingRow[]).map(mapDealStagingRow);

  const { data: runRows } = await supabase
    .from("fi_external_hubspot_sync_runs")
    .select("*")
    .eq("integration_id", integrationId)
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(10);

  const recentSyncRuns = ((runRows ?? []) as SyncRunRow[]).map(mapSyncRunRow);
  const latestSyncRun = recentSyncRuns[0] ?? null;

  const syncHealth = calculateHubspotSyncHealth({
    latestSyncRun,
    recentSyncRuns,
    stagingContacts: contactQueue,
    stagingDeals: dealQueue,
    authVerified,
  });

  return {
    tenantId,
    integrationId,
    syncHealth,
    latestSyncRun,
    recentSyncRuns,
    contactQueue,
    dealQueue,
    calculatedAt: new Date().toISOString(),
  };
}

/** Load full HubSpot connector snapshot for UI. */
export async function loadHubspotConnectorSnapshot(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<{ ok: true; snapshot: HubspotConnectorSnapshot } | { ok: false; error: string }> {
  const read = await resolveReadAuth(tenantId, { ...opts, allowTenantMemberRead: true });
  if (!read.ok) return read;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const integration = await loadIntegration(supabase, integrationId, tenantId);
  if (!integration) return { ok: false, error: "Connector not found." };
  if (integration.provider !== "hubspot") {
    return { ok: false, error: "Integration is not a HubSpot connector." };
  }

  const snapshot = await buildConnectorSnapshot(supabase, integrationId, tenantId);
  return { ok: true, snapshot };
}
