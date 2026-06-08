import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function insertPrescriptionStatusAuditEvent(opts: {
  tenantId: string;
  prescriptionId: string;
  fromStatus: string | null;
  toStatus: string;
  actorFiUserId: string;
  note?: string | null;
}): Promise<void> {
  const supabase = supabaseAdmin();
  const { error } = await supabase.from("fi_prescription_status_events").insert({
    tenant_id: opts.tenantId.trim(),
    prescription_id: opts.prescriptionId.trim(),
    from_status: opts.fromStatus,
    to_status: opts.toStatus,
    actor_fi_user_id: opts.actorFiUserId.trim(),
    note: opts.note ?? null,
  });
  if (error) throw new Error(error.message);
}
