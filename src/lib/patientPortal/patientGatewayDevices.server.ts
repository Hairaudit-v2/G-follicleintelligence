/**
 * FI-PATIENT-APP-2G — patient notification device registry (server).
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  mapDeviceDbRow,
  mapDeviceRowToPublic,
  validateRegisterPatientDeviceInput,
  type NotificationDevice,
  type PatientGatewayDevicePublic,
  type RegisterPatientDeviceInput,
} from "./patientGatewayDeviceCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

export type PatientGatewayDeviceOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  nowIso?: string;
};

function denyInvalidDevice(message: string): PatientGatewayDeny {
  return patientGatewayDeny("invalid_device", 400, message);
}

export async function listPatientNotificationDevices(
  ctx: PatientGatewayContext,
  options?: PatientGatewayDeviceOptions
): Promise<{ ok: true; devices: PatientGatewayDevicePublic[] } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("fi_patient_notification_devices")
      .select(
        "id, tenant_id, patient_id, platform, provider, provider_token, token_fingerprint, device_label, app_version, environment, created_at, last_seen_at, disabled_at"
      )
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId)
      .is("disabled_at", null)
      .order("last_seen_at", { ascending: false });
    if (error) throw new Error(error.message);

    const devices = ((data ?? []) as Record<string, unknown>[]).map((row) =>
      mapDeviceRowToPublic(mapDeviceDbRow(row))
    );

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_list",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
      });
    }
    return { ok: true, devices };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not list devices.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_list",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
      });
    }
    return deny;
  }
}

/**
 * Register or refresh a device for the authenticated patient.
 * Identity is always derived from gateway context — never from the request body.
 */
export async function registerPatientNotificationDevice(
  ctx: PatientGatewayContext,
  rawInput: RegisterPatientDeviceInput,
  options?: PatientGatewayDeviceOptions
): Promise<{ ok: true; device: PatientGatewayDevicePublic; refreshed: boolean } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();
  const nowIso = options?.nowIso ?? new Date().toISOString();

  const validated = validateRegisterPatientDeviceInput(rawInput);
  if (!validated.ok) {
    const deny = denyInvalidDevice("Invalid device registration.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_registered",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
        resourceId: validated.reason,
      });
    }
    return deny;
  }

  try {
    // Soft-disable any other patient's active registration for the same token fingerprint.
    const { data: foreignActive } = await supabase
      .from("fi_patient_notification_devices")
      .select("id, tenant_id, patient_id")
      .eq("provider", validated.provider)
      .eq("token_fingerprint", validated.tokenFingerprint)
      .is("disabled_at", null);

    for (const row of (foreignActive ?? []) as Array<{
      id: string;
      tenant_id: string;
      patient_id: string;
    }>) {
      if (row.patient_id === ctx.patientId && row.tenant_id === ctx.tenantId) continue;
      await supabase
        .from("fi_patient_notification_devices")
        .update({ disabled_at: nowIso })
        .eq("id", row.id)
        .is("disabled_at", null);
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "patient_device_disabled",
          outcome: "allow",
          patientId: row.patient_id,
          tenantId: row.tenant_id,
          resourceKind: "notification",
          resourceId: row.id,
        });
      }
    }

    // Idempotent upsert for this patient + fingerprint.
    const { data: existing } = await supabase
      .from("fi_patient_notification_devices")
      .select(
        "id, tenant_id, patient_id, platform, provider, provider_token, token_fingerprint, device_label, app_version, environment, created_at, last_seen_at, disabled_at"
      )
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId)
      .eq("provider", validated.provider)
      .eq("token_fingerprint", validated.tokenFingerprint)
      .maybeSingle();

    if (existing) {
      const { data: updated, error: ue } = await supabase
        .from("fi_patient_notification_devices")
        .update({
          provider_token: validated.token,
          platform: validated.platform,
          app_version: validated.appVersion,
          device_label: validated.deviceLabel,
          environment: validated.environment,
          last_seen_at: nowIso,
          disabled_at: null,
        })
        .eq("id", (existing as { id: string }).id)
        .eq("tenant_id", ctx.tenantId)
        .eq("patient_id", ctx.patientId)
        .select(
          "id, tenant_id, patient_id, platform, provider, provider_token, token_fingerprint, device_label, app_version, environment, created_at, last_seen_at, disabled_at"
        )
        .single();
      if (ue) throw new Error(ue.message);
      const device = mapDeviceRowToPublic(mapDeviceDbRow(updated as Record<string, unknown>));
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "patient_device_refreshed",
          outcome: "allow",
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "notification",
          resourceId: device.id,
        });
      }
      return { ok: true, device, refreshed: true };
    }

    const { data: inserted, error: ie } = await supabase
      .from("fi_patient_notification_devices")
      .insert({
        tenant_id: ctx.tenantId,
        patient_id: ctx.patientId,
        platform: validated.platform,
        provider: validated.provider,
        provider_token: validated.token,
        token_fingerprint: validated.tokenFingerprint,
        device_label: validated.deviceLabel,
        app_version: validated.appVersion,
        environment: validated.environment,
        created_at: nowIso,
        last_seen_at: nowIso,
        disabled_at: null,
        metadata: {},
      })
      .select(
        "id, tenant_id, patient_id, platform, provider, provider_token, token_fingerprint, device_label, app_version, environment, created_at, last_seen_at, disabled_at"
      )
      .single();
    if (ie) throw new Error(ie.message);

    const device = mapDeviceRowToPublic(mapDeviceDbRow(inserted as Record<string, unknown>));
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_registered",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
        resourceId: device.id,
      });
    }
    return { ok: true, device, refreshed: false };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not register device.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_registered",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
      });
    }
    return deny;
  }
}

