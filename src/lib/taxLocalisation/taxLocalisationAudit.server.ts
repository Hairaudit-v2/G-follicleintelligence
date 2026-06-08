import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiTaxLocalisationAuditEventKind =
  | "tax_settings.created"
  | "tax_settings.updated"
  | "invoice_settings.updated";

export async function insertFiTaxLocalisationAuditEvent(opts: {
  tenantId: string;
  clinicId: string | null;
  eventKind: FiTaxLocalisationAuditEventKind;
  actorFiUserId: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_tax_localisation_audit_events").insert({
    tenant_id: opts.tenantId.trim(),
    clinic_id: opts.clinicId?.trim() || null,
    event_kind: opts.eventKind,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    detail: opts.detail && typeof opts.detail === "object" ? opts.detail : {},
  });
  if (error) {
    console.error("[insertFiTaxLocalisationAuditEvent]", error.message);
  }
}
