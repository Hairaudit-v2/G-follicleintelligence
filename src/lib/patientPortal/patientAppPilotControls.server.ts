/**
 * FI-PATIENT-APP-2B — server controls for tenant pilot pause and patient access.
 *
 * Operator-facing helpers: do not expose personal contacts; used by runbooks/scripts/tests.
 * Does not delete clinic journey or audit history.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import {
  decidePatientAppAccess,
  isGlobalPatientAppPilotPaused,
  mergePatientAppAccessMetadata,
  mergePatientAppPilotTenantMetadata,
  parsePatientAppAccessState,
  parsePatientAppPilotTenantState,
  shouldSuppressPatientAppPush,
  type PatientAppAccessStatus,
  type PatientAppAccessState,
  type PatientAppPilotTenantState,
  type PatientAppPilotTenantStatus,
} from "./patientAppPilotControlsCore";

export type PatientAppPilotLoadOptions = {
  supabase?: SupabaseClient;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  writeAudit?: boolean;
};

async function loadTenantMetadata(
  tenantId: string,
  client: SupabaseClient
): Promise<unknown> {
  const { data, error } = await client
    .from("fi_tenant_settings")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { metadata?: unknown } | null)?.metadata ?? {};
}

async function loadPatientMetadata(
  patientId: string,
  tenantId: string,
  client: SupabaseClient
): Promise<{ metadata: unknown; portalAuthUserId: string | null }> {
  const { data, error } = await client
    .from("fi_patients")
    .select("metadata, portal_auth_user_id")
    .eq("id", patientId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("patient_not_found");
  const row = data as { metadata?: unknown; portal_auth_user_id?: string | null };
  return {
    metadata: row.metadata ?? {},
    portalAuthUserId: row.portal_auth_user_id != null ? String(row.portal_auth_user_id) : null,
  };
}

export async function loadPatientAppPilotStates(
  input: { tenantId: string; patientId: string },
  options?: PatientAppPilotLoadOptions
): Promise<{
  globalPaused: boolean;
  tenant: PatientAppPilotTenantState;
  patient: PatientAppAccessState;
}> {
  const client = options?.supabase ?? supabaseAdmin();
  const env = options?.env ?? process.env;
  const [tenantMeta, patientRow] = await Promise.all([
    loadTenantMetadata(input.tenantId, client),
    loadPatientMetadata(input.patientId, input.tenantId, client),
  ]);
  return {
    globalPaused: isGlobalPatientAppPilotPaused(env),
    tenant: parsePatientAppPilotTenantState(tenantMeta),
    patient: parsePatientAppAccessState(patientRow.metadata),
  };
}

export async function assertPatientAppAccessAllowed(
  input: { tenantId: string; patientId: string; authUserId?: string | null },
  options?: PatientAppPilotLoadOptions
): Promise<ReturnType<typeof decidePatientAppAccess>> {
  const states = await loadPatientAppPilotStates(input, options);
  const decision = decidePatientAppAccess(states);
  if (!decision.ok && options?.writeAudit !== false) {
    writePatientGatewayAudit({
      action:
        decision.code === "pilot_paused"
          ? "pilot_paused"
          : decision.code === "patient_withdrawn"
            ? "patient_withdrawn"
            : "patient_portal_deactivated",
      outcome: "deny",
      code: decision.code,
      authUserId: input.authUserId ?? null,
      patientId: input.patientId,
      tenantId: input.tenantId,
    });
  }
  return decision;
}

export async function shouldSuppressPatientAppPushForPatient(
  input: { tenantId: string; patientId: string },
  options?: PatientAppPilotLoadOptions
): Promise<boolean> {
  try {
    const states = await loadPatientAppPilotStates(input, options);
    return shouldSuppressPatientAppPush(states);
  } catch {
    // Fail closed for push when state cannot be loaded.
    return true;
  }
}

export async function setTenantPatientAppPilotStatus(input: {
  tenantId: string;
  status: PatientAppPilotTenantStatus;
  reason?: string | null;
  actorId?: string | null;
  nowIso?: string;
  supabase?: SupabaseClient;
}): Promise<{ ok: true; tenant: PatientAppPilotTenantState }> {
  const client = input.supabase ?? supabaseAdmin();
  const atIso = input.nowIso ?? new Date().toISOString();
  const existing = await loadTenantMetadata(input.tenantId, client);
  const metadata = mergePatientAppPilotTenantMetadata(existing, {
    status: input.status,
    reason: input.reason ?? null,
    updatedBy: input.actorId ?? null,
    atIso,
  });

  const { data: row, error: loadErr } = await client
    .from("fi_tenant_settings")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (loadErr) throw new Error(loadErr.message);

  if (row) {
    const { error } = await client
      .from("fi_tenant_settings")
      .update({ metadata, updated_at: atIso })
      .eq("tenant_id", input.tenantId);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await client.from("fi_tenant_settings").insert({
      tenant_id: input.tenantId,
      metadata,
      created_at: atIso,
      updated_at: atIso,
    });
    if (error) throw new Error(error.message);
  }

  writePatientGatewayAudit({
    action: input.status === "enabled" ? "pilot_resumed" : "pilot_paused",
    outcome: "allow",
    authUserId: input.actorId ?? null,
    tenantId: input.tenantId,
    resourceKind: "notification",
    resourceId: input.status,
  });

  return { ok: true, tenant: parsePatientAppPilotTenantState(metadata) };
}

async function disableAllPatientDevices(input: {
  tenantId: string;
  patientId: string;
  nowIso: string;
  client: SupabaseClient;
}): Promise<number> {
  const { data, error } = await input.client
    .from("fi_patient_notification_devices")
    .update({ disabled_at: input.nowIso })
    .eq("tenant_id", input.tenantId)
    .eq("patient_id", input.patientId)
    .is("disabled_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data.length : 0;
}

/**
 * Patient-level deactivation / withdrawal.
 * - Stops portal access via metadata (and optional unlink)
 * - Disables push devices
 * - Prefer preserving clinic journey rows and audit history
 */
