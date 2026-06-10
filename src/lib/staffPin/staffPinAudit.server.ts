import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiStaffPinAuditEventKind =
  | "staff_pin.login_success"
  | "staff_pin.login_failed"
  | "staff_pin.locked"
  | "staff_pin.set"
  | "staff_pin.reset"
  | "staff_pin.disabled"
  | "staff_pin.logout"
  | "staff_pin.reception_board_action";

export async function insertFiStaffPinAuditEvent(opts: {
  tenantId: string;
  eventKind: FiStaffPinAuditEventKind;
  staffId?: string | null;
  actorFiUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_staff_pin_audit_events").insert({
    tenant_id: opts.tenantId.trim(),
    event_kind: opts.eventKind,
    staff_id: opts.staffId?.trim() || null,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    detail: opts.detail && typeof opts.detail === "object" ? opts.detail : {},
  });
  if (error) {
    console.error("[insertFiStaffPinAuditEvent]", error.message);
  }
}
