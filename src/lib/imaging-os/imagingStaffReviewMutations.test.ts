import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  flagImagingImageRetakeRequired,
  markImagingImageReviewed,
  reassignImagingImageViewType,
} from "./imagingStaffReviewMutations.server";
import { readImagingClinicalAiMetadata } from "./clinicalImageAnalysisCore";
import { buildStubClinicalImageAnalysis, clinicalAnalysisResultToMetadataRecord } from "./clinicalImageAnalysisCore";

type Row = Record<string, unknown>;

function createImageStore(initial: Row) {
  const row = { ...initial };

  const from = (table: string) => {
    assert.equal(table, "fi_patient_images");
    const filters: Array<{ col: string; val: unknown }> = [];
    let mode: "select" | "update" = "select";
    let patch: Partial<Row> | null = null;
    let terminal: "single" | "maybeSingle" = "maybeSingle";

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
      single: () => {
        terminal = "single";
        return api;
      },
      then: (resolve: (v: unknown) => void) => Promise.resolve(exec()).then(resolve),
    };
    return api;
  };

  return {
    client: { from } as unknown as import("@supabase/supabase-js").SupabaseClient,
    row,
  };
}

describe("imagingStaffReviewMutations", () => {
  const aiMeta = clinicalAnalysisResultToMetadataRecord(
    buildStubClinicalImageAnalysis({ externalCategory: "donor", idempotencyKey: "img-1" })
  );

  it("mark reviewed preserves AI metadata", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      ai_image_category: "donor",
      metadata: { imaging_clinical_ai: aiMeta },
    });
    await markImagingImageReviewed({
      tenantId: "tenant-1",
      patientId: "patient-1",
      patientImageId: "img-1",
      reviewedByUserId: "user-1",
      client,
    });
    const meta = row.metadata as Record<string, unknown>;
    assert.deepEqual(readImagingClinicalAiMetadata(meta)?.provider, "stub");
    assert.equal((meta.imaging_staff_review as { status: string }).status, "reviewed");
  });

  it("flag retake sets retake_required", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      metadata: { imaging_clinical_ai: aiMeta },
    });
    await flagImagingImageRetakeRequired({
      tenantId: "tenant-1",
      patientId: "patient-1",
      patientImageId: "img-1",
      reviewedByUserId: "user-1",
      staffNote: "Please retake with better lighting",
      client,
    });
    const staff = (row.metadata as Record<string, unknown>).imaging_staff_review as {
      status: string;
      staff_note?: string;
    };
    assert.equal(staff.status, "retake_required");
    assert.match(staff.staff_note ?? "", /lighting/i);
  });

  it("reassign view type updates ai_image_category", async () => {
    const { client, row } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      ai_image_category: "donor",
      metadata: { imaging_clinical_ai: aiMeta },
    });
    await reassignImagingImageViewType({
      tenantId: "tenant-1",
      patientId: "patient-1",
      patientImageId: "img-1",
      assignedViewType: "recipient",
      reviewedByUserId: "user-1",
      client,
    });
    assert.equal(row.ai_image_category, "front");
    const staff = (row.metadata as Record<string, unknown>).imaging_staff_review as {
      status: string;
      assigned_view_type?: string;
    };
    assert.equal(staff.status, "view_reassigned");
    assert.equal(staff.assigned_view_type, "recipient");
    assert.deepEqual(readImagingClinicalAiMetadata(row.metadata as Record<string, unknown>)?.view_type, "donor");
  });

  it("rejects invalid view type", async () => {
    const { client } = createImageStore({
      id: "img-1",
      tenant_id: "tenant-1",
      patient_id: "patient-1",
      image_status: "active",
      metadata: {},
    });
    await assert.rejects(
      () =>
        reassignImagingImageViewType({
          tenantId: "tenant-1",
          patientId: "patient-1",
          patientImageId: "img-1",
          assignedViewType: "invalid_view_xyz",
          reviewedByUserId: "user-1",
          client,
        }),
      /Invalid view type/
    );
  });

  it("enforces tenant isolation on missing image", async () => {
    const { client } = createImageStore({
      id: "img-1",
      tenant_id: "other-tenant",
      patient_id: "patient-1",
      image_status: "active",
      metadata: {},
    });
    await assert.rejects(
      () =>
        markImagingImageReviewed({
          tenantId: "tenant-1",
          patientId: "patient-1",
          patientImageId: "img-1",
          reviewedByUserId: "user-1",
          client,
        }),
      /not found/
    );
  });
});