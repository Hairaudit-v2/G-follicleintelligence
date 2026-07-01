import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { defaultPatientVisualSummaryApproval } from "./patientVisualSummaryApprovalCore";
import {
  buildPatientVisualSummarySharePath,
  signPatientVisualSummaryShareToken,
  verifyPatientVisualSummaryShareToken,
} from "./patientVisualSummaryShareTokenCore";

const SECRET = "test-share-secret-phase-7d";

describe("patientVisualSummaryShareTokenCore", () => {
  it("round-trips a valid share token", () => {
    const token = signPatientVisualSummaryShareToken(
      {
        tenantId: "tenant-1",
        caseId: "case-1",
        patientId: "patient-1",
        reportType: "surgery_post_op_summary",
      },
      SECRET,
      { exp: Date.now() + 60_000 }
    );
    const parsed = verifyPatientVisualSummaryShareToken(token, SECRET);
    assert.equal(parsed?.tenantId, "tenant-1");
    assert.equal(parsed?.caseId, "case-1");
    assert.equal(parsed?.patientId, "patient-1");
    assert.equal(parsed?.reportType, "surgery_post_op_summary");
  });

  it("rejects expired tokens", () => {
    const token = signPatientVisualSummaryShareToken(
      {
        tenantId: "tenant-1",
        caseId: "case-1",
        patientId: "patient-1",
        reportType: "hairaudit_visual_summary",
      },
      SECRET,
      { exp: Date.now() - 1 }
    );
    assert.equal(verifyPatientVisualSummaryShareToken(token, SECRET), null);
  });

  it("rejects tampered signatures", () => {
    const token = signPatientVisualSummaryShareToken(
      {
        tenantId: "tenant-1",
        caseId: "case-1",
        patientId: "patient-1",
        reportType: "surgery_post_op_summary",
      },
      SECRET,
      { exp: Date.now() + 60_000 }
    );
    const tampered = `${token}x`;
    assert.equal(verifyPatientVisualSummaryShareToken(tampered, SECRET), null);
  });

  it("builds patient-safe share paths without storage segments", () => {
    const path = buildPatientVisualSummarySharePath({
      tenantId: "tenant-1",
      token: "abc.def",
    });
    assert.equal(path, "/patient/tenant-1/visual-summary/shared/pdf?token=abc.def");
    assert.equal(path.includes("storage"), false);
  });

  it("does not leak staff approval ids in default approval fixture", () => {
    const draft = defaultPatientVisualSummaryApproval("surgery_post_op_summary");
    assert.equal(draft.approved_by, null);
  });
});