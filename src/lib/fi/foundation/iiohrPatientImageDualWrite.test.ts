import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseFiEventEnvelope } from "@/lib/fi/events/schema";
import { buildPatientImageIngestionRequest } from "@/src/lib/imaging-core/ingest/buildPatientImageIngestionRequest";
import { IMAGING_QUALITY_POLICY_DEFAULTS } from "@/src/lib/imaging-os/imageQualityPolicy";
import {
  buildIiohrPatientImageMetadata,
  IIOHR_DEFAULT_STORAGE_BUCKET,
  IIOHR_PATIENT_IMAGE_UPLOAD_SOURCE,
  planIiohrPatientImageInsert,
  resolveIiohrImageStoragePath,
} from "./iiohrPatientImageDualWriteCore";
import { dualWriteIiohrImagesToPatientLibrary } from "./iiohrPatientImageDualWrite.server";
import { planHairAuditPatientImageInsert } from "./hairauditPatientImageDualWriteCore";
import type { FiEventEnvelope } from "@/src/types/fi-events";

const TENANT = "11111111-1111-4111-8111-111111111111";
const CASE = "22222222-2222-4222-8222-222222222222";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const EVENT = "44444444-4444-4444-8444-444444444444";
const ACADEMY_CASE = "academy-case-42";
const STORAGE_PATH = `tenant/${TENANT}/academy/${ACADEMY_CASE}/donor/rear.jpg`;

function buildEnvelope(overrides?: Partial<FiEventEnvelope["payload"]>): FiEventEnvelope {
  return {
    tenant_id: TENANT,
    event_type: "iiohr.images.uploaded",
    source_system: "iiohr",
    source_event_id: "evt-iiohr-images-1",
    occurred_at: "2026-06-01T12:00:00.000Z",
    identifiers: {
      source_case_id: ACADEMY_CASE,
      source_patient_id: "iiohr-patient-1",
    },
    payload: {
      academy_case_id: ACADEMY_CASE,
      patient_external_id: "iiohr-patient-1",
      professional_id: "prof-9",
      global_professional_id: "global-prof-9",
      storage_path: STORAGE_PATH,
      mime_type: "image/jpeg",
      original_filename: "rear.jpg",
      external_view: "donor_rear",
      canonical_view: "donor",
      uploaded_at: "2026-06-01T12:00:00.000Z",
      size_bytes: 4096,
      metadata: { academy_module: "graft_planning" },
      ...overrides,
    },
  };
}

function createMockSupabase(input: {
  foundationPatientId?: string | null;
  existingPaths?: Set<string>;
  onInsert?: (row: Record<string, unknown>) => void;
}): SupabaseClient {
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
          input.onInsert?.(row);
          const storagePath = typeof row.storage_path === "string" ? row.storage_path : "";
          if (storagePath) existingPaths.add(storagePath);
          return { error: null };
        },
      };

      return chain;
    },
    storage: {
      from() {
        return {
          createSignedUrl: async (path: string) => ({
            data: { signedUrl: `https://signed.example/${path}` },
            error: null,
          }),
        };
      },
    },
  } as unknown as SupabaseClient;
}

describe("iiohr.images.uploaded schema", () => {
  it("validates academy image payload", () => {
    const result = parseFiEventEnvelope(buildEnvelope());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.data.event_type, "iiohr.images.uploaded");
    assert.equal(result.data.source_system, "iiohr");
    const payload = result.data.payload as {
      academy_case_id?: string;
      storage_path?: string;
    };
    assert.equal(payload.academy_case_id, ACADEMY_CASE);
    assert.equal(payload.storage_path, STORAGE_PATH);
  });

  it("rejects payload without storage path or image url", () => {
    const result = parseFiEventEnvelope(
      buildEnvelope({ storage_path: undefined, image_url: undefined })
    );
    assert.equal(result.ok, false);
  });

  it("accepts image_url when storage_path is absent", () => {
    const result = parseFiEventEnvelope(
      buildEnvelope({
        storage_path: undefined,
        image_url: "https://cdn.example.com/academy/rear.jpg",
      })
    );
    assert.equal(result.ok, true);
  });
});

