import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { IMAGING_QUALITY_POLICY_DEFAULTS } from "@/src/lib/imaging-os/imageQualityPolicy";
import {
  buildHairAuditPatientImageMetadata,
  HAIRAUDIT_DEFAULT_STORAGE_BUCKET,
  planHairAuditPatientImageInsert,
} from "./hairauditPatientImageDualWriteCore";
import { dualWriteHairAuditImagesToPatientLibrary } from "./hairauditPatientImageDualWrite.server";
import type { FiEventEnvelope } from "@/src/types/fi-events";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const STORAGE_PATH = `cases/${CASE}/patient/front/1.jpg`;

function buildEnvelope(): FiEventEnvelope {
  return {
    tenant_id: TENANT,
    event_type: "hairaudit.images.uploaded",
    source_system: "hairaudit",
    source_event_id: "evt-hairaudit-images-1",
    occurred_at: "2026-06-01T12:00:00.000Z",
    identifiers: {
      source_case_id: CASE,
      source_patient_id: "ha-patient-1",
    },
    payload: {
      images: [
        {
          type: "frontal",
          filename: "1.jpg",
          storage_path: STORAGE_PATH,
          mime_type: "image/jpeg",
          size_bytes: 2048,
        },
      ],
    },
  };
}

function createMockSupabase(input: {
  foundationPatientId?: string | null;
  existingPaths?: Set<string>;
  insertShouldFail?: boolean;
  onInsert?: (row: Record<string, unknown>) => void;
}): SupabaseClient {
  const insertedPaths: string[] = [];
  const existingPaths = input.existingPaths ?? new Set<string>();

  return {
    from(table: string) {
      let storagePathFilter: string | undefined;

      const chain = {
        select: () => chain,
        eq: (col: string, val: string) => {
          if (table === "fi_patient_images" && col === "storage_path") {
            storagePathFilter = val;
          }
          return chain;
        },
        maybeSingle: async () => {
          if (table === "fi_cases") {
            return {
              data: input.foundationPatientId
                ? { foundation_patient_id: input.foundationPatientId }
                : { foundation_patient_id: null },
              error: null,
            };
          }
          if (table === "fi_patients") {
            return {
              data: input.foundationPatientId
                ? { id: input.foundationPatientId, person_id: "person-1" }
                : null,
              error: null,
            };
          }
          if (table === "fi_patient_images") {
            if (storagePathFilter && existingPaths.has(storagePathFilter)) {
              return { data: { id: "existing-image" }, error: null };
            }
            return { data: null, error: null };
          }
          return { data: null, error: null };
        },
        insert: async (row: Record<string, unknown>) => {
          if (input.insertShouldFail) {
            return { error: { message: "dual-write insert failed", code: "XX000" } };
          }
          input.onInsert?.(row);
          const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
          if (storagePath) {
            insertedPaths.push(storagePath);
            existingPaths.add(storagePath);
          }
          return { error: null };
        },
      };

      return chain;
    },
  } as unknown as SupabaseClient;
}

describe("hairaudit patient image dual-write core", () => {
  it("plans canonical metadata for HairAudit images", () => {
    const plan = planHairAuditPatientImageInsert({
      image: {
        type: "frontal",
        filename: "1.jpg",
        storage_path: STORAGE_PATH,
        mime_type: "image/jpeg",
        size_bytes: 2048,
      },
      fiEventId: EVENT,
      sourceSystem: "hairaudit",
      sourceCaseId: CASE,
      sourcePatientId: "ha-patient-1",
      fiUploadId: "upload-1",
    });
    assert.ok(plan);
    assert.equal(plan.storage_bucket, HAIRAUDIT_DEFAULT_STORAGE_BUCKET);
    assert.equal(plan.storage_path, STORAGE_PATH);
    assert.equal(plan.metadata.upload_source, "hairaudit");
    assert.equal(plan.metadata.fi_upload_id, "upload-1");
    assert.equal(plan.metadata.canonical_view, "front");
  });

  it("dual-write enriches metadata with imaging_quality for HairAudit images", async () => {
    let insertedMetadata: Record<string, unknown> | undefined;
    const client = createMockSupabase({
      foundationPatientId: PATIENT,
      onInsert: (row) => {
        if (row.metadata && typeof row.metadata === "object") {
          insertedMetadata = row.metadata as Record<string, unknown>;
        }
      },
    });
    await dualWriteHairAuditImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      imagingQualityPolicy: IMAGING_QUALITY_POLICY_DEFAULTS,
      supabase: client,
    });
    assert.ok(insertedMetadata);
    assert.ok(insertedMetadata.imaging_quality);
    assert.ok(insertedMetadata.imaging_os_ingest);
    assert.ok(insertedMetadata.imaging_session);
  });

  it("buildHairAuditPatientImageMetadata includes audit relationships", () => {
    const meta = buildHairAuditPatientImageMetadata({
      fiEventId: EVENT,
      sourceSystem: "hairaudit",
      sourceCaseId: CASE,
      sourcePatientId: "ha-patient-1",
      globalCaseId: "global-case-1",
      hairauditImageType: "donor_back",
      canonicalView: "donor",
      classifierStatus: "pending",
    });
    assert.equal(meta.source_case_id, CASE);
    assert.equal(meta.global_case_id, "global-case-1");
    assert.equal(meta.classifier_status, "pending");
  });
});

describe("dualWriteHairAuditImagesToPatientLibrary", () => {
  it("writes fi_patient_images when foundation patient exists", async () => {
    const client = createMockSupabase({ foundationPatientId: PATIENT });
    const result = await dualWriteHairAuditImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      globalCaseId: "global-case-1",
      uploadIdsByStoragePath: { [STORAGE_PATH]: "upload-1" },
      supabase: client,
    });
    assert.equal(result.ok, true);
    assert.equal(result.inserted, 1);
    assert.equal(result.reused, 0);
  });

  it("does not duplicate canonical rows for repeated storage paths", async () => {
    const client = createMockSupabase({
      foundationPatientId: PATIENT,
      existingPaths: new Set([STORAGE_PATH]),
    });
    const result = await dualWriteHairAuditImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      supabase: client,
    });
    assert.equal(result.inserted, 0);
    assert.equal(result.reused, 1);
  });

  it("fails gracefully when foundation patient is missing", async () => {
    const client = createMockSupabase({ foundationPatientId: null });
    const result = await dualWriteHairAuditImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      supabase: client,
    });
    assert.equal(result.ok, false);
    assert.equal(result.skipped_reason, "missing_foundation_patient");
    assert.equal(result.inserted, 0);
  });

  it("records per-image errors without throwing", async () => {
    const client = createMockSupabase({
      foundationPatientId: PATIENT,
      insertShouldFail: true,
    });
    const result = await dualWriteHairAuditImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      supabase: client,
    });
    assert.equal(result.ok, false);
    assert.equal(result.inserted, 0);
    assert.ok(result.errors.length > 0);
  });
});