export async function setPatientAppAccess(input: {
  tenantId: string;
  patientId: string;
  status: PatientAppAccessStatus;
  reasonCategory?: string | null;
  reasonDetail?: string | null;
  actorId?: string | null;
  /** When true (default for deactivate/withdraw), clear portal_auth_user_id to block invitation reuse. */
  unlinkPortal?: boolean;
  nowIso?: string;
  supabase?: SupabaseClient;
}): Promise<{
  ok: true;
  patient: PatientAppAccessState;
  devicesDisabled: number;
  portalUnlinked: boolean;
}> {
  const client = input.supabase ?? supabaseAdmin();
  const atIso = input.nowIso ?? new Date().toISOString();
  const unlink =
    input.unlinkPortal ?? (input.status === "deactivated" || input.status === "withdrawn");

  const existing = await loadPatientMetadata(input.patientId, input.tenantId, client);
  const metadata = mergePatientAppAccessMetadata(existing.metadata, {
    status: input.status,
    reasonCategory: input.reasonCategory ?? null,
    reasonDetail: input.reasonDetail ?? null,
    changedBy: input.actorId ?? null,
    atIso,
    invitationReuseBlocked: true,
  });

  // Preserve push=false preference under existing notification prefs key when withdrawing.
  const nextMeta = { ...metadata } as Record<string, unknown>;
  if (input.status !== "active") {
    const prefsRoot =
      nextMeta.patient_gateway_notification_preferences &&
      typeof nextMeta.patient_gateway_notification_preferences === "object" &&
      !Array.isArray(nextMeta.patient_gateway_notification_preferences)
        ? {
            ...(nextMeta.patient_gateway_notification_preferences as Record<string, unknown>),
          }
        : {};
    prefsRoot.push = false;
    nextMeta.patient_gateway_notification_preferences = prefsRoot;
  }

  const patch: Record<string, unknown> = {
    metadata: nextMeta,
    updated_at: atIso,
  };
  if (unlink && input.status !== "active") {
    patch.portal_auth_user_id = null;
  }

  const { error } = await client
    .from("fi_patients")
    .update(patch)
    .eq("id", input.patientId)
    .eq("tenant_id", input.tenantId);
  if (error) throw new Error(error.message);

  const devicesDisabled =
    input.status === "active"
      ? 0
      : await disableAllPatientDevices({
          tenantId: input.tenantId,
          patientId: input.patientId,
          nowIso: atIso,
          client,
        });

  writePatientGatewayAudit({
    action:
      input.status === "withdrawn"
        ? "patient_withdrawn"
        : input.status === "deactivated"
          ? "patient_portal_deactivated"
          : "patient_portal_reactivated",
    outcome: "allow",
    authUserId: input.actorId ?? null,
    patientId: input.patientId,
    tenantId: input.tenantId,
    resourceKind: "notification",
    resourceId: input.status,
  });

  return {
    ok: true,
    patient: parsePatientAppAccessState(nextMeta),
    devicesDisabled,
    portalUnlinked: Boolean(unlink && input.status !== "active"),
  };
}
