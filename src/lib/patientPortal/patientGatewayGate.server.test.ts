import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { requirePatientGatewayContext } from "./patientGatewayGate.server";

const AUTH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON = "33333333-3333-4333-8333-333333333333";

type PatientRow = {
  id: string;
  tenant_id: string;
  person_id: string;
  patient_status: string;
  portal_auth_user_id: string;
};

function createMockSupabase(input: {
  patients?: PatientRow[];
  tenantName?: string | null;
  /** Tenant settings metadata.patient_app_pilot */
  tenantSettingsMetadata?: Record<string, unknown>;
  /** Patient metadata used for access state (keyed by patient id) */
  patientMetadataById?: Record<string, Record<string, unknown>>;
}) {
  return {
    from(table: string) {
      const state: {
        limit?: number;
        eq?: Array<{ col: string; val: unknown }>;
        selectCols?: string;
      } = { eq: [] };
      const builder = {
        select(cols?: string) {
          state.selectCols = cols;
          return builder;
        },
        eq(col: string, val: unknown) {
          state.eq = state.eq ?? [];
          state.eq.push({ col, val });
          return builder;
        },
        limit(n: number) {
          state.limit = n;
          return builder;
        },
        maybeSingle: async () => {
          if (table === "fi_tenants") {
            return {
              data: input.tenantName != null ? { name: input.tenantName } : { name: "Demo Clinic" },
              error: null,
            };
          }
          if (table === "fi_tenant_settings") {
            return {
              data: { metadata: input.tenantSettingsMetadata ?? {} },
              error: null,
            };
          }
          if (table === "fi_patients" && state.selectCols?.includes("metadata")) {
            const patientEq = (state.eq ?? []).find((e) => e.col === "id");
            const id = patientEq ? String(patientEq.val) : PATIENT;
            return {
              data: {
                metadata: input.patientMetadataById?.[id] ?? {},
                portal_auth_user_id: AUTH,
              },
              error: null,
            };
          }
          return { data: null, error: null };
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (table === "fi_patients") {
            const rows = input.patients ?? [];
            const limited =
              typeof state.limit === "number" ? rows.slice(0, state.limit) : rows;
            return Promise.resolve(resolve({ data: limited, error: null }));
          }
          return Promise.resolve(resolve({ data: [], error: null }));
        },
      };
      return builder;
    },
  };
}

function bearerRequest(url: string, token = "valid.jwt.token"): Request {
  return new Request(url, {
    headers: { authorization: `Bearer ${token}` },
  });
}

describe("requirePatientGatewayContext fail-closed", () => {
  it("A. valid patient bearer resolves that patient only", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.context.patientId, PATIENT);
    assert.equal(result.context.tenantId, TENANT);
    assert.equal(result.context.authUserId, AUTH);
  });

  it("B. no bearer token denied", async () => {
    const result = await requirePatientGatewayContext(
      new Request("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({ patients: [] }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "unauthenticated");
    assert.equal(result.status, 401);
  });

  it("C. invalid bearer token denied", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me", "bad.token"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => null,
        supabase: createMockSupabase({ patients: [] }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "invalid_token");
    assert.equal(result.status, 401);
  });

  it("D. auth user with no patient mapping denied", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({ patients: [] }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "unlinked");
    assert.equal(result.status, 403);
  });

  it("E. ambiguous patient mapping denied", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
            {
              id: PATIENT_B,
              tenant_id: TENANT_B,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ambiguous_mapping");
  });

  it("F. foreign patient id claim cannot change resolved patient", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest(`https://example.test/api/patient/v1/me?patientId=${PATIENT_B}`),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
  });

  it("G. wrong tenant claim denied", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest(`https://example.test/api/patient/v1/me?tenantId=${TENANT_B}`),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "wrong_tenant");
  });

  it("H. inactive patient portal identity denied", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "inactive",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "inactive_patient");
  });

  it("I. staff/service admin key cannot enter patient route", async () => {
    const result = await requirePatientGatewayContext(
      new Request("https://example.test/api/patient/v1/me", {
        headers: {
          authorization: "Bearer valid.jwt.token",
          "x-fi-admin-key": "admin-secret",
        },
      }),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "staff_credential_rejected");
    assert.equal(result.status, 403);
  });

  it("J. tenant pilot pause denies with safe message", async () => {
    const result = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
          tenantSettingsMetadata: {
            patient_app_pilot: { status: "paused", reason: "safety_drill" },
          },
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "pilot_paused");
    assert.equal(result.status, 403);
    assert.match(result.message, /temporarily unavailable/i);
  });

  it("K. patient withdrawal denies and recovers after metadata clear in separate request", async () => {
    const denied = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
          patientMetadataById: {
            [PATIENT]: {
              patient_app_access: {
                status: "withdrawn",
                reason_category: "patient_request",
              },
            },
          },
        }) as never,
      }
    );
    assert.equal(denied.ok, false);
    if (denied.ok) return;
    assert.equal(denied.code, "patient_withdrawn");

    const recovered = await requirePatientGatewayContext(
      bearerRequest("https://example.test/api/patient/v1/me"),
      {
        writeAudit: false,
        resolveAuthUserIdForTests: async () => AUTH,
        supabase: createMockSupabase({
          patients: [
            {
              id: PATIENT,
              tenant_id: TENANT,
              person_id: PERSON,
              patient_status: "active",
              portal_auth_user_id: AUTH,
            },
          ],
          patientMetadataById: {
            [PATIENT]: {
              patient_app_access: { status: "active" },
            },
          },
        }) as never,
      }
    );
    assert.equal(recovered.ok, true);
  });
});
