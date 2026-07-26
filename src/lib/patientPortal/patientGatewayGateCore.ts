/**
 * FI-PATIENT-APP-1B — pure fail-closed portal mapping resolution (no I/O).
 */

import { normalizePatientStatus } from "@/src/lib/patients/patientPolicy";

import {
  PATIENT_GATEWAY_ACTIVE_STATUSES,
  type PatientGatewayDeny,
  type PatientGatewayDenyCode,
} from "./patientGatewayTypes";

export type PortalPatientMappingRow = {
  id: string;
  tenant_id: string;
  person_id: string | null;
  patient_status: string | null;
  portal_auth_user_id: string | null;
};

export function patientGatewayDeny(
  code: PatientGatewayDenyCode,
  status: 400 | 401 | 403 | 404 | 409 | 500,
  message: string
): PatientGatewayDeny {
  return { ok: false, code, status, message };
}

export function extractBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const m = /^Bearer\s+(\S+)/i.exec(header.trim());
  const token = m?.[1]?.trim();
  return token && token.length > 0 ? token : null;
}

/** Reject FI admin / service elevators on the patient gateway (documented design). */
export function detectRejectedStaffCredential(request: Request): boolean {
  const adminHeader =
    request.headers.get("x-fi-admin-key")?.trim() ||
    request.headers.get("x-admin-key")?.trim() ||
    "";
  if (adminHeader.length > 0) return true;
  const url = new URL(request.url);
  if (url.searchParams.get("adminKey")?.trim()) return true;
  if (url.searchParams.get("fi_admin_key")?.trim()) return true;
  return false;
}

/**
 * Read optional client-claimed patient id (query/header/JSON body field).
 * Never used for resolution — only for mismatch denial.
 */
export function extractClaimedPatientId(input: {
  url: URL;
  headers: Headers;
  bodyPatientId?: string | null;
}): string | null {
  const fromQuery =
    input.url.searchParams.get("patientId")?.trim() ||
    input.url.searchParams.get("patient_id")?.trim() ||
    "";
  if (fromQuery) return fromQuery;
  const fromHeader =
    input.headers.get("x-patient-id")?.trim() || input.headers.get("x-fi-patient-id")?.trim() || "";
  if (fromHeader) return fromHeader;
  const fromBody = input.bodyPatientId?.trim() || "";
  return fromBody.length > 0 ? fromBody : null;
}

export function extractClaimedTenantId(input: {
  url: URL;
  headers: Headers;
  bodyTenantId?: string | null;
}): string | null {
  const fromQuery =
    input.url.searchParams.get("tenantId")?.trim() ||
    input.url.searchParams.get("tenant_id")?.trim() ||
    "";
  if (fromQuery) return fromQuery;
  const fromHeader =
    input.headers.get("x-tenant-id")?.trim() || input.headers.get("x-fi-tenant-id")?.trim() || "";
  if (fromHeader) return fromHeader;
  const fromBody = input.bodyTenantId?.trim() || "";
  return fromBody.length > 0 ? fromBody : null;
}

export type SelectPortalMappingResult =
  | {
      ok: true;
      row: PortalPatientMappingRow;
    }
  | {
      ok: false;
      code: "unlinked" | "ambiguous_mapping" | "inactive_patient";
    };

/**
 * Fail-closed selection of the canonical portal patient for an auth user.
 * Does not fuzzy-match on name/email/phone.
 */
export function selectPortalPatientMapping(
  authUserId: string,
  rows: readonly PortalPatientMappingRow[]
): SelectPortalMappingResult {
  const auth = authUserId.trim();
  if (!auth) return { ok: false, code: "unlinked" };

  const exact = rows.filter(
    (r) => String(r.portal_auth_user_id ?? "").trim() === auth && String(r.id ?? "").trim()
  );

  if (exact.length === 0) return { ok: false, code: "unlinked" };
  if (exact.length > 1) return { ok: false, code: "ambiguous_mapping" };

  const row = exact[0]!;
  const status = normalizePatientStatus(row.patient_status);
  if (!(PATIENT_GATEWAY_ACTIVE_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, code: "inactive_patient" };
  }
  if (!String(row.tenant_id ?? "").trim() || !String(row.person_id ?? "").trim()) {
    return { ok: false, code: "unlinked" };
  }

  return { ok: true, row };
}

export function assertClaimedPatientMatches(
  resolvedPatientId: string,
  claimedPatientId: string | null | undefined
): PatientGatewayDeny | null {
  const claimed = claimedPatientId?.trim() || "";
  if (!claimed) return null;
  if (claimed === resolvedPatientId.trim()) return null;
  return patientGatewayDeny(
    "ownership_denied",
    403,
    "Patient identity mismatch. Canonical patient is resolved server-side."
  );
}

export function assertClaimedTenantMatches(
  resolvedTenantId: string,
  claimedTenantId: string | null | undefined
): PatientGatewayDeny | null {
  const claimed = claimedTenantId?.trim() || "";
  if (!claimed) return null;
  if (claimed === resolvedTenantId.trim()) return null;
  return patientGatewayDeny("wrong_tenant", 403, "Not authorized for this clinic.");
}
