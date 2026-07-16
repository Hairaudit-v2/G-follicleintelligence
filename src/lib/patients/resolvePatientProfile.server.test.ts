import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolvePatientProfile } from "@/src/lib/patients/resolvePatientProfile.server";

const TID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const OTHER_TID = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PATIENT = "11111111-1111-4111-8111-111111111111";
const PERSON = "33333333-3333-4333-8333-333333333333";
const PERSON_ID_AS_ROUTE = "99999999-9999-4999-8999-999999999999";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";

type MockRow = Record<string, unknown>;

function createMockSupabase(handlers: {
  patientsByTenantId?: MockRow | null;
  patientsByIdAnyTenant?: MockRow | null;
  personById?: MockRow | null;
}) {
  return {
    from(table: string) {
      const state: {
        filters: Record<string, string>;
        single: boolean;
      } = { filters: {}, single: false };

      const builder = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          state.filters[col] = val;
          return builder;
        },
        maybeSingle: async () => {
          if (table === "fi_patients") {
            const hasTenant = "tenant_id" in state.filters;
            if (hasTenant) {
              const row = handlers.patientsByTenantId ?? null;
              if (
                row &&
                String(row.id) === state.filters.id &&
                String(row.tenant_id) === state.filters.tenant_id
              ) {
                return { data: row, error: null };
              }
              return { data: null, error: null };
            }
            const row = handlers.patientsByIdAnyTenant ?? null;
            if (row && String(row.id) === state.filters.id) {
              return { data: row, error: null };
            }
            return { data: null, error: null };
          }
          if (table === "fi_persons") {
            const row = handlers.personById ?? null;
            if (row && String(row.id) === state.filters.id) {
              return { data: row, error: null };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return builder;
    },
  };
}

describe("resolvePatientProfile server fail-closed", () => {
  it("resolves exact tenant + patient + same-tenant person", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: { id: PATIENT, tenant_id: TID, person_id: PERSON },
      personById: { id: PERSON, tenant_id: TID },
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: PATIENT },
      supabase as never
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.patientId, PATIENT);
    assert.equal(result.data.personId, PERSON);
    assert.equal(result.data.entityType, "patient");
  });

  it("4. person ID on patient route fails closed (patient_not_found)", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: null,
      patientsByIdAnyTenant: null,
      personById: { id: PERSON_ID_AS_ROUTE, tenant_id: TID },
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: PERSON_ID_AS_ROUTE },
      supabase as never
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "patient_not_found");
  });

  it("5. lead ID on patient route fails closed", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: null,
      patientsByIdAnyTenant: null,
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: LEAD_ID },
      supabase as never
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "patient_not_found");
  });

  it("6. unknown ID never returns another patient", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: null,
      patientsByIdAnyTenant: null,
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: "55555555-5555-4555-8555-555555555555" },
      supabase as never
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "patient_not_found");
  });

  it("7. cross-tenant patient ID is denied", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: null,
      patientsByIdAnyTenant: { id: PATIENT, tenant_id: OTHER_TID },
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: PATIENT },
      supabase as never
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "cross_tenant_denied");
  });

  it("person tenant mismatch fails closed", async () => {
    const supabase = createMockSupabase({
      patientsByTenantId: { id: PATIENT, tenant_id: TID, person_id: PERSON },
      personById: { id: PERSON, tenant_id: OTHER_TID },
    });
    const result = await resolvePatientProfile(
      { tenantId: TID, patientId: PATIENT },
      supabase as never
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, "person_tenant_mismatch");
  });
});
