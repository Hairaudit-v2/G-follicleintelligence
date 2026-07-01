import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPatientVisualSummaryApproval } from "./patientVisualSummaryApprovalCore";
import { evaluatePatientPortalPdfAccess } from "./patientVisualSummaryPortalPdfCore";

describe("patientVisualSummaryPortalPdfCore", () => {
  it("allows approved report for owning patient", () => {
    const decision = evaluatePatientPortalPdfAccess({
      requestPatientId: "patient-1",
      casePatientId: "patient-1",
      approval: {
        ...defaultPatientVisualSummaryApproval("surgery_post_op_summary"),
        status: "approved",
        approved_by: "staff",
        approved_at: "2026-07-01T00:00:00.000Z",
      },
    });
    assert.equal(decision.allowed, true);
  });

  it("blocks draft report", () => {
    const decision = evaluatePatientPortalPdfAccess({
      requestPatientId: "patient-1",
      casePatientId: "patient-1",
      approval: defaultPatientVisualSummaryApproval("surgery_post_op_summary"),
    });
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.reason, "draft");
  });

  it("blocks cross-patient access", () => {
    const decision = evaluatePatientPortalPdfAccess({
      requestPatientId: "patient-1",
      casePatientId: "patient-2",
      approval: {
        ...defaultPatientVisualSummaryApproval("surgery_post_op_summary"),
        status: "exported",
        approved_by: "staff",
        approved_at: "2026-07-01T00:00:00.000Z",
      },
    });
    assert.equal(decision.allowed, false);
    if (!decision.allowed) assert.equal(decision.reason, "wrong_patient");
  });
});