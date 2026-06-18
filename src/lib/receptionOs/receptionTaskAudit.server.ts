import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReceptionTaskAuditEventKind } from "@/src/lib/receptionOs/receptionTaskPolicy";

export async function insertReceptionTaskAuditEvent(opts: {
  tenantId: string;
  taskId: string;
  eventKind: ReceptionTaskAuditEventKind;
  actorFiUserId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_reception_task_audit_events").insert({
    tenant_id: opts.tenantId.trim(),
    reception_task_id: opts.taskId.trim(),
    event_kind: opts.eventKind,
    actor_fi_user_id: opts.actorFiUserId?.trim() || null,
    detail: opts.detail && typeof opts.detail === "object" ? opts.detail : {},
  });
  if (error) {
    console.error("[insertReceptionTaskAuditEvent]", error.message);
  }
}
