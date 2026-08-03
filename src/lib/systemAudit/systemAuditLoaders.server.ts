import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  SystemAuditEventRow,
  SystemAuditListFilters,
} from "@/src/lib/systemAudit/systemAuditTypes";

const TABLE = "fi_system_audit_events";

function mapRow(raw: Record<string, unknown>): SystemAuditEventRow {
  const meta = raw.metadata;
  return {
    id: String(raw.id),
    tenant_id: String(raw.tenant_id),
    occurred_at: String(raw.occurred_at),
    actor_user_id: raw.actor_user_id != null ? String(raw.actor_user_id) : null,
    actor_role: raw.actor_role != null ? String(raw.actor_role) : null,
    actor_type: String(raw.actor_type ?? "system") as SystemAuditEventRow["actor_type"],
    action: String(raw.action),
    entity_type: String(raw.entity_type),
    entity_id: raw.entity_id != null ? String(raw.entity_id) : null,
    parent_entity_type: raw.parent_entity_type != null ? String(raw.parent_entity_type) : null,
    parent_entity_id: raw.parent_entity_id != null ? String(raw.parent_entity_id) : null,
    summary: String(raw.summary ?? ""),
    metadata:
      meta && typeof meta === "object" && !Array.isArray(meta)
        ? (meta as Record<string, unknown>)
        : {},
    ip_address: raw.ip_address != null ? String(raw.ip_address) : null,
    user_agent: raw.user_agent != null ? String(raw.user_agent) : null,
    session_id: raw.session_id != null ? String(raw.session_id) : null,
    source: String(raw.source ?? "fi_os"),
    created_at: String(raw.created_at),
  };
}

/**
 * Tenant-scoped list for Admin Audit. Always filters by tenant_id.
 */
export async function listSystemAuditEvents(
  tenantId: string,
  filters: SystemAuditListFilters = {}
): Promise<SystemAuditEventRow[]> {
  const tid = tenantId.trim();
  if (!tid) return [];

  const limit = Math.min(Math.max(filters.limit ?? 100, 1), 500);
  let q = supabaseAdmin()
    .from(TABLE)
    .select("*")
    .eq("tenant_id", tid)
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (filters.from?.trim()) {
    q = q.gte("occurred_at", new Date(filters.from).toISOString());
  }
  if (filters.to?.trim()) {
    // Inclusive end-of-day if date-only
    const toRaw = filters.to.trim();
    const toIso =
      toRaw.length <= 10 ? new Date(`${toRaw}T23:59:59.999Z`).toISOString() : new Date(toRaw).toISOString();
    q = q.lte("occurred_at", toIso);
  }
  if (filters.actorUserId?.trim()) {
    q = q.eq("actor_user_id", filters.actorUserId.trim());
  }
  if (filters.action?.trim()) {
    q = q.eq("action", filters.action.trim());
  }
  if (filters.entityType?.trim()) {
    q = q.eq("entity_type", filters.entityType.trim());
  }
  if (filters.parentEntityType?.trim()) {
    q = q.eq("parent_entity_type", filters.parentEntityType.trim());
  }
  if (filters.parentEntityId?.trim()) {
    q = q.eq("parent_entity_id", filters.parentEntityId.trim());
  }

  const { data, error } = await q;
  if (error) {
    console.error("[systemAudit] listSystemAuditEvents", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as Record<string, unknown>));
}

/**
 * Patient chart Activity: events where entity or parent is this patient.
 */
export async function listSystemAuditEventsForPatient(
  tenantId: string,
  patientId: string,
  limit = 50
): Promise<SystemAuditEventRow[]> {
  const tid = tenantId.trim();
  const pid = patientId.trim();
  if (!tid || !pid) return [];

  const lim = Math.min(Math.max(limit, 1), 200);

  // Two-path query: entity is patient OR parent is patient.
  const [direct, parented] = await Promise.all([
    supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("tenant_id", tid)
      .eq("entity_type", "patient")
      .eq("entity_id", pid)
      .order("occurred_at", { ascending: false })
      .limit(lim),
    supabaseAdmin()
      .from(TABLE)
      .select("*")
      .eq("tenant_id", tid)
      .eq("parent_entity_type", "patient")
      .eq("parent_entity_id", pid)
      .order("occurred_at", { ascending: false })
      .limit(lim),
  ]);

  if (direct.error) console.error("[systemAudit] patient direct", direct.error.message);
  if (parented.error) console.error("[systemAudit] patient parent", parented.error.message);

  const byId = new Map<string, SystemAuditEventRow>();
  for (const raw of [...(direct.data ?? []), ...(parented.data ?? [])]) {
    const row = mapRow(raw as Record<string, unknown>);
    byId.set(row.id, row);
  }

  return Array.from(byId.values())
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at))
    .slice(0, lim);
}
