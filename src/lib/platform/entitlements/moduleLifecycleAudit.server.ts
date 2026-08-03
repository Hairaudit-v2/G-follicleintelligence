import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { HLI_TRICHOSCOPY_MODULE_KEY } from "@/src/lib/platform/entitlements/trichoscopyCapabilities";

export type ModuleLifecycleAuditInput = {
  tenantId: string;
  moduleKey?: string;
  capability?: string | null;
  eventType: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  actorUserId?: string | null;
  source?: string;
  reason?: string | null;
  subscriptionReference?: string | null;
  metadata?: Record<string, unknown>;
  supabaseClientForTests?: SupabaseClient;
};

export async function writeModuleLifecycleAudit(input: ModuleLifecycleAuditInput): Promise<void> {
  try {
    const supabase = input.supabaseClientForTests ?? supabaseAdmin();
    await supabase.from("fi_tenant_module_audit_log").insert({
      tenant_id: input.tenantId.trim(),
      module_key: (input.moduleKey ?? HLI_TRICHOSCOPY_MODULE_KEY).trim(),
      capability: input.capability ?? null,
      event_type: input.eventType.trim(),
      previous_state: input.previousState ?? null,
      new_state: input.newState ?? null,
      actor_user_id: input.actorUserId ?? null,
      source: input.source ?? "system",
      reason: input.reason ?? null,
      subscription_reference: input.subscriptionReference ?? null,
      metadata: input.metadata ?? {},
    });
  } catch {
    // Audit must not break clinical paths
  }
}
