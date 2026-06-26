import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { FiEventBusHealthClientModel, FiEventBusHealthStatus } from "./fiEventBusHealthCore";
export type { FiEventBusHealthClientModel as FiEventBusHealthSummary } from "./fiEventBusHealthCore";

type ServerOpts = {
  supabaseClientForTests?: SupabaseClient;
  nowMs?: number;
};

function deriveHealthStatus(
  emittedLast24h: number,
  pendingDeliveries: number,
  failedDeliveries: number
): FiEventBusHealthStatus {
  if (failedDeliveries >= 5) return "failing";
  if (failedDeliveries > 0 || pendingDeliveries >= 10) return "degraded";
  if (emittedLast24h === 0 && pendingDeliveries === 0 && failedDeliveries === 0) return "healthy";
  return "healthy";
}

/** Load FI Event Bus health summary for FI Admin diagnostics (tenant-scoped). */
export async function loadFiEventBusHealthForTenant(
  tenantId: string,
  opts: ServerOpts = {}
): Promise<FiEventBusHealthClientModel> {
  const supabase = opts.supabaseClientForTests ?? supabaseAdmin();
  const tid = tenantId.trim();
  const nowMs = opts.nowMs ?? Date.now();
  const sinceIso = new Date(nowMs - 24 * 60 * 60 * 1000).toISOString();

  const { count: emittedLast24h, error: emittedError } = await supabase
    .from("fi_platform_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .gte("occurred_at", sinceIso);

  if (emittedError) throw new Error(emittedError.message);

  const { count: pendingDeliveries, error: pendingError } = await supabase
    .from("fi_platform_event_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .in("status", ["pending", "processing"]);

  if (pendingError) throw new Error(pendingError.message);

  const { count: failedDeliveries, error: failedError } = await supabase
    .from("fi_platform_event_deliveries")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tid)
    .eq("status", "failed");

  if (failedError) throw new Error(failedError.message);

  const { data: lastEvent, error: lastEventError } = await supabase
    .from("fi_platform_events")
    .select("event_name, occurred_at")
    .eq("tenant_id", tid)
    .order("occurred_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastEventError) throw new Error(lastEventError.message);

  const { data: lastFailedDelivery, error: lastFailedError } = await supabase
    .from("fi_platform_event_deliveries")
    .select("last_error, updated_at, event_id")
    .eq("tenant_id", tid)
    .eq("status", "failed")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastFailedError) throw new Error(lastFailedError.message);

  let lastFailure: FiEventBusHealthClientModel["lastFailure"] = null;
  if (lastFailedDelivery?.event_id) {
    const { data: failedEvent } = await supabase
      .from("fi_platform_events")
      .select("event_name")
      .eq("id", lastFailedDelivery.event_id)
      .eq("tenant_id", tid)
      .maybeSingle();

    lastFailure = {
      eventName: (failedEvent as { event_name: string } | null)?.event_name ?? "unknown",
      error: (lastFailedDelivery as { last_error: string | null }).last_error,
      at: (lastFailedDelivery as { updated_at: string }).updated_at,
    };
  }

  const emitted = emittedLast24h ?? 0;
  const pending = pendingDeliveries ?? 0;
  const failed = failedDeliveries ?? 0;

  return {
    emittedLast24h: emitted,
    pendingDeliveries: pending,
    failedDeliveries: failed,
    lastEventName: (lastEvent as { event_name: string } | null)?.event_name ?? null,
    lastEventAt: (lastEvent as { occurred_at: string } | null)?.occurred_at ?? null,
    lastFailure,
    healthStatus: deriveHealthStatus(emitted, pending, failed),
  };
}
