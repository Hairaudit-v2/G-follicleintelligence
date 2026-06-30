import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { extractPersonIdentitySignals } from "@/src/lib/crm/crmLeadConversionIdentity";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { formatPhoneForTwilio } from "@/src/lib/reminders/reminderDeliveryConfig";
import { loadReminderDeliveryConfig } from "@/src/lib/reminders/reminderDeliveryConfig.server";
import { loadPatientReminderContact } from "@/src/lib/reminders/reminderPatientContact.server";

export type ReceptionCommunicationContactSubject = {
  leadId: string | null;
  patientId: string | null;
  email: string | null;
  phoneE164: string | null;
};

async function loadPersonContact(
  tenantId: string,
  personId: string
): Promise<{ email: string | null; phoneE164: string | null }> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("fi_persons")
    .select("metadata")
    .eq("tenant_id", tenantId)
    .eq("id", personId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { email: null, phoneE164: null };

  const meta =
    (data as { metadata?: Record<string, unknown> }).metadata &&
    typeof (data as { metadata?: Record<string, unknown> }).metadata === "object" &&
    !Array.isArray((data as { metadata?: Record<string, unknown> }).metadata)
      ? ((data as { metadata: Record<string, unknown> }).metadata as Record<string, unknown>)
      : {};

  const signals = extractPersonIdentitySignals(meta);
  const phoneRaw = typeof meta.phone === "string" ? meta.phone.trim() || null : null;
  const cfg = loadReminderDeliveryConfig();
  const phoneE164 = phoneRaw
    ? formatPhoneForTwilio(phoneRaw, cfg.twilio.defaultCountryCode)
    : signals.phoneDigits
      ? formatPhoneForTwilio(signals.phoneDigits, cfg.twilio.defaultCountryCode)
      : null;

  return { email: signals.emailNormalized, phoneE164 };
}

export async function resolveReceptionCommunicationContactSubject(
  tenantId: string,
  context: { leadId?: string | null; taskId?: string | null; patientId?: string | null }
): Promise<ReceptionCommunicationContactSubject> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();
  const supabase = supabaseAdmin();

  let leadId = context.leadId?.trim() || null;
  let patientId = context.patientId?.trim() || null;

  if (context.taskId?.trim()) {
    const { data } = await supabase
      .from("fi_reception_tasks")
      .select("lead_id, patient_id")
      .eq("tenant_id", tid)
      .eq("id", context.taskId.trim())
      .maybeSingle();
    if (data) {
      leadId = leadId ?? (data as { lead_id: string | null }).lead_id?.trim() ?? null;
      patientId = patientId ?? (data as { patient_id: string | null }).patient_id?.trim() ?? null;
    }
  }

  if (leadId && !patientId) {
    const { data } = await supabase
      .from("fi_crm_leads")
      .select("patient_id, person_id")
      .eq("tenant_id", tid)
      .eq("id", leadId)
      .maybeSingle();
    if (data) {
      patientId = (data as { patient_id: string | null }).patient_id?.trim() ?? null;
      if (!patientId) {
        const personId = (data as { person_id: string }).person_id;
        const personContact = await loadPersonContact(tid, personId);
        return {
          leadId,
          patientId: null,
          email: personContact.email,
          phoneE164: personContact.phoneE164,
        };
      }
    }
  }

  if (patientId) {
    const contact = await loadPatientReminderContact(supabase, tid, patientId);
    return {
      leadId,
      patientId,
      email: contact?.email ?? null,
      phoneE164: contact?.phoneE164 ?? null,
    };
  }

  if (leadId) {
    const { data } = await supabase
      .from("fi_crm_leads")
      .select("person_id")
      .eq("tenant_id", tid)
      .eq("id", leadId)
      .maybeSingle();
    if (data) {
      const personContact = await loadPersonContact(
        tid,
        String((data as { person_id: string }).person_id)
      );
      return { leadId, patientId: null, ...personContact };
    }
  }

  return { leadId, patientId: null, email: null, phoneE164: null };
}

export function resolveReceptionCommunicationToAddress(
  channel: "sms" | "email",
  explicit: string | null | undefined,
  subject: ReceptionCommunicationContactSubject
): string | null {
  const direct = explicit?.trim();
  if (direct) return direct;
  return channel === "email"
    ? (subject.email?.trim() ?? null)
    : (subject.phoneE164?.trim() ?? null);
}
