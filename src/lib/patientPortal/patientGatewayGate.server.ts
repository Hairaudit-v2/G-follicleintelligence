import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { normalizePatientStatus } from "@/src/lib/patients/patientPolicy";

import { writePatientGatewayAudit } from "./patientGatewayAudit.server";
import { assertPatientAppAccessAllowed } from "./patientAppPilotControls.server";
import {
  assertClaimedPatientMatches,
  assertClaimedTenantMatches,
  detectRejectedStaffCredential,
  extractBearerToken,
  extractClaimedPatientId,
  extractClaimedTenantId,
  patientGatewayDeny,
  selectPortalPatientMapping,
  type PortalPatientMappingRow,
} from "./patientGatewayGateCore";
import type { PatientGatewayResult } from "./patientGatewayTypes";

export type RequirePatientGatewayContextOptions = {
  /** Optional client-claimed patient id — never authoritative; mismatch denies. */
  claimedPatientId?: string | null;
  /** Optional client-claimed tenant id — never authoritative; mismatch denies. */
  claimedTenantId?: string | null;
  /**
   * When true (default), parse claimed ids from query/headers.
   * Body-claimed ids may be passed explicitly via options.
   */
  readClaimsFromRequest?: boolean;
  /** Unit tests: inject service client. */
  supabase?: SupabaseClient;
  /**
   * Unit tests: inject auth resolution. Production uses Bearer-only via resolveAuthUserId.
   */
  resolveAuthUserIdForTests?: (request: Request) => Promise<string | null>;
  /** When false, skip structured audit (tests). Default true. */
  writeAudit?: boolean;
};

async function resolveBearerAuthUserId(request: Request): Promise<"missing" | "invalid" | string> {
  const bearer = extractBearerToken(request);
  if (!bearer) return "missing";
  const authUserId = await resolveAuthUserId(request);
  if (!authUserId) return "invalid";
  return authUserId;
}

async function loadPortalMappingsForAuthUser(
  authUserId: string,
  client: SupabaseClient
): Promise<PortalPatientMappingRow[]> {
  const { data, error } = await client
    .from("fi_patients")
    .select("id, tenant_id, person_id, patient_status, portal_auth_user_id")
    .eq("portal_auth_user_id", authUserId)
    .limit(2);

  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    tenant_id: String(r.tenant_id),
    person_id: r.person_id != null ? String(r.person_id) : null,
    patient_status: r.patient_status != null ? String(r.patient_status) : null,
    portal_auth_user_id: r.portal_auth_user_id != null ? String(r.portal_auth_user_id) : null,
  }));
}

async function loadClinicDisplayName(
  tenantId: string,
  client: SupabaseClient
): Promise<string | null> {
  const { data, error } = await client
    .from("fi_tenants")
    .select("name")
    .eq("id", tenantId)
    .maybeSingle();
  if (error || !data) return null;
  const name = String((data as { name?: unknown }).name ?? "").trim();
  return name.length > 0 ? name : null;
}

/**
 * Resolve the patient gateway principal for `/api/patient/v1/*`.
 *
 * - Requires `Authorization: Bearer <supabase_access_token>` (no cookie fallback).
 * - Canonical patient is always derived from `fi_patients.portal_auth_user_id`.
 * - Client-supplied patient/tenant ids are never used for resolution.
 * - Staff admin-key elevators are rejected.
 */
