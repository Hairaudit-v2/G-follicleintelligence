import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { findPersonIdsWithEmailInTenant } from "@/src/lib/crm/crmLeadConversionIdentity";
import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";
import {
  counterpartyEmailForMatch,
  resolveGenericEmailMatch,
  type GenericEmailDirection,
  type GenericEmailMatchResolution,
} from "./genericEmailActivityCore";

export async function findCrmLeadIdsForPersonIdsInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  personIds: string[]
): Promise<string[]> {
  if (!personIds.length) return [];
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .in("person_id", personIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String((row as { id: string }).id));
}

export async function findPatientIdsForPersonIdsInTenant(
  supabase: SupabaseClient,
  tenantId: string,
  personIds: string[]
): Promise<string[]> {
  if (!personIds.length) return [];
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId.trim())
    .in("person_id", personIds);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => String((row as { id: string }).id));
}

export async function resolveGenericEmailActivityMatch(
  supabase: SupabaseClient,
  input: {
    tenantId: string;
    direction: GenericEmailDirection;
    fromEmail?: string | null;
    toEmails?: string[] | null;
    now?: Date;
  }
): Promise<GenericEmailMatchResolution> {
  const tid = input.tenantId.trim();
  const counterpartyEmail = counterpartyEmailForMatch(
    input.direction,
    input.fromEmail,
    input.toEmails
  );
  const normalized = normalizeEmail(counterpartyEmail);
  const personIds = normalized
    ? await findPersonIdsWithEmailInTenant(supabase, tid, normalized)
    : [];
  const leadIds = await findCrmLeadIdsForPersonIdsInTenant(supabase, tid, personIds);
  const patientIds = await findPatientIdsForPersonIdsInTenant(supabase, tid, personIds);

  return resolveGenericEmailMatch({
    counterpartyEmail: normalized,
    personIds,
    leadIds,
    patientIds,
    decidedAt: (input.now ?? new Date()).toISOString(),
  });
}
