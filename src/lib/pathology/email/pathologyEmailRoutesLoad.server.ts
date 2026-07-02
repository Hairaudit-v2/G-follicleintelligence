import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  PathologyEmailRouteListItem,
  PathologyEmailRouteRow,
} from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  aggregatePathologyEmailRouteMessageStats,
  normalizePathologyInboundEmail,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";

function mapRouteRow(row: Record<string, unknown>): PathologyEmailRouteRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    inbound_email: String(row.inbound_email),
    route_status: String(row.route_status) as PathologyEmailRouteRow["route_status"],
    source_label: row.source_label != null ? String(row.source_label) : null,
    default_source_channel: String(
      row.default_source_channel ?? "email"
    ) as PathologyEmailRouteRow["default_source_channel"],
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

type MessageStat = {
  message_count: number;
  last_used_at: string | null;
  last_provider: string | null;
};

function aggregateMessageStats(
  messages: Array<{ to_email: string; received_at: string | null; created_at: string; provider: string }>
): Map<string, MessageStat> {
  return aggregatePathologyEmailRouteMessageStats(messages);
}

export async function loadPathologyEmailRoutesForTenant(
  tenantId: string
): Promise<PathologyEmailRouteListItem[]> {
  const supabase = supabaseAdmin();
  const tid = tenantId.trim();

  const [{ data: routes, error: routesError }, { data: messages, error: messagesError }] =
    await Promise.all([
      supabase
        .from("fi_pathology_email_routes")
        .select("*")
        .eq("tenant_id", tid)
        .order("created_at", { ascending: false }),
      supabase
        .from("fi_pathology_inbound_email_messages")
        .select("to_email, received_at, created_at, provider")
        .eq("tenant_id", tid),
    ]);

  if (routesError) throw new Error(routesError.message);
  if (messagesError) throw new Error(messagesError.message);

  const statsByEmail = aggregateMessageStats(
    (messages ?? []).map((row) => ({
      to_email: String((row as { to_email: string }).to_email),
      received_at:
        (row as { received_at?: string | null }).received_at != null
          ? String((row as { received_at: string }).received_at)
          : null,
      created_at: String((row as { created_at: string }).created_at),
      provider: String((row as { provider: string }).provider),
    }))
  );

  return (routes ?? []).map((row) => {
    const route = mapRouteRow(row as Record<string, unknown>);
    const stats = statsByEmail.get(normalizePathologyInboundEmail(route.inbound_email));
    return {
      ...route,
      message_count: stats?.message_count ?? 0,
      last_used_at: stats?.last_used_at ?? null,
      last_provider: stats?.last_provider ?? null,
    };
  });
}
