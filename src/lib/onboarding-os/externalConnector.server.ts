import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import { isFiOsRoleAllowedForPlatformTenantProvisioning } from "@/src/lib/fiOs/platformTenantProvisionGate";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { logStructured } from "@/src/lib/server/structuredLog";

import {
  buildConnectorMappingPlan,
  buildSupportedConnectorCatalog,
  defaultConnectorDisplayName,
  getConnectorCatalogEntry,
  resolveConnectorHealthStatus,
  resolveInitialConnectorStatus,
  validateConnectorConfiguration,
} from "./externalConnectorCore";
import {
  deriveExternalConnectorMasterKey,
  encryptExternalConnectorSecret,
  serializeConnectorCredentialPayload,
} from "./externalConnectorSecretCrypto.server";
import type {
  ExternalConnectorConfigurationInput,
  ExternalConnectorCredentialKind,
  ExternalConnectorHealthStatus,
  ExternalConnectorIntegrationRow,
  ExternalConnectorProvider,
  ExternalConnectorStatus,
  ExternalConnectorSyncMode,
  ExternalSyncEventKind,
  ExternalSyncEventStatus,
  TenantExternalConnectorsSnapshot,
} from "./externalConnectorTypes";
import {
  isExternalConnectorProvider,
  isExternalConnectorStatus,
  isExternalSyncEventKind,
  isExternalSyncStatus,
} from "./externalConnectorTypes";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  actorAuthUserId?: string | null;
  skipAuthCheck?: boolean;
  allowTenantMemberRead?: boolean;
};