export async function requirePatientGatewayContext(
  request: Request,
  options?: RequirePatientGatewayContextOptions
): Promise<PatientGatewayResult> {
  const writeAudit = options?.writeAudit !== false;
  const audit = (input: Parameters<typeof writePatientGatewayAudit>[0]) => {
    if (writeAudit) writePatientGatewayAudit(input);
  };

  if (detectRejectedStaffCredential(request)) {
    audit({
      action: "staff_credential_rejected",
      outcome: "deny",
      code: "staff_credential_rejected",
    });
    return patientGatewayDeny(
      "staff_credential_rejected",
      403,
      "Staff or service credentials cannot access the patient gateway."
    );
  }

  const authResolution =
    options?.resolveAuthUserIdForTests != null
      ? await (async () => {
          const bearer = extractBearerToken(request);
          if (!bearer) return "missing" as const;
          const id = await options.resolveAuthUserIdForTests!(request);
          return id ? id : ("invalid" as const);
        })()
      : await resolveBearerAuthUserId(request);

  if (authResolution === "missing") {
    audit({ action: "auth_denied", outcome: "deny", code: "unauthenticated" });
    return patientGatewayDeny("unauthenticated", 401, "Authentication required.");
  }
  if (authResolution === "invalid") {
    audit({ action: "auth_denied", outcome: "deny", code: "invalid_token" });
    return patientGatewayDeny("invalid_token", 401, "Invalid or expired credentials.");
  }

  const authUserId = authResolution;
  const client = options?.supabase ?? supabaseAdmin();

  let rows: PortalPatientMappingRow[];
  try {
    rows = await loadPortalMappingsForAuthUser(authUserId, client);
  } catch {
    audit({
      action: "auth_denied",
      outcome: "deny",
      code: "misconfigured",
      authUserId,
    });
    return patientGatewayDeny("misconfigured", 500, "Could not resolve patient mapping.");
  }

  const selected = selectPortalPatientMapping(authUserId, rows);
  if (!selected.ok) {
    if (selected.code === "ambiguous_mapping") {
      audit({
        action: "mapping_ambiguous",
        outcome: "deny",
        code: "ambiguous_mapping",
        authUserId,
      });
      return patientGatewayDeny(
        "ambiguous_mapping",
        403,
        "Patient mapping is ambiguous. Access denied."
      );
    }
    if (selected.code === "inactive_patient") {
      const inactive = rows[0];
      audit({
        action: "inactive_patient",
        outcome: "deny",
        code: "inactive_patient",
        authUserId,
        patientId: inactive?.id ?? null,
        tenantId: inactive?.tenant_id ?? null,
      });
      return patientGatewayDeny(
        "inactive_patient",
        403,
        "This patient portal identity is not active."
      );
    }
    audit({
      action: "mapping_unresolved",
      outcome: "deny",
      code: "unlinked",
      authUserId,
    });
    return patientGatewayDeny(
      "unlinked",
      403,
      "No patient portal linkage found for this account."
    );
  }

  const row = selected.row;
  const patientId = row.id.trim();
  const tenantId = row.tenant_id.trim();
  const personId = String(row.person_id ?? "").trim();

  const url = new URL(request.url);
  const readClaims = options?.readClaimsFromRequest !== false;
  const claimedPatientId = readClaims
    ? (options?.claimedPatientId ??
      extractClaimedPatientId({ url, headers: request.headers }))
    : (options?.claimedPatientId ?? null);
  const claimedTenantId = readClaims
    ? (options?.claimedTenantId ?? extractClaimedTenantId({ url, headers: request.headers }))
    : (options?.claimedTenantId ?? null);

  const patientClaimDeny = assertClaimedPatientMatches(patientId, claimedPatientId);
  if (patientClaimDeny) {
    audit({
      action: "ownership_denied",
      outcome: "deny",
      code: "ownership_denied",
      authUserId,
      patientId,
      tenantId,
    });
    return patientClaimDeny;
  }

  const tenantClaimDeny = assertClaimedTenantMatches(tenantId, claimedTenantId);
  if (tenantClaimDeny) {
    audit({
      action: "wrong_tenant",
      outcome: "deny",
      code: "wrong_tenant",
      authUserId,
      patientId,
      tenantId,
    });
    return tenantClaimDeny;
  }

  let pilotDecision: Awaited<ReturnType<typeof assertPatientAppAccessAllowed>>;
  try {
    pilotDecision = await assertPatientAppAccessAllowed(
      { tenantId, patientId, authUserId },
      { supabase: client, writeAudit: false }
    );
  } catch {
    audit({
      action: "auth_denied",
      outcome: "deny",
      code: "misconfigured",
      authUserId,
      patientId,
      tenantId,
    });
    return patientGatewayDeny("misconfigured", 500, "Could not resolve pilot access state.");
  }

  if (!pilotDecision.ok) {
    audit({
      action:
        pilotDecision.code === "pilot_paused"
          ? "pilot_paused"
          : pilotDecision.code === "patient_withdrawn"
            ? "patient_withdrawn"
            : "patient_portal_deactivated",
      outcome: "deny",
      code: pilotDecision.code,
      authUserId,
      patientId,
      tenantId,
    });
    return patientGatewayDeny(pilotDecision.code, 403, pilotDecision.message);
  }

  const clinicName = await loadClinicDisplayName(tenantId, client);

  audit({
    action: "auth_ok",
    outcome: "allow",
    authUserId,
    patientId,
    tenantId,
  });

  return {
    ok: true,
    context: {
      authUserId,
      patientId,
      tenantId,
      personId,
      patientStatus: normalizePatientStatus(row.patient_status),
      clinicName,
    },
  };
}
