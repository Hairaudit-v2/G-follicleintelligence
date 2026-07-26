import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  assertOwnedAppointmentRow,
  assertOwnedBillingRow,
  assertOwnedClinicalRow,
  assertOwnedDocumentRow,
  assertOwnedImageRow,
  assertOwnedPatientId,
  assertOwnedTenantId,
} from "./patientGatewayOwnershipCore";
import type { PatientGatewayContext } from "./patientGatewayTypes";

const CTX: PatientGatewayContext = {
  authUserId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  patientId: "11111111-1111-4111-8111-111111111111",
  tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  personId: "33333333-3333-4333-8333-333333333333",
  patientStatus: "active",
  clinicName: "Demo Clinic",
};

describe("patientGatewayOwnershipCore", () => {
  it("allows owned clinical/image/appointment/billing/document rows", () => {
    const row = { tenant_id: CTX.tenantId, patient_id: CTX.patientId };
    assert.equal(assertOwnedClinicalRow(CTX, row), null);
    assert.equal(assertOwnedImageRow(CTX, row), null);
    assert.equal(assertOwnedAppointmentRow(CTX, row), null);
    assert.equal(assertOwnedBillingRow(CTX, row), null);
    assert.equal(assertOwnedDocumentRow(CTX, row), null);
  });

  it("denies foreign patient ownership", () => {
    const deny = assertOwnedImageRow(CTX, {
      tenant_id: CTX.tenantId,
      patient_id: "22222222-2222-4222-8222-222222222222",
    });
    assert.ok(deny);
    assert.equal(deny?.code, "ownership_denied");
  });

  it("denies wrong tenant", () => {
    const deny = assertOwnedAppointmentRow(CTX, {
      tenant_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      patient_id: CTX.patientId,
    });
    assert.ok(deny);
    assert.equal(deny?.code, "wrong_tenant");
  });

  it("assertOwnedPatientId rejects foreign ids", () => {
    const deny = assertOwnedPatientId(CTX, "22222222-2222-4222-8222-222222222222");
    assert.equal(deny?.code, "ownership_denied");
  });

  it("assertOwnedTenantId rejects wrong tenant", () => {
    const deny = assertOwnedTenantId(CTX, "cccccccc-cccc-4ccc-8ccc-cccccccccccc");
    assert.equal(deny?.code, "wrong_tenant");
  });
});