type IntegrationRow = {
  id: string;
  tenant_id: string;
  provider: string;
  category: string;
  display_name: string;
  status: string;
  sync_mode: string;
  config: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

type SyncStatusRow = {
  integration_id: string;
  status: string;
  health_score: number;
  last_sync_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type CredentialRow = {
  integration_id: string;
};

export type ExternalConnectorActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export type CreateExternalConnectorResult =
  | { ok: true; integration: ExternalConnectorIntegrationRow }
  | { ok: false; error: string };

function resolveMasterKey(): Buffer | null {
  return deriveExternalConnectorMasterKey(process.env.FI_EXTERNAL_CONNECTOR_MASTER_KEY);
}

async function resolvePlatformAdminAuth(opts: ServerOpts): Promise<
  | { ok: true; actorAuthUserId: string }
  | { ok: false; error: string }
> {
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
    return { ok: true, actorAuthUserId: platform.actorAuthUserId, fiUserId: null, actorLabel: "Platform admin" };
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

function mapIntegrationRow(
  row: IntegrationRow,
  sync: SyncStatusRow | null,
  credentialConfigured: boolean
): ExternalConnectorIntegrationRow {
  const provider = isExternalConnectorProvider(row.provider) ? row.provider : "pabau";
  const status = isExternalConnectorStatus(row.status) ? row.status : "draft";
  const syncStatus = sync && isExternalSyncStatus(sync.status) ? sync.status : null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    provider,
    category: row.category as ExternalConnectorIntegrationRow["category"],
    displayName: row.display_name,
    status,
    syncMode: row.sync_mode as ExternalConnectorSyncMode,
    config: row.config ?? {},
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    credentialConfigured,
    syncStatus,
    healthScore: sync?.health_score ?? 0,
    lastSyncAt: sync?.last_sync_at ?? null,
    lastSuccessAt: sync?.last_success_at ?? null,
    lastError: sync?.last_error ?? null,
  };
}

async function loadCredentialFlags(
  supabase: SupabaseClient,
  integrationIds: string[]
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (integrationIds.length === 0) return map;

  const { data } = await supabase
    .from("fi_external_connector_credentials")
    .select("integration_id")
    .in("integration_id", integrationIds);

  for (const row of (data ?? []) as CredentialRow[]) {
    map.set(row.integration_id, true);
  }
  return map;
}

async function loadSyncStatusMap(
  supabase: SupabaseClient,
  integrationIds: string[]
): Promise<Map<string, SyncStatusRow>> {
  const map = new Map<string, SyncStatusRow>();
  if (integrationIds.length === 0) return map;

  const { data } = await supabase
    .from("fi_external_sync_status")
    .select("integration_id, status, health_score, last_sync_at, last_success_at, last_error")
    .in("integration_id", integrationIds);

  for (const row of (data ?? []) as SyncStatusRow[]) {
    map.set(row.integration_id, row);
  }
  return map;
}

async function upsertDefaultSyncStatus(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string
): Promise<void> {
  const { data: existing } = await supabase
    .from("fi_external_sync_status")
    .select("id")
    .eq("integration_id", integrationId)
    .maybeSingle();

  if (existing) return;

  await supabase.from("fi_external_sync_status").insert({
    integration_id: integrationId,
    tenant_id: tenantId,
    status: "idle",
    health_score: 0,
    detail: {},
  });
}

async function upsertDefaultMappings(
  supabase: SupabaseClient,
  integrationId: string,
  tenantId: string,
  provider: ExternalConnectorProvider
): Promise<void> {
  const plan = buildConnectorMappingPlan(provider);
  for (const entry of plan.entries) {
    await supabase.from("fi_external_data_mappings").upsert(
      {
        integration_id: integrationId,
        tenant_id: tenantId,
        source_entity: entry.sourceEntity,
        target_entity: entry.targetEntity,
        status: "draft",
        mapping: { fields: entry.fields },
        metadata: { label: entry.label },
      },
      { onConflict: "integration_id,source_entity,target_entity" }
    );
  }
}

async function storeCredentialIfProvided(
  supabase: SupabaseClient,
  opts: {
    integrationId: string;
    tenantId: string;
    credentialPlaintext?: string | null;
    credentialKind?: ExternalConnectorCredentialKind | null;
    config?: Record<string, unknown>;
  }
): Promise<boolean> {
  const plaintext = opts.credentialPlaintext?.trim();
  if (!plaintext) return false;

  const masterKey = resolveMasterKey();
  if (!masterKey) {
    throw new Error("FI_EXTERNAL_CONNECTOR_MASTER_KEY is not configured.");
  }

  const kind = opts.credentialKind ?? "api_key";
  const serialized = serializeConnectorCredentialPayload({
    credentialKind: kind,
    plaintext,
    config: opts.config,
  });
  const credentialsEncrypted = encryptExternalConnectorSecret(serialized, masterKey);

  const { error } = await supabase.from("fi_external_connector_credentials").upsert(
    {
      integration_id: opts.integrationId,
      tenant_id: opts.tenantId,
      credential_kind: kind,
      credentials_encrypted: credentialsEncrypted,
      key_version: 1,
      metadata: {},
    },
    { onConflict: "integration_id,credential_kind" }
  );

  if (error) throw new Error(error.message);
  return true;
}

/** Create a tenant external connector registration (architecture foundation — no live sync). */
export async function createExternalConnector(
  tenantId: string,
  input: ExternalConnectorConfigurationInput,
  opts: ServerOpts = {}
): Promise<CreateExternalConnectorResult> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const validation = validateConnectorConfiguration(input);
  if (!validation.ok) return { ok: false, error: validation.errors.join(" ") };

  const entry = getConnectorCatalogEntry(validation.provider);
  if (!entry) return { ok: false, error: "Provider not found in catalog." };

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const displayName = input.displayName?.trim() || defaultConnectorDisplayName(validation.provider);
  const syncMode = input.syncMode ?? "manual";
  const config = { ...(input.config ?? {}) };

  let credentialStored = false;
  try {
    credentialStored = Boolean(input.credentialPlaintext?.trim());
    if (credentialStored && !resolveMasterKey()) {
      return { ok: false, error: "Credential encryption is not configured on the server." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Credential validation failed." };
  }

  const configComplete = validation.ok;
  const status = resolveInitialConnectorStatus(credentialStored, configComplete);

  const { data: inserted, error: insertErr } = await supabase
    .from("fi_tenant_external_integrations")
    .insert({
      tenant_id: tenantId,
      provider: validation.provider,
      category: validation.category,
      display_name: displayName,
      status,
      sync_mode: syncMode,
      config,
      metadata: { architecture_only: true, live_sync: false },
    })
    .select("*")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Failed to create connector." };
  }

  const row = inserted as IntegrationRow;

  try {
    if (credentialStored) {
      await storeCredentialIfProvided(supabase, {
        integrationId: row.id,
        tenantId,
        credentialPlaintext: input.credentialPlaintext,
        credentialKind: input.credentialKind,
        config,
      });
    }
    await upsertDefaultSyncStatus(supabase, row.id, tenantId);
    await upsertDefaultMappings(supabase, row.id, tenantId, validation.provider);
  } catch (e) {
    await supabase.from("fi_tenant_external_integrations").delete().eq("id", row.id);
    return { ok: false, error: e instanceof Error ? e.message : "Failed to initialize connector." };
  }

  await createConnectorSyncEvent(
    row.id,
    tenantId,
    {
      eventKind: "connector_created",
      status: "info",
      detail: { provider: validation.provider, status },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  if (credentialStored) {
    await createConnectorSyncEvent(
      row.id,
      tenantId,
      {
        eventKind: "credential_stored",
        status: "success",
        detail: { credential_kind: input.credentialKind ?? "api_key" },
        actorAuthUserId: auth.actorAuthUserId,
        actorFiUserId: auth.fiUserId,
        actorLabel: auth.actorLabel,
      },
      { ...opts, skipAuthCheck: true }
    );
  }

  logStructured("info", "external_connector_created", {
    tenant_id: tenantId,
    provider: validation.provider,
    integration_id: row.id,
  });

  const credentialFlags = await loadCredentialFlags(supabase, [row.id]);
  const syncMap = await loadSyncStatusMap(supabase, [row.id]);

  return {
    ok: true,
    integration: mapIntegrationRow(row, syncMap.get(row.id) ?? null, credentialFlags.get(row.id) ?? false),
  };
}

/** Update an existing external connector registration. */
export async function updateExternalConnector(
  integrationId: string,
  tenantId: string,
  input: Partial<ExternalConnectorConfigurationInput> & { status?: ExternalConnectorStatus },
  opts: ServerOpts = {}
): Promise<CreateExternalConnectorResult> {
  const auth = await resolveWriteAuth(tenantId, opts);
  if (!auth.ok) return auth;

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: existing, error: loadErr } = await supabase
    .from("fi_tenant_external_integrations")
    .select("*")
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (loadErr || !existing) return { ok: false, error: "Connector not found." };

  const row = existing as IntegrationRow;
  const provider = isExternalConnectorProvider(row.provider) ? row.provider : input.provider;
  if (!provider || !isExternalConnectorProvider(provider)) {
    return { ok: false, error: "Invalid provider." };
  }

  const mergedConfig = { ...(row.config ?? {}), ...(input.config ?? {}) };
  const validation = validateConnectorConfiguration({
    provider,
    displayName: input.displayName ?? row.display_name,
    syncMode: input.syncMode ?? (row.sync_mode as ExternalConnectorSyncMode),
    config: mergedConfig,
    credentialPlaintext: input.credentialPlaintext,
    credentialKind: input.credentialKind,
  });

  const credentialFlags = await loadCredentialFlags(supabase, [integrationId]);
  const hadCredential = credentialFlags.get(integrationId) ?? false;

  if (!validation.ok && !hadCredential && !input.credentialPlaintext?.trim()) {
    return { ok: false, error: validation.errors.join(" ") };
  }

  let credentialStored = hadCredential;
  if (input.credentialPlaintext?.trim()) {
    try {
      credentialStored = await storeCredentialIfProvided(supabase, {
        integrationId,
        tenantId,
        credentialPlaintext: input.credentialPlaintext,
        credentialKind: input.credentialKind,
        config: mergedConfig,
      });
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Failed to store credential." };
    }
  }

  const nextStatus =
    input.status ??
    (validation.ok
      ? resolveInitialConnectorStatus(credentialStored, true)
      : (row.status as ExternalConnectorStatus));

  const patch: Record<string, unknown> = {
    display_name: input.displayName?.trim() || row.display_name,
    config: mergedConfig,
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };
  if (input.syncMode) patch.sync_mode = input.syncMode;

  const { data: updated, error: updateErr } = await supabase
    .from("fi_tenant_external_integrations")
    .update(patch)
    .eq("id", integrationId)
    .eq("tenant_id", tenantId)
    .select("*")
    .single();

  if (updateErr || !updated) {
    return { ok: false, error: updateErr?.message ?? "Failed to update connector." };
  }

  await createConnectorSyncEvent(
    integrationId,
    tenantId,
    {
      eventKind: "connector_updated",
      status: "info",
      detail: { status: nextStatus },
      actorAuthUserId: auth.actorAuthUserId,
      actorFiUserId: auth.fiUserId,
      actorLabel: auth.actorLabel,
    },
    { ...opts, skipAuthCheck: true }
  );

  const syncMap = await loadSyncStatusMap(supabase, [integrationId]);
  const credFlags = await loadCredentialFlags(supabase, [integrationId]);

  return {
    ok: true,
    integration: mapIntegrationRow(updated as IntegrationRow, syncMap.get(integrationId) ?? null, credFlags.get(integrationId) ?? false),
  };
}

/** Load all external connectors for a tenant with catalog and health. */
export async function loadTenantExternalConnectors(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; snapshot: TenantExternalConnectorsSnapshot }
  | { ok: false; error: string }
> {
  const platform = await resolvePlatformAdminAuth({ ...opts, skipAuthCheck: false });
  if (!platform.ok) {
    if (!opts.allowTenantMemberRead) {
      const tenantAuth = await resolveTenantAdminAuth(tenantId, { ...opts, skipAuthCheck: true });
      if (!tenantAuth.ok) {
        const memberSupabase = opts.supabaseClientForTests ?? supabaseAdmin();
        const authId = opts.actorAuthUserId ?? (await resolveAuthUserId(null));
        if (!authId) return { ok: false, error: "Authentication required." };
        const { data: member } = await memberSupabase
          .from("fi_users")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("auth_user_id", authId)
          .maybeSingle();
        if (!member) return { ok: false, error: "Tenant membership required." };
      }
    }
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data: rows, error } = await supabase
    .from("fi_tenant_external_integrations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const integrationRows = (rows ?? []) as IntegrationRow[];
  const ids = integrationRows.map((r) => r.id);
  const syncMap = await loadSyncStatusMap(supabase, ids);
  const credFlags = await loadCredentialFlags(supabase, ids);

  const integrations = integrationRows.map((r) =>
    mapIntegrationRow(r, syncMap.get(r.id) ?? null, credFlags.get(r.id) ?? false)
  );

  const healthStatuses = integrations.map((i) =>
    resolveConnectorHealthStatus({
      integrationId: i.id,
      provider: i.provider,
      status: i.status,
      syncStatus: i.syncStatus,
      healthScore: i.healthScore,
      lastSyncAt: i.lastSyncAt,
      lastSuccessAt: i.lastSuccessAt,
      lastError: i.lastError,
      credentialConfigured: i.credentialConfigured,
    })
  );

  return {
    ok: true,
    snapshot: {
      tenantId,
      catalog: buildSupportedConnectorCatalog(),
      integrations,
      healthStatuses,
      calculatedAt: new Date().toISOString(),
    },
  };
}

/** Load health status for a single connector. */
export async function loadConnectorHealthStatus(
  integrationId: string,
  tenantId: string,
  opts: ServerOpts = {}
): Promise<
  | { ok: true; health: ExternalConnectorHealthStatus }
  | { ok: false; error: string }
> {
  const loaded = await loadTenantExternalConnectors(tenantId, opts);
  if (!loaded.ok) return loaded;

  const integration = loaded.snapshot.integrations.find((i) => i.id === integrationId);
  if (!integration) return { ok: false, error: "Connector not found." };

  const health = loaded.snapshot.healthStatuses.find((h) => h.integrationId === integrationId);
  if (!health) {
    return {
      ok: true,
      health: resolveConnectorHealthStatus({
        integrationId,
        provider: integration.provider,
        status: integration.status,
        syncStatus: integration.syncStatus,
        healthScore: integration.healthScore,
        lastSyncAt: integration.lastSyncAt,
        lastSuccessAt: integration.lastSuccessAt,
        lastError: integration.lastError,
        credentialConfigured: integration.credentialConfigured,
      }),
    };
  }

  return { ok: true, health };
}

/** Append a connector sync lifecycle event (insert-only). */
export async function createConnectorSyncEvent(
  integrationId: string,
  tenantId: string,
  event: {
    eventKind: ExternalSyncEventKind | string;
    status: ExternalSyncEventStatus | string;
    detail?: Record<string, unknown>;
    actorAuthUserId?: string | null;
    actorFiUserId?: string | null;
    actorLabel?: string | null;
    occurredAt?: string;
  },
  opts: ServerOpts = {}
): Promise<ExternalConnectorActionResult<{ eventId: string }>> {
  if (!opts.skipAuthCheck) {
    const auth = await resolveWriteAuth(tenantId, opts);
    if (!auth.ok) return auth;
  }

  const kind = String(event.eventKind ?? "").trim();
  const status = String(event.status ?? "info").trim();
  if (!isExternalSyncEventKind(kind)) {
    return { ok: false, error: "Invalid sync event kind." };
  }

  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_external_sync_events")
    .insert({
      integration_id: integrationId,
      tenant_id: tenantId,
      event_kind: kind,
      status,
      actor_auth_user_id: event.actorAuthUserId ?? null,
      actor_fi_user_id: event.actorFiUserId ?? null,
      actor_label: event.actorLabel ?? null,
      detail: event.detail ?? {},
      occurred_at: event.occurredAt ?? new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) return { ok: false, error: error?.message ?? "Failed to record sync event." };

  return { ok: true, data: { eventId: String((data as { id: string }).id) } };
}

/** Whether tenant admins may view the Connect Existing Systems onboarding step. */
export async function canViewTenantExternalConnectors(tenantId: string): Promise<boolean> {
  const authId = await resolveAuthUserId(null);
  if (!authId) return false;

  const os = await loadFiOsIdentity(authId);
  if (isFiOsRoleAllowedForPlatformTenantProvisioning(os?.osRole)) return true;

  const adminProf = await loadActiveTenantAdminProfileForSession(tenantId, authId);
  return adminProf?.adminRole === "clinic_admin" || adminProf?.adminRole === "operations_admin";
}
