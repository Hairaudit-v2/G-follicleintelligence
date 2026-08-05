/**
 * Single staff identity resolution (FI-TEAM-COHESION-B1).
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { IdentityCrossTenantError } from "@/src/lib/team/identity/internal/identityResolutionErrors";
import {
  loadLifecycleRowsByIds,
  loadLifecycleRowsByStaffIds,
  loadSchedulingRowsByIds,
  loadSchedulingRowsByUserIds,
  probeSchedulingTenantOutside,
} from "@/src/lib/team/identity/internal/loadStaffIdentityRows.server";
import { normaliseStaffIdentity } from "@/src/lib/team/identity/internal/normaliseStaffIdentity";
import type { ResolveStaffIdentityInput, StaffIdentity } from "@/src/lib/team/identity/types";

export type ResolveStaffIdentityOptions = {
  client?: SupabaseClient;
  /**
   * When true (default), cross-tenant mismatches throw IdentityCrossTenantError
   * after producing an unusable identity is skipped — throw is the hard-fail path.
   * When false, returns the identity with linkStatus cross_tenant_mismatch.
   */
  throwOnCrossTenant?: boolean;
};

function isUuid(value: string): boolean {
  try {
    assertNonEmptyUuid(value, "id");
    return true;
  } catch {
    return false;
  }
}

async function composeFromStaffId(
  tenantId: string,
  staffId: string,
  options: ResolveStaffIdentityOptions
): Promise<StaffIdentity | null> {
  const [schedulingMap, lifecycleByStaff] = await Promise.all([
    loadSchedulingRowsByIds(tenantId, [staffId], options.client),
    loadLifecycleRowsByStaffIds(tenantId, [staffId], options.client),
  ]);

  const scheduling = schedulingMap.get(staffId) ?? null;
  const allLifecycle = lifecycleByStaff.get(staffId) ?? [];

  if (!scheduling && allLifecycle.length === 0) {
    return null;
  }

  return normaliseStaffIdentity({
    tenantId,
    scheduling,
    lifecycle: allLifecycle[0] ?? null,
    lifecycleCandidates: allLifecycle,
  });
}

async function composeFromStaffMemberId(
  tenantId: string,
  staffMemberId: string,
  options: ResolveStaffIdentityOptions
): Promise<StaffIdentity | null> {
  const lifecycleMap = await loadLifecycleRowsByIds(tenantId, [staffMemberId], options.client);
  const lifecycle = lifecycleMap.get(staffMemberId) ?? null;
  if (!lifecycle) return null;

  const linkedStaffId = lifecycle.fi_staff_id;
  if (!linkedStaffId) {
    return normaliseStaffIdentity({
      tenantId,
      scheduling: null,
      lifecycle,
      lifecycleCandidates: [lifecycle],
    });
  }

  const [schedulingMap, lifecycleByStaff] = await Promise.all([
    loadSchedulingRowsByIds(tenantId, [linkedStaffId], options.client),
    loadLifecycleRowsByStaffIds(tenantId, [linkedStaffId], options.client),
  ]);

  const scheduling = schedulingMap.get(linkedStaffId) ?? null;
  const allLifecycle = lifecycleByStaff.get(linkedStaffId) ?? [];
  const candidates = allLifecycle.length ? allLifecycle : [lifecycle];

  if (!scheduling) {
    const foreignTenant = await probeSchedulingTenantOutside(
      tenantId,
      linkedStaffId,
      options.client
    );
    if (foreignTenant) {
      const identity = normaliseStaffIdentity({
        tenantId,
        scheduling: null,
        lifecycle,
        lifecycleCandidates: candidates,
        foreignSchedulingTenantId: foreignTenant,
      });
      if (options.throwOnCrossTenant !== false) {
        throw new IdentityCrossTenantError({
          tenantId,
          staffId: linkedStaffId,
          staffMemberId,
        });
      }
      return identity;
    }

    return normaliseStaffIdentity({
      tenantId,
      scheduling: null,
      lifecycle,
      lifecycleCandidates: candidates,
      brokenStaffFk: true,
    });
  }

  return normaliseStaffIdentity({
    tenantId,
    scheduling,
    lifecycle,
    lifecycleCandidates: candidates,
  });
}

async function composeFromUserId(
  tenantId: string,
  userId: string,
  options: ResolveStaffIdentityOptions
): Promise<StaffIdentity | null> {
  const byUser = await loadSchedulingRowsByUserIds(tenantId, [userId], options.client);
  const rows = byUser.get(userId) ?? [];
  if (rows.length === 0) return null;
  if (rows.length > 1) {
    // Multiple fi_staff for one user — treat as ambiguous via first staff + force candidate noise.
    const primary = [...rows].sort((a, b) => a.id.localeCompare(b.id))[0]!;
    const identity = await composeFromStaffId(tenantId, primary.id, options);
    if (!identity) return null;
    return {
      ...identity,
      integrity: {
        ...identity.integrity,
        linkStatus: "ambiguous",
        warnings: [
          ...identity.integrity.warnings,
          {
            code: "multiple_lifecycle_candidates",
            message: `Multiple fi_staff rows (${rows.length}) share the same user id.`,
          },
        ],
      },
      readinessStatus: "watch",
    };
  }
  return composeFromStaffId(tenantId, rows[0]!.id, options);
}

/**
 * Resolve a single StaffIdentity from exactly one lookup key.
 * Missing records return null. Partial links return integrity state, not throw.
 * Cross-tenant links hard-fail by default.
 */
export async function resolveStaffIdentity(
  input: ResolveStaffIdentityInput,
  options: ResolveStaffIdentityOptions = {}
): Promise<StaffIdentity | null> {
  const tenantId = assertNonEmptyUuid(input.tenantId, "tenantId");

  if (input.by === "staffId") {
    if (!isUuid(input.staffId)) {
      return normaliseStaffIdentity({
        tenantId,
        scheduling: null,
        lifecycle: null,
        structurallyInvalid: true,
      });
    }
    return composeFromStaffId(tenantId, input.staffId.trim(), options);
  }

  if (input.by === "staffMemberId") {
    if (!isUuid(input.staffMemberId)) {
      return normaliseStaffIdentity({
        tenantId,
        scheduling: null,
        lifecycle: null,
        structurallyInvalid: true,
      });
    }
    return composeFromStaffMemberId(tenantId, input.staffMemberId.trim(), options);
  }

  if (!isUuid(input.userId)) {
    return normaliseStaffIdentity({
      tenantId,
      scheduling: null,
      lifecycle: null,
      structurallyInvalid: true,
    });
  }
  return composeFromUserId(tenantId, input.userId.trim(), options);
}
