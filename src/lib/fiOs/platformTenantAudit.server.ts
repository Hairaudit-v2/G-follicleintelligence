import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type FiPlatformTenantAuditEventKind =
  | "tenant.archived"
  | "tenant.restored"
  | "tenant.demo_marked";

export async function insertFiPlatformTenantAuditEvent(
  opts: {
    tenantId: string;
    eventKind: FiPlatformTenantAuditEventKind;
    actorAuthUserId: string | null;
    detail?: Record<string, unknown>;
  },
  clientOpts?: { supabaseClientForTests?: SupabaseClient }
): Promise<{ ok: true } | { ok: false; message: string }> {
  const supabase = clientOpts?.supabaseClientForTests ?? supabaseAdmin();
  const { error } = await supabase.from("fi_platform_tenant_audit_events").insert({
    tenant_id: opts.tenantId.trim(),
    event_kind: opts.eventKind,
    actor_auth_user_id: opts.actorAuthUserId?.trim() || null,
    detail: opts.detail && typeof opts.detail === "object" ? opts.detail : {},
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
