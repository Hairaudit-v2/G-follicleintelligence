/**
 * Batch staff identity resolution (FI-TEAM-COHESION-B1).
 *
 * Deduplicates input ids, uses bounded `.in(...)` loaders, preserves stable
 * output ordering, and distinguishes missing / ambiguous / cross-tenant.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import {
  loadLifecycleRowsByIds,
  loadLifecycleRowsByStaffIds,
  loadSchedulingRowsByIds,
  loadSchedulingRowsByUserIds,
  probeSchedulingTenantOutside,
} from "@/src/lib/team/identity/internal/loadStaffIdentityRows.server";
import { normaliseStaffIdentity } from "@/src/lib/team/identity/internal/normaliseStaffIdentity";
import type {
  ResolveStaffIdentitiesInput,
  ResolveStaffIdentitiesResult,
  StaffIdentity,
  StaffIdentityUnresolved,
} from "@/src/lib/team/identity/types";

export type ResolveStaffIdentitiesOptions = {
  client?: SupabaseClient;
};

function dedupePreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = String(raw ?? "").trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function pushUnresolved(
  list: StaffIdentityUnresolved[],
  key: string,
  reason: StaffIdentityUnresolved["reason"]
): void {
  list.push({ key, reason });
}

async function resolveByStaffIds(
  tenantId: string,
  staffIds: string[],
  client?: SupabaseClient
): Promise<ResolveStaffIdentitiesResult> {
  const keys = dedupePreserveOrder(staffIds);
  const byKey = new Map<string, StaffIdentity | null>();
  const identities: StaffIdentity[] = [];
  const unresolved: StaffIdentityUnresolved[] = [];

  if (!keys.length) {
    return { byKey, identities, unresolved };
  }

  const [schedulingMap, lifecycleByStaff] = await Promise.all([
    loadSchedulingRowsByIds(tenantId, keys, client),
    loadLifecycleRowsByStaffIds(tenantId, keys, client),
  ]);

  for (const staffId of keys) {
    const scheduling = schedulingMap.get(staffId) ?? null;
    const allLifecycle = lifecycleByStaff.get(staffId) ?? [];

    if (!scheduling && allLifecycle.length === 0) {
      byKey.set(staffId, null);
      pushUnresolved(unresolved, staffId, "missing");
      continue;
    }

    const identity = normaliseStaffIdentity({
      tenantId,
      scheduling,
      lifecycle: allLifecycle[0] ?? null,
      lifecycleCandidates: allLifecycle,
    });
    byKey.set(staffId, identity);
    identities.push(identity);

    if (identity.integrity.linkStatus === "ambiguous") {
      pushUnresolved(unresolved, staffId, "ambiguous");
    } else if (identity.integrity.linkStatus === "cross_tenant_mismatch") {
      pushUnresolved(unresolved, staffId, "cross_tenant_mismatch");
    } else if (identity.integrity.linkStatus === "invalid") {
      pushUnresolved(unresolved, staffId, "invalid");
    }
  }

  return { byKey, identities, unresolved };
}

async function resolveByStaffMemberIds(
  tenantId: string,
  staffMemberIds: string[],
  client?: SupabaseClient
): Promise<ResolveStaffIdentitiesResult> {
  const keys = dedupePreserveOrder(staffMemberIds);
  const byKey = new Map<string, StaffIdentity | null>();
  const identities: StaffIdentity[] = [];
  const unresolved: StaffIdentityUnresolved[] = [];

  if (!keys.length) {
    return { byKey, identities, unresolved };
  }

  const lifecycleMap = await loadLifecycleRowsByIds(tenantId, keys, client);
  const linkedStaffIds = Array.from(
    new Set(
      [...lifecycleMap.values()]
        .map((r) => r.fi_staff_id?.trim() || "")
        .filter(Boolean)
    )
  );

  const [schedulingMap, lifecycleByStaff] = await Promise.all([
    loadSchedulingRowsByIds(tenantId, linkedStaffIds, client),
    loadLifecycleRowsByStaffIds(tenantId, linkedStaffIds, client),
  ]);

  for (const memberId of keys) {
    const lifecycle = lifecycleMap.get(memberId) ?? null;
    if (!lifecycle) {
      byKey.set(memberId, null);
      pushUnresolved(unresolved, memberId, "missing");
      continue;
    }

    const linkedStaffId = lifecycle.fi_staff_id;
    if (!linkedStaffId) {
      const identity = normaliseStaffIdentity({
        tenantId,
        scheduling: null,
        lifecycle,
        lifecycleCandidates: [lifecycle],
      });
      byKey.set(memberId, identity);
      identities.push(identity);
      continue;
    }

    const scheduling = schedulingMap.get(linkedStaffId) ?? null;
    const allLifecycle = lifecycleByStaff.get(linkedStaffId) ?? [];
    const candidates = allLifecycle.length ? allLifecycle : [lifecycle];

    if (!scheduling) {
      const foreignTenant = await probeSchedulingTenantOutside(tenantId, linkedStaffId, client);
      if (foreignTenant) {
        const identity = normaliseStaffIdentity({
          tenantId,
          scheduling: null,
          lifecycle,
          lifecycleCandidates: candidates,
          foreignSchedulingTenantId: foreignTenant,
        });
        byKey.set(memberId, identity);
        identities.push(identity);
        pushUnresolved(unresolved, memberId, "cross_tenant_mismatch");
        continue;
      }

      const identity = normaliseStaffIdentity({
        tenantId,
        scheduling: null,
        lifecycle,
        lifecycleCandidates: candidates,
        brokenStaffFk: true,
      });
      byKey.set(memberId, identity);
      identities.push(identity);
      pushUnresolved(unresolved, memberId, "invalid");
      continue;
    }

    const identity = normaliseStaffIdentity({
      tenantId,
      scheduling,
      lifecycle,
      lifecycleCandidates: candidates,
    });
    byKey.set(memberId, identity);
    identities.push(identity);

    if (identity.integrity.linkStatus === "ambiguous") {
      pushUnresolved(unresolved, memberId, "ambiguous");
    } else if (identity.integrity.linkStatus === "invalid") {
      pushUnresolved(unresolved, memberId, "invalid");
    }
  }

  return { byKey, identities, unresolved };
}

async function resolveByUserIds(
  tenantId: string,
  userIds: string[],
  client?: SupabaseClient
): Promise<ResolveStaffIdentitiesResult> {
  const keys = dedupePreserveOrder(userIds);
  const byKey = new Map<string, StaffIdentity | null>();
  const identities: StaffIdentity[] = [];
  const unresolved: StaffIdentityUnresolved[] = [];

  if (!keys.length) {
    return { byKey, identities, unresolved };
  }

  const byUser = await loadSchedulingRowsByUserIds(tenantId, keys, client);
  const staffIds: string[] = [];
  const userToStaff = new Map<string, string[]>();

  for (const userId of keys) {
    const rows = byUser.get(userId) ?? [];
    if (!rows.length) {
      byKey.set(userId, null);
      pushUnresolved(unresolved, userId, "missing");
      continue;
    }
    const ids = [...rows].map((r) => r.id).sort((a, b) => a.localeCompare(b));
    userToStaff.set(userId, ids);
    staffIds.push(...ids);
  }

  const nested = await resolveByStaffIds(tenantId, staffIds, client);

  for (const userId of keys) {
    if (byKey.has(userId) && byKey.get(userId) === null) continue;
    const staffForUser = userToStaff.get(userId) ?? [];
    if (!staffForUser.length) continue;

    const primaryStaffId = staffForUser[0]!;
    let identity = nested.byKey.get(primaryStaffId) ?? null;

    if (!identity) {
      byKey.set(userId, null);
      pushUnresolved(unresolved, userId, "missing");
      continue;
    }

    if (staffForUser.length > 1) {
      identity = {
        ...identity,
        integrity: {
          ...identity.integrity,
          linkStatus: "ambiguous",
          warnings: [
            ...identity.integrity.warnings,
            {
              code: "multiple_lifecycle_candidates",
              message: `Multiple fi_staff rows (${staffForUser.length}) share the same user id.`,
            },
          ],
        },
        readinessStatus: "watch",
      };
      pushUnresolved(unresolved, userId, "ambiguous");
    } else if (identity.integrity.linkStatus === "ambiguous") {
      pushUnresolved(unresolved, userId, "ambiguous");
    } else if (identity.integrity.linkStatus === "cross_tenant_mismatch") {
      pushUnresolved(unresolved, userId, "cross_tenant_mismatch");
    } else if (identity.integrity.linkStatus === "invalid") {
      pushUnresolved(unresolved, userId, "invalid");
    }

    byKey.set(userId, identity);
    identities.push(identity);
  }

  return { byKey, identities, unresolved };
}

/**
 * Batch-resolve staff identities. Prefer this over looping resolveStaffIdentity.
 */
export async function resolveStaffIdentities(
  input: ResolveStaffIdentitiesInput,
  options: ResolveStaffIdentitiesOptions = {}
): Promise<ResolveStaffIdentitiesResult> {
  const tenantId = assertNonEmptyUuid(input.tenantId, "tenantId");

  if (input.by === "staffId") {
    return resolveByStaffIds(tenantId, input.staffIds, options.client);
  }
  if (input.by === "staffMemberId") {
    return resolveByStaffMemberIds(tenantId, input.staffMemberIds, options.client);
  }
  return resolveByUserIds(tenantId, input.userIds, options.client);
}
