/**
 * FI-CONTROLLED-PILOT-CONTROL-CENTRE-1A.4 — request context resolver (server).
 * Authenticates, resolves tenant membership, programme access, and role projection.
 * Never trusts tenant/clinic/role/permission query params as authority.
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  assertCrmTenantReadAllowed,
  isFiOsPlatformAdminFullSessionBypass,
  resolveAuthUserId,
  tryResolveFiUserIdForTenant,
} from "@/src/lib/crm/crmGate";
import { extractAdminKeyFromRequest } from "@/src/lib/crm/crmHttp";
import { loadActiveTenantAdminProfileForSession } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

import {
  EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY,
  EVOLVED_PILOT_CLINIC_TIMEZONE,
  type PilotControlRoleKey,
} from "../pilotControlContracts";
import {
  loadPilotProgrammeByIdOrKey,
  loadPilotProgrammeForTenant,
} from "../pilotCohortQuery.server";
import { PilotControlApiError } from "./pilotControlApiErrors";
import { permissionsForRole } from "./pilotControlPermissions";
import type { PilotControlRequestContext } from "./pilotControlApiTypes";
import { mapToPilotControlRole } from "./pilotControlRoleMap";
import {
  beginPilotControlEvaluation,
  checkPilotControlRequestRateLimit,
  endPilotControlEvaluation,
} from "./pilotControlRateLimit";

export type ResolvePilotControlRequestContextArgs = {
  request: Request;
  /** Required for programme-scoped routes; omit for programmes list. */
  programmeIdOrKey?: string | null;
  /** Optional tenant hint — verified against membership; never authoritative alone. */
  tenantIdHint?: string | null;
  requireProgramme?: boolean;
};

function correlationIdFromRequest(request: Request): string {
  const header =
    request.headers.get("x-correlation-id")?.trim() ||
    request.headers.get("x-request-id")?.trim();
  if (header && header.length <= 128) return header;
  return randomUUID();
}

async function loadMembershipSignals(
  tenantId: string,
  authUserId: string
): Promise<{
  fiUserId: string | null;
  fiUserRole: string | null;
  staffRole: string | null;
  clinicId?: string;
  explicitPilotRole?: string | null;
}> {
  const supabase = supabaseAdmin();
  const { data: fiUser, error } = await supabase
    .from("fi_users")
    .select("id, role")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (error) {
    throw new Error("membership_lookup_failed");
  }
  if (!fiUser) {
    return { fiUserId: null, fiUserRole: null, staffRole: null };
  }

  const fiUserId = String((fiUser as { id: string }).id);
  const fiUserRole = String((fiUser as { role: string | null }).role ?? "member");

  // Live Evolved `fi_staff` has no clinic FK column today — do not select
  // `primary_clinic_id` (PostgREST errors and previously wiped staffRole →
  // false PILOT_CONTROL_FORBIDDEN for owner/manager/reception/clinical).
  const { data: staffRows, error: staffErr } = await supabase
    .from("fi_staff")
    .select("staff_role, staff_metadata, is_active")
    .eq("tenant_id", tenantId)
    .eq("fi_user_id", fiUserId)
    .eq("is_active", true);

  if (staffErr) {
    return { fiUserId, fiUserRole, staffRole: null };
  }

  const rows = (staffRows ?? []) as Array<{
    staff_role: string | null;
    staff_metadata: unknown;
  }>;

  if (rows.length > 1) {
    // Ambiguous active staff rows — fail closed at caller if role cannot be resolved.
  }

  const staff = rows[0];
  const meta =
    staff?.staff_metadata &&
    typeof staff.staff_metadata === "object" &&
    !Array.isArray(staff.staff_metadata)
      ? (staff.staff_metadata as Record<string, unknown>)
      : {};

  return {
    fiUserId,
    fiUserRole,
    staffRole: staff?.staff_role ?? null,
    clinicId: undefined,
    explicitPilotRole:
      typeof meta.pilot_control_role === "string" ? meta.pilot_control_role : null,
  };
}

async function resolveTenantIdForActor(args: {
  request: Request;
  authUserId: string;
  tenantIdHint?: string | null;
  correlationId: string;
  platformAdmin: boolean;
}): Promise<string> {
  const hint =
    args.tenantIdHint?.trim() ||
    args.request.headers.get("x-fi-tenant-id")?.trim() ||
    new URL(args.request.url).searchParams.get("tenantId")?.trim() ||
    "";

  const supabase = supabaseAdmin();

  if (args.platformAdmin) {
    if (!hint) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_IDENTITY_AMBIGUOUS",
        "Tenant context is required.",
        400,
        args.correlationId
      );
    }
    return hint;
  }

  const { data, error } = await supabase
    .from("fi_users")
    .select("tenant_id, role")
    .eq("auth_user_id", args.authUserId);

  if (error) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_EVALUATION_FAILED",
      "Could not resolve tenant membership.",
      500,
      args.correlationId
    );
  }

  const memberships = (data ?? []).map((r) => String((r as { tenant_id: string }).tenant_id));
  const unique = [...new Set(memberships.filter(Boolean))];

  if (unique.length === 0) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "Not a member of any tenant.",
      403,
      args.correlationId
    );
  }

  if (hint) {
    if (!unique.includes(hint)) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_TENANT_MISMATCH",
        "Not authorized for this tenant.",
        403,
        args.correlationId
      );
    }
    return hint;
  }

  if (unique.length > 1) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_IDENTITY_AMBIGUOUS",
      "Multiple tenant memberships found; specify tenant context.",
      409,
      args.correlationId
    );
  }

  return unique[0]!;
}

