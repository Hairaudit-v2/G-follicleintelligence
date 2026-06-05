import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertAdminNoteWithinBounds, normalizePatientStatus } from "./patientPolicy";

export type UpdatePatientAdminDetailsParams = {
  tenantId: string;
  patientId: string;
  patient_status?: string | null;
  admin_note?: string | null;
  reminder_consent?: boolean | null;
  preferred_contact_method?: string | null;
};

export async function updatePatientAdminDetails(
  params: UpdatePatientAdminDetailsParams,
  client?: SupabaseClient
): Promise<{
  id: string;
  patient_status: string;
  admin_note: string | null;
  reminder_consent: boolean;
  preferred_contact_method: string | null;
  updated_at: string;
}> {
  const supabase = client ?? supabaseAdmin();
  const tid = params.tenantId.trim();
  const pid = params.patientId.trim();
  if (!tid || !pid) throw new Error("tenantId and patientId are required.");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (params.patient_status !== undefined && params.patient_status !== null) {
    updates.patient_status = normalizePatientStatus(params.patient_status);
  }
  if (params.admin_note !== undefined) {
    const raw = params.admin_note;
    updates.admin_note =
      raw === null || raw === "" ? null : assertAdminNoteWithinBounds(typeof raw === "string" ? raw : String(raw));
  }
  if (params.reminder_consent !== undefined) {
    updates.reminder_consent = Boolean(params.reminder_consent);
  }
  if (params.preferred_contact_method !== undefined) {
    const raw = params.preferred_contact_method;
    if (raw === null || raw === "") {
      updates.preferred_contact_method = null;
    } else {
      const t = String(raw).trim().toLowerCase();
      if (!["email", "sms", "both"].includes(t)) {
        throw new Error("preferred_contact_method must be email, sms, both, or null.");
      }
      updates.preferred_contact_method = t;
    }
  }

  const { data, error } = await supabase
    .from("fi_patients")
    .update(updates)
    .eq("tenant_id", tid)
    .eq("id", pid)
    .select("id, patient_status, admin_note, reminder_consent, preferred_contact_method, updated_at")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Patient update returned no row.");

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    patient_status: String(row.patient_status ?? "active"),
    admin_note: row.admin_note != null ? String(row.admin_note) : null,
    reminder_consent: Boolean(row.reminder_consent),
    preferred_contact_method: row.preferred_contact_method != null ? String(row.preferred_contact_method) : null,
    updated_at: String(row.updated_at),
  };
}
