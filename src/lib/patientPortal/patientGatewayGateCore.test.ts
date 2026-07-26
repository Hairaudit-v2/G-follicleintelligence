import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertClaimedPatientMatches,
  assertClaimedTenantMatches,
  detectRejectedStaffCredential,
  extractBearerToken,
  extractClaimedPatientId,
  selectPortalPatientMapping,
} from "./patientGatewayGateCore";

const AUTH = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const TENANT_B = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PERSON = "33333333-3333-4333-8333-333333333333";

describe("patientGatewayGateCore", () => {
  it("extracts bearer token", () => {
    const req = new Request("https://example.test/api/patient/v1/me", {
      headers: { authorization: "Bearer tok_abc" },
    });
    assert.equal(extractBearerToken(req), "tok_abc");
  });

  it("missing bearer is null", () => {
    const req = new Request("https://example.test/api/patient/v1/me");
    assert.equal(extractBearerToken(req), null);
  });

  it("detects staff admin key elevators", () => {
    const req = new Request("https://example.test/api/patient/v1/me", {
      headers: { "x-fi-admin-key": "secret" },
    });
    assert.equal(detectRejectedStaffCredential(req), true);
  });

  it("selects exact portal mapping", () => {
    const selected = selectPortalPatientMapping(AUTH, [
      {
        id: PATIENT,
        tenant_id: TENANT,
        person_id: PERSON,
        patient_status: "active",
        portal_auth_user_id: AUTH,
      },
    ]);
    assert.equal(selected.ok, true);
    if (!selected.ok) return;
    assert.equal(selected.row.id, PATIENT);
  });

  it("unlinked when no mapping", () => {
    const selected = selectPortalPatientMapping(AUTH, []);
    assert.deepEqual(selected, { ok: false, code: "unlinked" });
  });

  it("ambiguous mapping fails closed", () => {
    const selected = selectPortalPatientMapping(AUTH, [
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
    ]);
    assert.deepEqual(selected, { ok: false, code: "ambiguous_mapping" });
  });

  it("inactive patient fails closed", () => {
    const selected = selectPortalPatientMapping(AUTH, [
      {
        id: PATIENT,
        tenant_id: TENANT,
        person_id: PERSON,
        patient_status: "archived",
        portal_auth_user_id: AUTH,
      },
    ]);
    assert.deepEqual(selected, { ok: false, code: "inactive_patient" });
  });

  it("claimed foreign patient id is ownership denied", () => {
    const deny = assertClaimedPatientMatches(PATIENT, PATIENT_B);
    assert.ok(deny);
    assert.equal(deny?.code, "ownership_denied");
  });

  it("matching claimed patient id is allowed", () => {
    assert.equal(assertClaimedPatientMatches(PATIENT, PATIENT), null);
  });

  it("wrong tenant claim denied", () => {
    const deny = assertClaimedTenantMatches(TENANT, TENANT_B);
    assert.ok(deny);
    assert.equal(deny?.code, "wrong_tenant");
  });

  it("extracts claimed patient id from query without using it for resolution", () => {
    const url = new URL(`https://example.test/api/patient/v1/me?patientId=${PATIENT_B}`);
    assert.equal(
      extractClaimedPatientId({ url, headers: new Headers() }),
      PATIENT_B
    );
  });
});
