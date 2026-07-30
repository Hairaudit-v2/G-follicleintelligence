/**
 * FI-PATIENT-APP-2G — provider-neutral patient notification dispatch.
 *
 * Flow: policy → preferences → active devices → provider adapter → result.
 * Does not send email/SMS (ReminderOS owns those). Push-only fan-out for now.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { sendExpoPushNotification } from "./adapters/expoPushAdapter.server";
import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { shouldSuppressPatientAppPushForPatient } from "./patientAppPilotControls.server";
import {
  buildNotificationDedupeKey,
  buildSafePushDataPayload,
} from "./patientGatewayDeviceCore";
import {
  disableDeviceById,
  listActiveDevicesForPatient,
} from "./patientGatewayDevices.server";
import {
  buildPrivacySafeNotificationPreview,
  buildPrivacySafeNotificationTitle,
  decideNotificationDispatch,
  notificationAndroidChannelId,
  type PatientGatewayNotificationEvent,
} from "./patientGatewayNotificationCore";
import { loadPatientGatewayNotificationPreferences } from "./patientGatewayNotificationPreferences.server";
import type { PatientGatewayContext } from "./patientGatewayTypes";

export type SendPatientNotificationInput = {
  patientId: string;
  tenantId: string;
  eventType: PatientGatewayNotificationEvent;
  /** Stable source entity id (message id, booking id, invoice id, etc.). */
  sourceEntity: string;
  resourceId?: string | null;
  stateVersion?: string | null;
  /** Optional auth user for audit when available. */
  authUserId?: string | null;
};

export type SendPatientNotificationResult = {
  attempted: boolean;
  sent: number;
  skippedReason: string | null;
  dedupeKey: string;
};

export type SendPatientNotificationOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
  /** Injected for tests. */
  sendPush?: typeof sendExpoPushNotification;
};

async function claimDedupe(input: {
  supabase: SupabaseClient;
  tenantId: string;
  patientId: string;
  eventType: string;
  channel: "push";
  dedupeKey: string;
}): Promise<"claimed" | "duplicate"> {
  const { error } = await input.supabase.from("fi_patient_notification_dispatch_log").insert({
    tenant_id: input.tenantId,
    patient_id: input.patientId,
    event_type: input.eventType,
    channel: input.channel,
    dedupe_key: input.dedupeKey,
    status: "skipped",
    skip_reason: "in_flight",
    metadata: {},
  });
  if (error) {
    // Unique violation → already dispatched / in flight.
    if (String(error.message).toLowerCase().includes("duplicate") || error.code === "23505") {
      return "duplicate";
    }
    throw new Error(error.message);
  }
  return "claimed";
}

