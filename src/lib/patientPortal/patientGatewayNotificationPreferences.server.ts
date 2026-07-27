/**
 * FI-PATIENT-APP-1F — notification preferences stored in fi_patients.metadata.
 * Does not alter reminder_consent / preferred_contact_method staff fields.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { patientGatewayDeny } from "./patientGatewayGateCore";
import {
  NOTIFICATION_PREFERENCES_METADATA_KEY,
  applyNotificationPreferencesPatch,
  seedPreferencesFromPatientContact,
  type PatientGatewayNotificationPreferences,
} from "./patientGatewayNotificationCore";
import type { PatientGatewayContext, PatientGatewayDeny } from "./patientGatewayTypes";

export type PatientGatewayNotificationPreferencesOptions = {
  supabase?: SupabaseClient;
  writeAudit?: boolean;
};

function asMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
  return {};
}

export async function loadPatientGatewayNotificationPreferences(
  ctx: PatientGatewayContext,
  options?: PatientGatewayNotificationPreferencesOptions
): Promise<
  | { ok: true; preferences: PatientGatewayNotificationPreferences }
  | PatientGatewayDeny
> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  try {
    const { data, error } = await supabase
      .from("fi_patients")
      .select("id, tenant_id, metadata, reminder_consent, preferred_contact_method")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", ctx.patientId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      const deny = patientGatewayDeny("not_found", 404, "Patient not found.");
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "notification_preferences_read",
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

    const meta = asMeta((data as { metadata?: unknown }).metadata);
    const preferences = seedPreferencesFromPatientContact({
      reminderConsent: (data as { reminder_consent?: boolean | null }).reminder_consent,
      preferredContactMethod: (data as { preferred_contact_method?: string | null })
        .preferred_contact_method,
      stored: meta[NOTIFICATION_PREFERENCES_METADATA_KEY],
    });

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "notification_preferences_read",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
      });
    }
    return { ok: true, preferences };
  } catch {
    const deny = patientGatewayDeny("misconfigured", 500, "Could not load notification preferences.");
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "notification_preferences_read",
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

export async function updatePatientGatewayNotificationPreferences(
  ctx: PatientGatewayContext,
  patch: Record<string, unknown>,
  options?: PatientGatewayNotificationPreferencesOptions
): Promise<
  | { ok: true; preferences: PatientGatewayNotificationPreferences }
  | PatientGatewayDeny
> {
  const writeAudit = options?.writeAudit !== false;
  const supabase = options?.supabase ?? supabaseAdmin();

  try {
    const current = await loadPatientGatewayNotificationPreferences(ctx, {
      supabase,
      writeAudit: false,
    });
    if (!current.ok) {
      if (writeAudit) {
        writePatientGatewayAudit({
          action: "notification_preferences_updated",
          outcome: "deny",
          code: current.code,
          authUserId: ctx.authUserId,
          patientId: ctx.patientId,
          tenantId: ctx.tenantId,
          resourceKind: "notification",
        });
      }
      return current;
    }

    const next = applyNotificationPreferencesPatch(current.preferences, patch);

    const { data: row, error: re } = await supabase
      .from("fi_patients")
      .select("metadata")
      .eq("tenant_id", ctx.tenantId)
      .eq("id", ctx.patientId)
      .maybeSingle();
    if (re) throw new Error(re.message);
    if (!row) {
      return patientGatewayDeny("not_found", 404, "Patient not found.");
    }

    const meta = asMeta((row as { metadata?: unknown }).metadata);
    const { error: ue } = await supabase
      .from("fi_patients")
      .update({
        metadata: {
          ...meta,
          [NOTIFICATION_PREFERENCES_METADATA_KEY]: next,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", ctx.tenantId)
      .eq("id", ctx.patientId);
    if (ue) throw new Error(ue.message);

    if (writeAudit) {
      writePatientGatewayAudit({
        action: "notification_preferences_updated",
        outcome: "allow",
        authUserId: ctx.authUserId,
        patientId: ctx.patientId,
        tenantId: ctx.tenantId,
        resourceKind: "notification",
      });
    }
    return { ok: true, preferences: next };
  } catch {
    const deny = patientGatewayDeny(
      "misconfigured",
      500,
      "Could not update notification preferences."
    );
    if (writeAudit) {
      writePatientGatewayAudit({
        action: "notification_preferences_updated",
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
