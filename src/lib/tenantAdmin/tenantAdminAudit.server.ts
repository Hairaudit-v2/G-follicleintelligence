import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiTenantAdminAuditEventKind =
  | "admin_user.invited"
  | "admin_user.role_changed"
  | "admin_user.suspended"
  | "admin_user.reactivated"
  | "admin_user.removed";

export async function insertFiTenantAdminAuditEvent(opts: {
  tenantId: string;
  eventKind: FiTenantAdminAuditEventKind;
  actorFiUserId: string | null;
  subjectAdminUserId?: string | null;
  subjectFiUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_tenant_admin_audit_events").insert({
    tenant_id: opts.tenantId.trim(),
    event_kind: opts.eventKind,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    subject_admin_user_id: opts.subjectAdminUserId?.trim() || null,
    subject_fi_user_id: opts.subjectFiUserId?.trim() || null,
    detail: opts.detail && typeof opts.detail === "object" ? opts.detail : {},
  });
  if (error) {
    console.error("[insertFiTenantAdminAuditEvent]", error.message);
  }
}
