import "server-only";

import { headers } from "next/headers";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { loadFiOsIdentity } from "@/src/lib/fiOs/fiOsIdentity.server";
import type {
  EmitAuditEventInput,
  SystemAuditActorType,
  SystemAuditEventRow,
} from "@/src/lib/systemAudit/systemAuditTypes";

const TABLE = "fi_system_audit_events";

function asUuidOrNull(raw: string | null | undefined): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)) {
    return null;
  }
  return s;
}

function clientIpFromHeaders(h: Headers): string | null {
  const fwd = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = h.get("x-real-ip")?.trim();
  const raw = fwd || real || null;
  if (!raw) return null;
  // inet column rejects garbage; only pass simple IPv4/IPv6-ish tokens.
  if (/^[0-9a-fA-F.:]+$/.test(raw) && raw.length <= 45) return raw;
  return null;
}

function userAgentFromHeaders(h: Headers): string | null {
  const ua = h.get("user-agent")?.trim();
  return ua ? ua.slice(0, 500) : null;
}

/**
 * Append-only system audit trail writer.
 * Safe from Server Actions and API routes. Failures are logged and do not throw
 * (audit must not break clinical/financial flows). Returns the row id when inserted.
 */
export async function emitAuditEvent(
  input: EmitAuditEventInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  try {
    const tenantId = input.tenantId?.trim();
    if (!tenantId) return { ok: false, error: "tenantId required." };

    const action = String(input.action ?? "").trim();
    const entityType = String(input.entityType ?? "").trim();
    const summary = String(input.summary ?? "").trim();
    if (!action || !entityType || !summary) {
      return { ok: false, error: "action, entityType, and summary are required." };
    }

    let actorUserId = asUuidOrNull(input.actorUserId);
    let actorRole = input.actorRole?.trim() || null;
    const actorType: SystemAuditActorType = input.actorType ?? "staff";

    // Resolve session actor when not provided.
    if (actorUserId == null && actorType === "staff") {
      try {
        const sessionId = await resolveAuthUserId(input.request ?? null);
        if (sessionId) {
          actorUserId = sessionId;
          if (!actorRole) {
            const identity = await loadFiOsIdentity(sessionId);
            actorRole = identity?.osRole ?? null;
          }
        }
      } catch {
        /* leave actor null */
      }
    }

    let ipAddress = input.ipAddress?.trim() || null;
    let userAgent = input.userAgent?.trim() || null;
    if (input.request) {
      ipAddress = ipAddress ?? clientIpFromHeaders(input.request.headers);
      userAgent = userAgent ?? userAgentFromHeaders(input.request.headers);
    } else if (!ipAddress || !userAgent) {
      try {
        const h = headers();
        ipAddress = ipAddress ?? clientIpFromHeaders(h);
        userAgent = userAgent ?? userAgentFromHeaders(h);
      } catch {
        /* headers() unavailable outside request context */
      }
    }

    let occurredAt: string | undefined;
    if (input.occurredAt instanceof Date) {
      occurredAt = input.occurredAt.toISOString();
    } else if (typeof input.occurredAt === "string" && input.occurredAt.trim()) {
      occurredAt = new Date(input.occurredAt).toISOString();
    }

    const metadata =
      input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata)
        ? input.metadata
        : {};

    const row = {
      tenant_id: tenantId,
      ...(occurredAt ? { occurred_at: occurredAt } : {}),
      actor_user_id: actorUserId,
      actor_role: actorRole,
      actor_type: actorType,
      action,
      entity_type: entityType,
      entity_id: asUuidOrNull(input.entityId),
      parent_entity_type: input.parentEntityType?.trim() || null,
      parent_entity_id: asUuidOrNull(input.parentEntityId),
      summary: summary.slice(0, 2000),
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent?.slice(0, 500) ?? null,
      session_id: input.sessionId?.trim()?.slice(0, 200) || null,
      source: input.source?.trim() || "fi_os",
    };

    const { data, error } = await supabaseAdmin()
      .from(TABLE)
      .insert(row)
      .select("id")
      .single();

    if (error) {
      console.error("[systemAudit] emitAuditEvent insert failed", {
        tenantId,
        action,
        message: error.message,
      });
      return { ok: false, error: error.message };
    }

    return { ok: true, id: String((data as { id: string }).id) };
  } catch (e) {
    const message = e instanceof Error ? e.message : "emitAuditEvent failed";
    console.error("[systemAudit] emitAuditEvent exception", message);
    return { ok: false, error: message };
  }
}

/**
 * Fire-and-forget wrapper for call sites that should never await audit I/O.
 */
export function emitAuditEventBackground(input: EmitAuditEventInput): void {
  void emitAuditEvent(input);
}

export type { SystemAuditEventRow };
