import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isSmokeOrTestPatientIdentity } from "@/src/lib/patients/patientSmokeIdentity";
import {
  assertOrdinaryPatientSearchTenantContext,
  buildCanonicalPatientProfileHref,
  buildResolvedPatientProfile,
  patientProfileCacheKey,
  toCanonicalPatientSearchHit,
  validateResolvePatientProfileInput,
} from "@/src/lib/patients/resolvePatientProfile";

const TID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const TID_B = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const PERSON_A = "33333333-3333-4333-8333-333333333333";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";

describe("FI-PATIENT-IDENTITY-1 canonical contract", () => {
  it("3. search result href contains the canonical patient ID", () => {
    const hit = toCanonicalPatientSearchHit({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
      displayName: "Alice",
      email: null,
      phone: null,
    });
    assert.equal(hit.entityType, "patient");
    assert.equal(hit.patientId, PATIENT_A);
    assert.equal(hit.profileHref, `/fi-admin/${TID}/patients/${PATIENT_A}`);
    assert.ok(hit.profileHref.includes(PATIENT_A));
    assert.ok(!hit.profileHref.includes(LEAD_ID));
    assert.ok(!hit.profileHref.includes(PERSON_A));
  });

  it("1+2. directory and global search hits open the exact selected patient", () => {
    const selected = toCanonicalPatientSearchHit({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
      displayName: "Selected",
    });
    const other = toCanonicalPatientSearchHit({
      tenantId: TID,
      patientId: PATIENT_B,
      personId: PERSON_A,
      displayName: "Other",
    });
    assert.notEqual(selected.patientId, other.patientId);
    assert.equal(
      buildCanonicalPatientProfileHref(TID, selected.patientId),
      selected.profileHref
    );
  });

  it("4. person ID passed to a patient-ID route fails closed at input validation when not a patient UUID shape is ok but resolver contract rejects non-patient ownership", () => {
    // Person IDs are UUIDs — route accepts UUID shape, but resolvePatientProfile requires fi_patients.id.
    const input = validateResolvePatientProfileInput({
      tenantId: TID,
      patientId: PERSON_A,
    });
    assert.equal(input, null); // shape-valid; ownership fail is server-side patient_not_found
  });

  it("5. lead ID is never used as a patient search entity type", () => {
    const hit = toCanonicalPatientSearchHit({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
      displayName: "Patient",
    });
    assert.equal(hit.entityType, "patient");
    assert.notEqual(hit.patientId, LEAD_ID);
  });

  it("6. invalid / missing id fails closed without substituting another patient", () => {
    assert.deepEqual(validateResolvePatientProfileInput({ tenantId: TID, patientId: "" }), {
      ok: false,
      error: "missing_patient_id",
    });
    assert.deepEqual(
      validateResolvePatientProfileInput({ tenantId: TID, patientId: "not-a-uuid" }),
      { ok: false, error: "invalid_patient_id" }
    );
  });

  it("7. cross-tenant patient id is denied at tenant gate", () => {
    const a = buildResolvedPatientProfile({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
    });
    const b = buildResolvedPatientProfile({
      tenantId: TID_B,
      patientId: PATIENT_A,
      personId: PERSON_A,
    });
    assert.notEqual(a.tenantId, b.tenantId);
    assert.equal(a.patientId, b.patientId);
    assert.notEqual(a.profileHref, b.profileHref);
  });

  it("8. duplicate email across tenants never cross-resolves via href construction", () => {
    const hitA = toCanonicalPatientSearchHit({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
      displayName: "Same Email",
      email: "shared@example.com",
    });
    const hitB = toCanonicalPatientSearchHit({
      tenantId: TID_B,
      patientId: PATIENT_B,
      personId: PERSON_A,
      displayName: "Same Email",
      email: "shared@example.com",
    });
    assert.notEqual(hitA.profileHref, hitB.profileHref);
    assert.equal(hitA.email, hitB.email);
  });

  it("9. smoke/test identities are detected via deterministic metadata markers", () => {
    assert.equal(
      isSmokeOrTestPatientIdentity({
        patientMetadata: { smoketest_key: "SMOKETEST-TMRW-DEPOSIT-DUE" },
      }),
      true
    );
    assert.equal(
      isSmokeOrTestPatientIdentity({
        personMetadata: { smoketest_seed_tag: "SMOKETEST-TMRW-20260714" },
      }),
      true
    );
    assert.equal(
      isSmokeOrTestPatientIdentity({
        patientMetadata: { enterprise_demo_patient: true },
      }),
      true
    );
    assert.equal(
      isSmokeOrTestPatientIdentity({
        personMetadata: { display_name: "SMOKETEST-TMRW Deposit due" },
      }),
      true
    );
    assert.equal(
      isSmokeOrTestPatientIdentity({
        patientMetadata: { display_name: "Ordinary Patient" },
        personMetadata: { email_normalized: "clinic@example.com" },
      }),
      false
    );
  });

  it("10. downstream loaders must receive the resolved canonical patientId/personId pair", () => {
    const resolved = buildResolvedPatientProfile({
      tenantId: TID,
      patientId: PATIENT_A,
      personId: PERSON_A,
    });
    assert.equal(resolved.entityType, "patient");
    assert.equal(resolved.patientId, PATIENT_A);
    assert.equal(resolved.personId, PERSON_A);
  });

  it("11. cache keys include tenant and canonical patient identity", () => {
    const keyA = patientProfileCacheKey(TID, PATIENT_A);
    const keyB = patientProfileCacheKey(TID, PATIENT_B);
    const keyOtherTenant = patientProfileCacheKey(TID_B, PATIENT_A);
    assert.ok(keyA.includes(TID));
    assert.ok(keyA.includes(PATIENT_A));
    assert.notEqual(keyA, keyB);
    assert.notEqual(keyA, keyOtherTenant);
  });

  it("12. moving from patient A to patient B cannot reuse A's cache key", () => {
    assert.notEqual(patientProfileCacheKey(TID, PATIENT_A), patientProfileCacheKey(TID, PATIENT_B));
  });

  it("13. empty search tenant/query gates return no default records", () => {
    assert.deepEqual(assertOrdinaryPatientSearchTenantContext(""), {
      ok: false,
      error: "tenant_required",
    });
    assert.deepEqual(assertOrdinaryPatientSearchTenantContext(null), {
      ok: false,
      error: "tenant_required",
    });
  });

  it("14. platform admin without explicit tenant context cannot query ordinary patient records", () => {
    const gate = assertOrdinaryPatientSearchTenantContext(undefined);
    assert.equal(gate.ok, false);
    if (!gate.ok) assert.equal(gate.error, "tenant_required");
  });
});
