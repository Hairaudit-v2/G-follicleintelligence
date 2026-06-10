import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveOrCreatePatient } from "@/src/lib/fi/foundation/resolvePatient";
import { resolveOrCreatePerson } from "@/src/lib/fi/foundation/resolvePerson";
import { shallowMergeMetadata } from "@/src/lib/fi/foundation/internal";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import type { z } from "zod";
import type { timelyPatientWebhookSchema } from "./timelyWebhookSchemas";
import { TimelyWebhookHttpError } from "./timelyWebhookHttp.server";

const SOURCE = "timely";

export type TimelyPatientWebhookPorts = {
  resolveOrCreatePerson: typeof resolveOrCreatePerson;
  resolveOrCreatePatient: typeof resolveOrCreatePatient;
};

const DEFAULT_PATIENT_PORTS: TimelyPatientWebhookPorts = {
  resolveOrCreatePerson,
  resolveOrCreatePatient,
};

export type TimelyPatientPayload = z.infer<typeof timelyPatientWebhookSchema>;

function buildDisplayName(payload: TimelyPatientPayload): string {
  const parts = [payload.first_name?.trim(), payload.last_name?.trim()].filter(Boolean);
  const joined = parts.join(" ").trim();
  return joined.length ? joined : "Timely patient";
}

async function assertTenantExists(supabase: SupabaseClient, tenantId: string): Promise<void> {
  const { data, error } = await supabase.from("fi_tenants").select("id").eq("id", tenantId.trim()).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new TimelyWebhookHttpError(404, "Tenant not found.");
}

/** Merge Timely fields into fi_persons / fi_patients metadata (non-destructive shallow merge). */
export function buildTimelyPersonPatientMetadataPatch(payload: TimelyPatientPayload): {
  personPatch: Record<string, unknown>;
  patientPatch: Record<string, unknown>;
} {
  const emailNorm = normalizeEmail(payload.email ?? null);
  const personPatch: Record<string, unknown> = {};
  if (payload.first_name?.trim()) personPatch.first_name = payload.first_name.trim();
  if (payload.last_name?.trim()) personPatch.last_name = payload.last_name.trim();
  if (payload.email?.trim()) personPatch.email = payload.email.trim();
  if (emailNorm) personPatch.email_normalized = emailNorm;
  if (payload.mobile?.trim()) personPatch.phone = payload.mobile.trim();
  if (payload.date_of_birth?.trim()) personPatch.date_of_birth = payload.date_of_birth.trim();

  const patientPatch: Record<string, unknown> = {};
  if (payload.notes != null && String(payload.notes).trim()) {
    patientPatch.timely_notes = String(payload.notes).trim();
  }
  return { personPatch, patientPatch };
}

export type ProcessTimelyPatientWebhookResult =
  | { ok: true; patient_id: string; person_id: string }
  | { ok: false; status: number; message: string };

/**
 * Idempotent patient upsert for Timely: `fi_patient_source_ids` keyed by (tenant, timely, external_id).
 */
export async function processTimelyPatientWebhook(
  tenantId: string,
  payload: TimelyPatientPayload,
  client?: SupabaseClient,
  ports: Partial<TimelyPatientWebhookPorts> = {}
): Promise<ProcessTimelyPatientWebhookResult> {
  const supabase = client ?? supabaseAdmin();
  const { resolveOrCreatePerson: rpcPerson, resolveOrCreatePatient: rpcPatient } = {
    ...DEFAULT_PATIENT_PORTS,
    ...ports,
  };
  const tid = tenantId.trim();
  try {
    await assertTenantExists(supabase, tid);
  } catch (e) {
    if (e instanceof TimelyWebhookHttpError) {
      return { ok: false, status: e.status, message: e.message };
    }
    const msg = e instanceof Error ? e.message : "Could not verify tenant.";
    return { ok: false, status: 500, message: msg };
  }

  const displayName = buildDisplayName(payload);
  const extId = payload.external_id.trim();

  try {
    const personRes = await rpcPerson(
      {
        tenant_id: tid,
        source_system: SOURCE,
        source_patient_id: extId,
        display_name: displayName,
        email: payload.email?.trim() || null,
        phone: payload.mobile?.trim() || null,
        date_of_birth: payload.date_of_birth?.trim() || null,
        metadata: { timely_webhook: true },
      },
      supabase
    );

    const patientRes = await rpcPatient(
      {
        tenant_id: tid,
        person_id: personRes.person.id,
        source_system: SOURCE,
        source_patient_id: extId,
        metadata: { timely_webhook: true },
      },
      supabase
    );

    const { personPatch, patientPatch } = buildTimelyPersonPatientMetadataPatch(payload);

    if (Object.keys(personPatch).length > 0) {
      const nextMeta = shallowMergeMetadata(personRes.person.metadata ?? {}, personPatch);
      const { error: pe } = await supabase
        .from("fi_persons")
        .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
        .eq("id", personRes.person.id)
        .eq("tenant_id", tid);
      if (pe) throw new Error(pe.message);
    }

    if (Object.keys(patientPatch).length > 0) {
      const nextPatientMeta = shallowMergeMetadata(patientRes.patient.metadata ?? {}, patientPatch);
      const { error: patE } = await supabase
        .from("fi_patients")
        .update({ metadata: nextPatientMeta, updated_at: new Date().toISOString() })
        .eq("id", patientRes.patient.id)
        .eq("tenant_id", tid);
      if (patE) throw new Error(patE.message);
    }

    return { ok: true, patient_id: patientRes.patient.id, person_id: personRes.person.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not upsert patient.";
    return { ok: false, status: 500, message: msg };
  }
}
