import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  evaluateGoldenPatientPersistence,
  goldenPatientSpineRoutes,
  goldenPatientWorkspaceReady,
} from "@/src/lib/patients/goldenPatientSpineCore";

const TID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const PERSON = "11111111-1111-1111-1111-111111111111";
const LEAD = "22222222-2222-2222-2222-222222222222";
const PATIENT = "33333333-3333-3333-3333-333333333333";

describe("goldenPatientSpineRoutes", () => {
  it("uses Pipeline and patient workspace as canonical doors", () => {
    const routes = goldenPatientSpineRoutes(TID, {
      leadId: LEAD,
      patientId: PATIENT,
      consultationId: null,
      caseId: null,
    });
    assert.equal(routes.pipeline, `/fi-admin/${TID}/crm`);
    assert.equal(routes.leadDetail, `/fi-admin/${TID}/crm/leads/${LEAD}`);
    assert.equal(routes.patientWorkspace, `/fi-admin/${TID}/patients/${PATIENT}`);
    assert.ok(!routes.pipeline.includes("leadflow"));
  });
});

describe("evaluateGoldenPatientPersistence", () => {
  it("passes when ids stable and lead linked", () => {
    const before = {
      tenantId: TID,
      personId: PERSON,
      leadId: LEAD,
      patientId: PATIENT,
    };
    const result = evaluateGoldenPatientPersistence({
      before,
      afterReload: { ...before },
      leadPatientIdAfterReload: PATIENT,
    });
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
  });

  it("fails when patient vanishes or lead not linked", () => {
    const before = {
      tenantId: TID,
      personId: PERSON,
      leadId: LEAD,
      patientId: PATIENT,
    };
    const missing = evaluateGoldenPatientPersistence({
      before,
      afterReload: { ...before, patientId: null },
      leadPatientIdAfterReload: PATIENT,
    });
    assert.equal(missing.ok, false);
    assert.ok(missing.issues.some((i) => /patient_id missing/i.test(i)));

    const unlinked = evaluateGoldenPatientPersistence({
      before,
      afterReload: { ...before },
      leadPatientIdAfterReload: null,
    });
    assert.equal(unlinked.ok, false);
    assert.ok(unlinked.issues.some((i) => /not linked/i.test(i)));
  });
});

describe("goldenPatientWorkspaceReady", () => {
  it("requires tenant + patient", () => {
    assert.equal(
      goldenPatientWorkspaceReady({
        tenantId: TID,
        personId: PERSON,
        leadId: LEAD,
        patientId: PATIENT,
      }),
      true
    );
    assert.equal(
      goldenPatientWorkspaceReady({
        tenantId: TID,
        personId: PERSON,
        leadId: LEAD,
        patientId: null,
      }),
      false
    );
  });
});