async function finalizeDedupe(input: {
  supabase: SupabaseClient;
  tenantId: string;
  patientId: string;
  dedupeKey: string;
  status: "sent" | "skipped" | "failed";
  skipReason?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await input.supabase
    .from("fi_patient_notification_dispatch_log")
    .update({
      status: input.status,
      skip_reason: input.skipReason ?? null,
      metadata: input.metadata ?? {},
    })
    .eq("tenant_id", input.tenantId)
    .eq("patient_id", input.patientId)
    .eq("channel", "push")
    .eq("dedupe_key", input.dedupeKey);
}

/**
 * Dispatch a privacy-safe patient push when policy + preferences + devices allow.
 */
export async function sendPatientNotification(
  input: SendPatientNotificationInput,
  options?: SendPatientNotificationOptions
): Promise<SendPatientNotificationResult> {
  const supabase = options?.supabase ?? supabaseAdmin();
  const writeAudit = options?.writeAudit !== false;
  const sendPush = options?.sendPush ?? sendExpoPushNotification;
  const dedupeKey = buildNotificationDedupeKey({
    eventType: input.eventType,
    sourceEntity: input.sourceEntity,
    stateVersion: input.stateVersion,
  });

  const ctx: PatientGatewayContext = {
    authUserId: input.authUserId?.trim() || "system",
    patientId: input.patientId,
    tenantId: input.tenantId,
    personId: "",
    patientStatus: "active",
    clinicName: null,
  };

  if (writeAudit) {
    writePatientGatewayAudit({
      action: "patient_notification_dispatch_requested",
      outcome: "allow",
      authUserId: input.authUserId ?? null,
      patientId: input.patientId,
      tenantId: input.tenantId,
      resourceKind: "notification",
      resourceId: input.sourceEntity,
    });
  }

  if (
    await shouldSuppressPatientAppPushForPatient(
      { tenantId: input.tenantId, patientId: input.patientId },
      { supabase, writeAudit: false }
    )
  ) {
    return {
      attempted: false,
      sent: 0,
      skippedReason: "pilot_or_access_suppressed",
      dedupeKey,
    };
  }

  const claim = await claimDedupe({
    supabase,
    tenantId: input.tenantId,
    patientId: input.patientId,
    eventType: input.eventType,
    channel: "push",
    dedupeKey,
  });
  if (claim === "duplicate") {
    return {
      attempted: false,
      sent: 0,
      skippedReason: "dedupe",
      dedupeKey,
    };
  }

  try {
    const prefs = await loadPatientGatewayNotificationPreferences(ctx, {
      supabase,
      writeAudit: false,
    });
    if (!prefs.ok) {
      await finalizeDedupe({
        supabase,
        tenantId: input.tenantId,
        patientId: input.patientId,
        dedupeKey,
        status: "skipped",
        skipReason: "prefs_unavailable",
      });
      return {
        attempted: false,
        sent: 0,
        skippedReason: "prefs_unavailable",
        dedupeKey,
      };
    }

    const decision = decideNotificationDispatch({
      event: input.eventType,
      preferences: prefs.preferences,
    });

    if (!decision.channels.includes("push")) {
      await finalizeDedupe({
        supabase,
        tenantId: input.tenantId,
        patientId: input.patientId,
        dedupeKey,
        status: "skipped",
        skipReason: decision.skippedReason ?? "push_not_selected",
      });
      return {
        attempted: false,
        sent: 0,
        skippedReason: decision.skippedReason ?? "push_not_selected",
        dedupeKey,
      };
    }

    const devices = await listActiveDevicesForPatient(input.tenantId, input.patientId, {
      supabase,
    });
    if (devices.length === 0) {
      await finalizeDedupe({
        supabase,
        tenantId: input.tenantId,
        patientId: input.patientId,
        dedupeKey,
        status: "skipped",
        skipReason: "no_active_devices",
      });
      return {
        attempted: false,
        sent: 0,
        skippedReason: "no_active_devices",
        dedupeKey,
      };
    }

    const title = buildPrivacySafeNotificationTitle(input.eventType);
    const body = buildPrivacySafeNotificationPreview(input.eventType);
    const data = buildSafePushDataPayload({
      eventType: input.eventType,
      resourceId: input.resourceId ?? input.sourceEntity,
    });
    const channelId = notificationAndroidChannelId(input.eventType);

    let sent = 0;
    let anyInvalid = false;
    let anyTempFail = false;

    for (const device of devices) {
      if (device.provider !== "expo") {
        // Future FCM/APNs adapters — skip unknown providers safely.
        continue;
      }
      const result = await sendPush({
        providerToken: device.providerToken,
        title,
        body,
        data,
        channelId,
      });
      if (result.ok) {
        sent += 1;
        continue;
      }
      if (result.kind === "invalid_token") {
        anyInvalid = true;
        await disableDeviceById(device.id, {
          supabase,
          reason: "provider_invalid_token",
        });
        if (writeAudit) {
          writePatientGatewayAudit({
            action: "patient_notification_token_invalidated",
            outcome: "allow",
            patientId: input.patientId,
            tenantId: input.tenantId,
            resourceKind: "notification",
            resourceId: device.id,
          });
        }
      } else if (result.kind === "temporary") {
        anyTempFail = true;
      }
    }

    if (sent > 0) {
      await finalizeDedupe({
        supabase,
        tenantId: input.tenantId,
        patientId: input.patientId,
        dedupeKey,
        status: "sent",
        metadata: { sent, devices: devices.length },
      });
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "patient_notification_sent",
          outcome: "allow",
          patientId: input.patientId,
          tenantId: input.tenantId,
          resourceKind: "notification",
          resourceId: input.sourceEntity,
        });
      }
      return { attempted: true, sent, skippedReason: null, dedupeKey };
    }

    const skipReason = anyInvalid
      ? "all_tokens_invalid"
      : anyTempFail
        ? "temporary_failure"
        : "no_compatible_devices";
    await finalizeDedupe({
      supabase,
      tenantId: input.tenantId,
      patientId: input.patientId,
      dedupeKey,
      status: "failed",
      skipReason,
    });
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_notification_failed",
        outcome: "deny",
        patientId: input.patientId,
        tenantId: input.tenantId,
        resourceKind: "notification",
        resourceId: input.sourceEntity,
      });
    }
    return { attempted: true, sent: 0, skippedReason: skipReason, dedupeKey };
  } catch {
    await finalizeDedupe({
      supabase,
      tenantId: input.tenantId,
      patientId: input.patientId,
      dedupeKey,
      status: "failed",
      skipReason: "dispatch_error",
    }).catch(() => undefined);
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "patient_notification_failed",
        outcome: "deny",
        patientId: input.patientId,
        tenantId: input.tenantId,
        resourceKind: "notification",
        resourceId: input.sourceEntity,
      });
    }
    return {
      attempted: true,
      sent: 0,
      skippedReason: "dispatch_error",
      dedupeKey,
    };
  }
}

/** Best-effort wrapper for event hooks — never throws into callers. */
export async function sendPatientNotificationBestEffort(
  input: SendPatientNotificationInput,
  options?: SendPatientNotificationOptions
): Promise<void> {
  try {
    await sendPatientNotification(input, options);
  } catch {
    /* best-effort */
  }
}