describe("iiohr patient image dual-write core", () => {
  it("plans canonical metadata for IIOHR academy images", () => {
    const plan = planIiohrPatientImageInsert({
      payload: {
        academy_case_id: ACADEMY_CASE,
        storage_path: STORAGE_PATH,
        original_filename: "rear.jpg",
        external_view: "donor_rear",
        professional_id: "prof-9",
      },
      fiEventId: EVENT,
      sourceSystem: "iiohr",
      academyCaseId: ACADEMY_CASE,
      sourcePatientId: "iiohr-patient-1",
      fiUploadId: "upload-1",
    });
    assert.ok(plan);
    assert.equal(plan.storage_bucket, IIOHR_DEFAULT_STORAGE_BUCKET);
    assert.equal(plan.metadata.upload_source, IIOHR_PATIENT_IMAGE_UPLOAD_SOURCE);
    assert.equal(plan.metadata.academy_case_id, ACADEMY_CASE);
    assert.equal(plan.metadata.professional_id, "prof-9");
    assert.equal(plan.metadata.dual_write, "imagingos_phase1_foundation");
  });

  it("resolveIiohrImageStoragePath prefers storage_path over image_url", () => {
    assert.equal(
      resolveIiohrImageStoragePath({
        storage_path: STORAGE_PATH,
        image_url: "https://cdn.example.com/rear.jpg",
      }),
      STORAGE_PATH
    );
  });

  it("buildIiohrPatientImageMetadata includes professional linkage", () => {
    const meta = buildIiohrPatientImageMetadata({
      fiEventId: EVENT,
      sourceSystem: "iiohr",
      academyCaseId: ACADEMY_CASE,
      sourcePatientId: "iiohr-patient-1",
      externalView: "donor_rear",
      canonicalView: "donor",
      professionalId: "prof-9",
      globalProfessionalId: "global-prof-9",
    });
    assert.equal(meta.upload_source, "iiohr");
    assert.equal(meta.capture_source, "iiohr_academy");
    assert.equal(meta.global_professional_id, "global-prof-9");
  });
});

describe("dualWriteIiohrImagesToPatientLibrary", () => {
  it("writes fi_patient_images when foundation patient exists", async () => {
    const client = createMockSupabase({ foundationPatientId: PATIENT });
    const result = await dualWriteIiohrImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      globalCaseId: "global-case-1",
      fiUploadId: "upload-1",
      imagingQualityPolicy: IMAGING_QUALITY_POLICY_DEFAULTS,
      supabase: client,
    });
    assert.equal(result.ok, true);
    assert.equal(result.inserted, 1);
    assert.equal(result.reused, 0);
  });

  it("routes dual-write metadata through iiohr adapter", async () => {
    let insertedMetadata: Record<string, unknown> | undefined;
    const client = createMockSupabase({
      foundationPatientId: PATIENT,
      onInsert: (row) => {
        if (row.metadata && typeof row.metadata === "object") {
          insertedMetadata = row.metadata as Record<string, unknown>;
        }
      },
    });
    await dualWriteIiohrImagesToPatientLibrary({
      tenantId: TENANT,
      fiEventId: EVENT,
      fiCaseId: CASE,
      envelope: buildEnvelope(),
      fiUploadId: "upload-1",
      imagingQualityPolicy: IMAGING_QUALITY_POLICY_DEFAULTS,
      supabase: client,
    });
    assert.ok(insertedMetadata);
    assert.equal(insertedMetadata.upload_source, "iiohr");
    const ingest = insertedMetadata.imaging_os_ingest as { source_system?: string };
    assert.equal(ingest.source_system, "iiohr");

    const request = buildPatientImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: "upload-1",
      case_id: CASE,
      storage_bucket: IIOHR_DEFAULT_STORAGE_BUCKET,
      storage_path: STORAGE_PATH,
      capture_source: "iiohr_academy",
      upload_source: "iiohr",
      external_category: "donor_rear",
    });
    assert.equal(request.source_system, "iiohr");
  });

  it("keeps HairAudit dual-write metadata unchanged", () => {
    const plan = planHairAuditPatientImageInsert({
      image: {
        type: "frontal",
        filename: "1.jpg",
        storage_path: `cases/${CASE}/front.jpg`,
        mime_type: "image/jpeg",
      },
      fiEventId: EVENT,
      sourceSystem: "hairaudit",
      sourceCaseId: CASE,
      sourcePatientId: "ha-patient-1",
    });
    assert.ok(plan);
    assert.equal(plan.metadata.upload_source, "hairaudit");
    assert.notEqual(plan.metadata.upload_source, "iiohr");
  });
});