/**
 * Canonical Pilot Control request context.
 * Fail closed on unauthenticated, inactive membership, or ambiguous identity.
 */
export async function resolvePilotControlRequestContext(
  args: ResolvePilotControlRequestContextArgs
): Promise<PilotControlRequestContext> {
  const correlationId = correlationIdFromRequest(args.request);
  const requestedAt = new Date().toISOString();
  const isAutomaticRefresh =
    args.request.headers.get("x-fi-pilot-refresh") === "1" ||
    new URL(args.request.url).searchParams.get("refresh") === "auto";

  const authUserId = await resolveAuthUserId(args.request);
  if (!authUserId) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_UNAUTHENTICATED",
      "Authentication required.",
      401,
      correlationId
    );
  }

  const rateKey = `user:${authUserId}`;
  const rate = checkPilotControlRequestRateLimit(rateKey);
  if (!rate.allowed) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_RATE_LIMITED",
      "Too many pilot control requests. Try again shortly.",
      429,
      correlationId
    );
  }

  const platformAdmin = await isFiOsPlatformAdminFullSessionBypass(authUserId);
  const tenantId = await resolveTenantIdForActor({
    request: args.request,
    authUserId,
    tenantIdHint: args.tenantIdHint,
    correlationId,
    platformAdmin,
  });

  const adminKey = extractAdminKeyFromRequest(args.request);
  await assertCrmTenantReadAllowed({
    tenantId,
    adminKey,
    request: args.request,
  });

  const membershipAuthPrincipal = authUserId;
  const signals = await loadMembershipSignals(tenantId, membershipAuthPrincipal);
  const tenantAdmin = await loadActiveTenantAdminProfileForSession(
    tenantId,
    membershipAuthPrincipal
  );

  const actorRole = mapToPilotControlRole({
    explicitPilotRole: signals.explicitPilotRole,
    staffRole: signals.staffRole,
    fiUserRole: signals.fiUserRole,
    tenantAdminRole: tenantAdmin?.adminRole ?? null,
    platformAdmin,
  });

  if (!actorRole) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_FORBIDDEN",
      "No Pilot Control role could be resolved for this actor.",
      403,
      correlationId
    );
  }

  // Optional membership id check (cookies/bearer on request)
  await tryResolveFiUserIdForTenant(tenantId, args.request).catch(() => null);

  let programmeId = "";
  let programmeKey: string = EVOLVED_CONTROLLED_PILOT_PROGRAMME_KEY;

  if (args.requireProgramme !== false && args.programmeIdOrKey) {
    const programme = await loadPilotProgrammeByIdOrKey({
      tenantId,
      programmeIdOrKey: args.programmeIdOrKey,
    });
    if (!programme) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_PROGRAMME_NOT_FOUND",
        "Programme not found.",
        404,
        correlationId
      );
    }
    if (programme.tenantId !== tenantId) {
      throw new PilotControlApiError(
        "PILOT_CONTROL_TENANT_MISMATCH",
        "Programme is not in the request tenant.",
        403,
        correlationId
      );
    }
    programmeId = programme.id;
    programmeKey = programme.programmeKey;
  } else if (args.requireProgramme) {
    throw new PilotControlApiError(
      "PILOT_CONTROL_INVALID_FILTER",
      "programmeId is required.",
      400,
      correlationId
    );
  } else if (!args.programmeIdOrKey) {
    // programmes list — fill with default programme if present for meta convenience
    const fallback = await loadPilotProgrammeForTenant({ tenantId });
    if (fallback) {
      programmeId = fallback.id;
      programmeKey = fallback.programmeKey;
    }
  }

  return {
    actorId: authUserId,
    actorRole,
    fiUserId: signals.fiUserId,
    tenantId,
    clinicId: signals.clinicId,
    programmeId,
    programmeKey,
    permissions: permissionsForRole(actorRole),
    correlationId,
    requestedAt,
    timezone: EVOLVED_PILOT_CLINIC_TIMEZONE,
    isAutomaticRefresh,
  };
}

export function withPilotControlEvaluationGuard<T>(
  actorKey: string,
  correlationId: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!beginPilotControlEvaluation(actorKey)) {
    return Promise.reject(
      new PilotControlApiError(
        "PILOT_CONTROL_RATE_LIMITED",
        "Too many simultaneous evaluations.",
        429,
        correlationId
      )
    );
  }
  return fn().finally(() => endPilotControlEvaluation(actorKey));
}

export type { PilotControlRoleKey };
