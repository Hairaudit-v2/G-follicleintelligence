import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";
import { buildStubClinicalImageAnalysis } from "./clinicalImageAnalysisCore";
import {
  assignImagingReviewToStaff,
  unassignImagingReview,
} from "./imagingReviewAssignmentMutations.server";
import { readImagingReviewAssignmentRecord } from "./imagingReviewAssignmentCore";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";

type Row = Record<string, unknown>;

function createImageStore(initial: Row) {
  const row = { ...initial };

  const from = (table: string) => {
    assert.equal(table, "fi_patient_images");
    const filters: Array<{ col: string; val: unknown }> = [];
    let mode: "select" | "update" = "select";
    let patch: Partial<Row> | null = null;

    const exec = () => {
      const match = filters.every((f) => row[f.col] === f.val);
      if (!match) return { data: null, error: null };
      if (mode === "update" && patch) Object.assign(row, patch);
      return { data: row, error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      update: (p: Partial<Row>) => {
        mode = "update";
        patch = p;
        return api;
      },
      eq: (col: string, val: unknown) => {
        filters.push({ col, val });
        return api;
      },
      maybeSingle: () => api,
      single: () => api,
      then: (resolve: (v: unknown) => void) => Promise.resolve(exec()).then(resolve),
    };
    return api;
  };

  return {
    client: { from } as unknown as import("@supabase/supabase-js").SupabaseClient,
    row,
  };
}

describe("imagingReviewAssignmentMutations", () => {
  const aiMeta = clinicalAnalysisResultToMetadataRecord(
    buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "img-1" })
  );

  it("assigns reviewer and preserves AI metadata", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      metadata: { imaging_clinical_ai: aiMeta },
    });
    await assignImagingReviewToStaff({
      tenantId: "tenant-1",
      patientId: "patient-1",
      patientImageId: "img-1",
      assignedToUserId: "reviewer-1",
      assignedByUserId: "admin-1",
      client,
    });
    const meta = row.metadata as Record<string, unknown>;
    assert.equal(readImagingReviewAssignmentRecord(meta)?.assigned_to, "reviewer-1");
    assert.equal(readImagingReviewAssignmentRecord(meta)?.assignment_status, "assigned");
    assert.deepEqual(readImagingClinicalAiMetadata(meta)?.provider, "stub");
  });

  it("unassign clears assignment", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      metadata: {
        imaging_clinical_ai: aiMeta,
        imaging_review_assignment: {
          assigned_to: "reviewer-1",
          assigned_by: "admin-1",
          assigned_at: "2026-01-01T00:00:00.000Z",
          assignment_status: "assigned",
          assignment_version: "imagingos_review_assignment_v1",
        },
      },
    });
    await unassignImagingReview({
      tenantId: "tenant-1",
      patientId: "patient-1",
      patientImageId: "img-1",
      assignedByUserId: "admin-1",
      client,
    });
    const meta = row.metadata as Record<string, unknown>;
    assert.equal(readImagingReviewAssignmentRecord(meta)?.assignment_status, "unassigned");
    assert.equal(readImagingReviewAssignmentRecord(meta)?.assigned_to, null);
  });

  it("tenant isolation — wrong tenant does not update", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      metadata: { imaging_clinical_ai: aiMeta },
    });
    await assert.rejects(() =>
      assignImagingReviewToStaff({
        tenantId: "tenant-other",
        patientId: "patient-1",
        patientImageId: "img-1",
        assignedToUserId: "reviewer-1",
        assignedByUserId: "admin-1",
        client,
      })
    );
    assert.equal(readImagingReviewAssignmentRecord(row.metadata as Record<string, unknown>), null);
  });
});