/**
 * Disable a device owned by the authenticated patient (logout / revoke).
 * Foreign device ids fail closed as not_found (no existence leak across patients).
 */
export async function disablePatientNotificationDevice(
  ctx: PatientGatewayContext,
  deviceId: string,
  options?: PatientGatewayDeviceOptions
): Promise<{ ok: true; deviceId: string } | PatientGatewayDeny> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();
  const nowIso = options?.nowIso ?? new Date().toISOString();
  const id = deviceId.trim();

  if (!id) {
    return patientGatewayDeny("device_not_found", 404, "Device not found.");
  }

  try {
    const { data: row, error } = await supabase
      .from("fi_patient_notification_devices")
      .select("id, disabled_at")
      .eq("tenant_id", ctx.tenantId)
      .eq("patient_id", ctx.patientId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) {
      const deny = patientGatewayDeny("device_not_found", 404, "Device not found.");
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "patient_device_disabled",
          outcome: "deny",
          code: deny.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "notification",
          resourceId: id,
        });
      }
      return deny;
    }

    if (!(row as { disabled_at?: string | null }).disabled_at) {
      const { error: ue } = await supabase
        .from("fi_patient_notification_devices")
        .update({ disabled_at: nowIso })
        .eq("id", id)
        .eq("tenant_id", ctx.tenantId)
        .eq("patient_id", ctx.patientId);
      if (ue) throw new Error(ue.message);
    }

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_disabled",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
        resourceId: id,
      });
    }
    return { ok: true, deviceId: id };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not disable device.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_device_disabled",
        outcome: "deny",
        code: deny.code,
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
        resourceId: id,
      });
    }
    return deny;
  }
}

export async function listActiveDevicesForPatient(
  tenantId: string,
  patientId: string,
  options?: { supabase?: SupabaseClient }
): Promise<NotificationDevice[]> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_patient_notification_devices")
    .select(
      "id, tenant_id, patient_id, platform, provider, provider_token, token_fingerprint, device_label, app_version, environment, created_at, last_seen_at, disabled_at"
    )
    .eq("tenant_id", tenantId)
    .eq("patient_id", patientId)
    .is("disabled_at", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map(mapDeviceDbRow);
}

export async function disableDeviceById(
  deviceId: string,
  options?: { supabase?: SupabaseClient; nowIso?: string; reason?: string }
): Promise<void> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const nowIso = options?.nowIso ?? new Date().toISOString();
  void options?.reason;
  await supabase
    .from("fi_patient_notification_devices")
    .update({ disabled_at: nowIso })
    .eq("id", deviceId)
    .is("disabled_at", null);
}
