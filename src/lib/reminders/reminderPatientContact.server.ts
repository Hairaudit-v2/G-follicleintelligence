import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { extractPersonIdentitySignals } from "@/src/lib/crm/crmLeadConversionIdentity";
import { formatPhoneForTwilio, type PatientReminderContact } from "./reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "./reminderDeliveryConfig.server";

export type { PatientReminderContact } from "./reminderDeliveryConfig";
export { patientHasContactForTemplateType } from "./reminderDeliveryConfig";

export async function loadPatientReminderContact(
  supabase: SupabaseClient,
  tenantId: string,
  patientId: string
): Promise<PatientReminderContact | null> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  const { data: pat, error: pe } = await supabase
    .from("fi_patients")
    .select("person_id")
    .eq("tenant_id", tid)
    .eq("id", pid)
    .maybeSingle();
  if (pe) throw new Error(pe.message);
  if (!pat) return null;

  const personId = String((pat as { person_id: string }).person_id);
  const { data: person, error: perr } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tid)
    .eq("id", personId)
    .maybeSingle();
  if (perr) throw new Error(perr.message);
  if (!person) return null;

  const meta =
    (person as { metadata?: Record<string, unknown> }).metadata &&
    typeof (person as { metadata?: Record<string, unknown> }).metadata === "object" &&
    !Array.isArray((person as { metadata?: Record<string, unknown> }).metadata)
      ? ((person as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {};

  const signals = extractPersonIdentitySignals(meta);
  const phoneRaw = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  const deliveryCfg = loadReminderDeliveryConfig();
  const phoneE164 = phoneRaw
    ? formatPhoneForTwilio(phoneRaw, deliveryCfg.twilio.defaultCountryCode)
    : signals.phoneDigits
      ? formatPhoneForTwilio(signals.phoneDigits, deliveryCfg.twilio.defaultCountryCode)
      : null;

  return {
    email: signals.emailNormalized,
    phone: phoneRaw,
    phoneE164,
  };
}
