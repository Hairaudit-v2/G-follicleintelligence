import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  sanitizeReceptionUsageEventContext,
  type ReceptionUsageEventContext,
  type ReceptionUsageEventKind,
} from "@/src/lib/receptionOs/receptionUsageEventModel";

/**
 * Append a tenant-scoped usage event. Never throws — tracking must not break dashboard flows.
 */
export async function trackReceptionUsageEvent(opts: {
  tenantId: string;
  profileId?: string | null;
  eventKind: ReceptionUsageEventKind;
  context?: ReceptionUsageEventContext;
}): Promise<void> {
  try {
    const tid = assertNonEmptyUuid(opts.tenantId, "tenantId").trim();
    const ctx = sanitizeReceptionUsageEventContext(opts.context);
    const supabase = supabaseAdmin();
    const { error } = await supabase.from("fi_reception_usage_events").insert({
      tenant_id: tid,
      profile_id: opts.profileId?.trim() || null,
      event_kind: opts.eventKind,
      operating_mode: ctx.operatingMode,
      widget_key: ctx.widgetKey,
      task_id: ctx.taskId,
      alert_kind: ctx.alertKind,
      source_ref_id: ctx.sourceRefId,
      metadata: ctx.metadata,
    });
    if (error) {
      console.error("[trackReceptionUsageEvent]", error.message);
    }
  } catch (e) {
    console.error("[trackReceptionUsageEvent]", e instanceof Error ? e.message : "unknown error");
  }
}

/** Fire-and-forget wrapper for non-blocking callers. */
export function trackReceptionUsageEventSafe(
  opts: Parameters<typeof trackReceptionUsageEvent>[0]
): void {
  void trackReceptionUsageEvent(opts);
}
