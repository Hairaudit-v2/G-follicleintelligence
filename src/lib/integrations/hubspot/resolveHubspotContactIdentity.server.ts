import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeEmail } from "@/src/lib/fi/foundation/normalize";

export const HUBSPOT_CONTACT_SOURCE = "hubspot";
export const HUBSPOT_DEAL_SOURCE = "hubspot_deal";

export type HubspotIdentityInput = {
  hubspotContactId?: string | null;
  email?: string | null;
  hubspotDealId?: string | null;
  crmLeadId?: string | null;
};

export type HubspotMatchStrategy =
  | "crm_lead_link"
  | "hubspot_deal_id"
  | "hubspot_contact_id"
  | "email";

export type ResolvedHubspotIdentity = {
  person_id: string | null;
  patient_id: string | null;
  crm_lead_id: string | null;
  matchedBy: HubspotMatchStrategy;
};

async function patientIdForPerson(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("fi_patients")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

async function loadLead(
  supabase: SupabaseClient,
  tenantId: string,
  leadId: string
): Promise<{ id: string; person_id: string | null; patient_id: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, person_id, patient_id")
    .eq("tenant_id", tenantId)
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; person_id: string | null; patient_id: string | null };
  return {
    id: String(row.id),
    person_id: row.person_id ? String(row.person_id) : null,
    patient_id: row.patient_id ? String(row.patient_id) : null,
  };
}

/** Most-active CRM lead for a person (newest), to attach lead context to a contact/email event. */
async function leadForPerson(
  supabase: SupabaseClient,
  tenantId: string,
  personId: string
): Promise<{ id: string; patient_id: string | null } | null> {
  const { data, error } = await supabase
    .from("fi_crm_leads")
    .select("id, patient_id, updated_at")
    .eq("tenant_id", tenantId)
    .eq("person_id", personId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as { id: string; patient_id: string | null };
  return { id: String(row.id), patient_id: row.patient_id ? String(row.patient_id) : null };
}

/**
 * Resolve a HubSpot contact to FI person / patient / lead anchors WITHOUT mutating any record.
 *
 * Match precedence:
 *   1. Explicit CRM lead link (`crm_lead_id`).
 *   2. HubSpot deal id → fi_crm_lead_source_ids(source_system='hubspot_deal') → lead.
 *   3. HubSpot contact id → fi_person_source_ids(source_system='hubspot') → person.
 *   4. Email → fi_persons.metadata.email_normalized.
 *
 * Returns `null` when nothing matches (caller treats this as a safe no-op).
 */
export async function resolveHubspotContactIdentity(
  supabase: SupabaseClient,
  tenantId: string,
  input: HubspotIdentityInput
): Promise<ResolvedHubspotIdentity | null> {
  const tid = tenantId.trim();

  // 1. Explicit CRM lead link.
  const leadId = input.crmLeadId?.trim();
  if (leadId) {
    const lead = await loadLead(supabase, tid, leadId);
    if (lead) {
      const patient = lead.patient_id ?? (lead.person_id ? await patientIdForPerson(supabase, tid, lead.person_id) : null);
      return { person_id: lead.person_id, patient_id: patient, crm_lead_id: lead.id, matchedBy: "crm_lead_link" };
    }
  }

  // 2. HubSpot deal id → lead.
  const dealId = input.hubspotDealId?.trim();
  if (dealId) {
    const { data, error } = await supabase
      .from("fi_crm_lead_source_ids")
      .select("lead_id")
      .eq("tenant_id", tid)
      .eq("source_system", HUBSPOT_DEAL_SOURCE)
      .eq("source_lead_id", dealId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const lead = await loadLead(supabase, tid, String((data as { lead_id: string }).lead_id));
      if (lead) {
        const patient =
          lead.patient_id ?? (lead.person_id ? await patientIdForPerson(supabase, tid, lead.person_id) : null);
        return { person_id: lead.person_id, patient_id: patient, crm_lead_id: lead.id, matchedBy: "hubspot_deal_id" };
      }
    }
  }

  // 3. HubSpot contact id → person.
  const contactId = input.hubspotContactId?.trim();
  if (contactId) {
    const { data, error } = await supabase
      .from("fi_person_source_ids")
      .select("person_id")
      .eq("tenant_id", tid)
      .eq("source_system", HUBSPOT_CONTACT_SOURCE)
      .eq("source_person_id", contactId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const personId = String((data as { person_id: string }).person_id);
      const [patient, lead] = await Promise.all([
        patientIdForPerson(supabase, tid, personId),
        leadForPerson(supabase, tid, personId),
      ]);
      return {
        person_id: personId,
        patient_id: patient ?? lead?.patient_id ?? null,
        crm_lead_id: lead?.id ?? null,
        matchedBy: "hubspot_contact_id",
      };
    }
  }

  // 4. Email → person via normalized email stored on fi_persons.metadata.
  const email = normalizeEmail(input.email ?? null);
  if (email) {
    const { data, error } = await supabase
      .from("fi_persons")
      .select("id")
      .eq("tenant_id", tid)
      .eq("metadata->>email_normalized", email)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data) {
      const personId = String((data as { id: string }).id);
      const [patient, lead] = await Promise.all([
        patientIdForPerson(supabase, tid, personId),
        leadForPerson(supabase, tid, personId),
      ]);
      return {
        person_id: personId,
        patient_id: patient ?? lead?.patient_id ?? null,
        crm_lead_id: lead?.id ?? null,
        matchedBy: "email",
      };
    }
  }

  return null;
}
