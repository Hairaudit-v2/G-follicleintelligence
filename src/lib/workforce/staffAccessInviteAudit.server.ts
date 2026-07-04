import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const STAFF_ACCESS_AUDIT_EVENTS = {
  INVITE_SENT: "staff_access_invite_sent",
  INVITE_RESENT: "staff_access_invite_resent",
  INVITE_ACCEPTED: "staff_access_invite_accepted",
  INVITE_LINK_REPAIRED: "staff_access_invite_link_repaired",
  PIN_SETUP_LINK_CREATED: "staff_pin_setup_link_created",
  PIN_RESET_REQUESTED: "staff_pin_reset_requested",
  PIN_RESET_COMPLETED: "staff_pin_reset_completed",
} as const;

export type StaffAccessAuditEventType =
  (typeof STAFF_ACCESS_AUDIT_EVENTS)[keyof typeof STAFF_ACCESS_AUDIT_EVENTS];

const STAFF_ACCESS_AUDIT_SOURCE = "workforce_staff_access_centre";

export async function insertStaffAccessAuditEvent(input: {
  tenantId: string;
  staffMemberId: string;
  eventType: StaffAccessAuditEventType;
  actorFiUserId?: string | null;
  metadata?: Record<string, unknown>;
  client?: SupabaseClient;
}): Promise<void> {
  const supabase = input.client ?? supabaseAdmin();
  const { error } = await supabase.from("fi_staff_member_audit_events").insert({
    tenant_id: input.tenantId.trim(),
    staff_member_id: input.staffMemberId.trim(),
    event_type: input.eventType,
    source: STAFF_ACCESS_AUDIT_SOURCE,
    metadata: {
      ...(input.metadata ?? {}),
      ...(input.actorFiUserId?.trim() ? { actor_fi_user_id: input.actorFiUserId.trim() } : {}),
    },
  });
  if (error) {
    console.error("[insertStaffAccessAuditEvent]", error.message);
  }
}
