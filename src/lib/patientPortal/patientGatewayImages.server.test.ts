import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPatientImageRecord } from "@/src/lib/patientImages/patientImagesServer";
import {
  PATIENT_PORTAL_IMAGE_SLOT_OPTIONS,
  buildPatientPortalImageUploadFields,
} from "@/src/lib/patientPortal/patientPortalImageUploadCore";

import {
  completePatientGatewayUpload,
  createPatientGatewayUploadIntent,
  listPatientGatewayImages,
} from "./patientGatewayImages.server";
import type { PatientGatewayContext } from "./patientGatewayTypes";
import { signPatientGatewayUploadIntent } from "./patientGatewayUploadIntentCore";

const AUTH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AUTH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PATIENT_A = "11111111-1111-4111-8111-111111111111";
const PATIENT_B = "22222222-2222-4222-8222-222222222222";
const TENANT_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const TENANT_B = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const IMAGE_A = "33333333-3333-4333-8333-333333333333";
const IMAGE_B = "44444444-4444-4444-8444-444444444444";
const SECRET = "fi-patient-gateway-1c-test-secret";

const CTX_A: PatientGatewayContext = {
  authUserId: AUTH_A,
  patientId: PATIENT_A,
  tenantId: TENANT_A,
  personId: "55555555-5555-4555-8555-555555555555",
  patientStatus: "active",
  clinicName: "Clinic A",
};

const CTX_B: PatientGatewayContext = {
  ...CTX_A,
  authUserId: AUTH_B,
  patientId: PATIENT_B,
  tenantId: TENANT_B,
  clinicName: "Clinic B",
};

function imageRow(overrides: Record<string, unknown>) {
  return {
    id: IMAGE_A,
    tenant_id: TENANT_A,
    patient_id: PATIENT_A,
    image_category: "progress",
    image_status: "active",
    patient_portal_release_status: "released",
    imaging_protocol_slot_slug: "fu_front",
    imaging_library_axis: "follow_up",
    storage_bucket: "patient-images",
    storage_path: `tenant/${TENANT_A}/patients/${PATIENT_A}/${IMAGE_A}-x.jpg`,
    taken_at: "2026-07-01T00:00:00.000Z",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    visit_type: null,
    imaging_protocol_template_slug: "follow_up_review",
    ...overrides,
  };
}

function createListMock(rows: Record<string, unknown>[]) {
  return {
    from(table: string) {
      const state: { filters: Record<string, string> } = { filters: {} };
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          state.filters[col] = val;
          return builder;
        },
        order() {
          return builder;
        },
        limit() {
          return builder;
        },
        then(resolve: (v: { data: unknown; error: null }) => unknown) {
          if (table !== "fi_patient_images") {
            return Promise.resolve(resolve({ data: [], error: null }));
          }
          const filtered = rows.filter((r) => {
            if (state.filters.tenant_id && String(r.tenant_id) !== state.filters.tenant_id) {
              return false;
            }
            if (state.filters.patient_id && String(r.patient_id) !== state.filters.patient_id) {
              return false;
            }
            if (state.filters.image_status && String(r.image_status) !== state.filters.image_status) {
              return false;
            }
            return true;
          });
          return Promise.resolve(resolve({ data: filtered, error: null }));
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          createSignedUrl: async () => ({
            data: { signedUrl: "https://signed.example/preview" },
            error: null,
          }),
        };
      },
    },
  };
}

function createCompleteMock(opts: {
  existingById?: Record<string, unknown> | null;
  existingByPath?: Record<string, unknown> | null;
  storageOk?: boolean;
}) {
  return {
    from(table: string) {
      const state: { filters: Record<string, string>; op: "id" | "path" | "unknown" } = {
        filters: {},
        op: "unknown",
      };
      const builder: Record<string, unknown> = {
        select() {
          return builder;
        },
        eq(col: string, val: string) {
          state.filters[col] = val;
          if (col === "id") state.op = "id";
          if (col === "storage_path") state.op = "path";
          return builder;
        },
        maybeSingle: async () => {
          if (table !== "fi_patient_images") return { data: null, error: null };
          if (state.op === "id") return { data: opts.existingById ?? null, error: null };
          if (state.op === "path") return { data: opts.existingByPath ?? null, error: null };
          return { data: null, error: null };
        },
      };
      return builder;
    },
    storage: {
      from() {
        return {
          createSignedUrl: async () =>
            opts.storageOk === false
              ? { data: null, error: { message: "Object not found" } }
              : { data: { signedUrl: "https://signed.example/obj" }, error: null },
        };
      },
    },
  };
}

describe("patientGatewayImages.server security", () => {
  it("A. Patient A lists only Patient A images", async () => {
    const rows = [
      imageRow({ id: IMAGE_A, patient_id: PATIENT_A, tenant_id: TENANT_A }),
      imageRow({ id: IMAGE_B, patient_id: PATIENT_B, tenant_id: TENANT_B }),
    ];
    const result = await listPatientGatewayImages(CTX_A, {
      writeAudit: false,
      supabase: createListMock(rows) as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.images.length, 1);
    assert.equal(result.images[0]?.id, IMAGE_A);
  });

  it("B. Patient A cannot see Patient B images via tenant/patient filters", async () => {
    const rows = [imageRow({ id: IMAGE_B, patient_id: PATIENT_B, tenant_id: TENANT_B })];
    const result = await listPatientGatewayImages(CTX_A, {
      writeAudit: false,
      supabase: createListMock(rows) as never,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.images.length, 0);
  });

  it("C/D. foreign patient ownership on leaked list row denied", async () => {
    // Simulate a buggy query that ignores patient_id filters — ownership guard fails closed.
    const leak = {
      from() {
        const builder: Record<string, unknown> = {
          select() {
            return builder;
          },
          eq() {
            return builder;
          },
          order() {
            return builder;
          },
          limit() {
            return builder;
          },
          then(resolve: (v: { data: unknown; error: null }) => unknown) {
            return Promise.resolve(
              resolve({
                data: [imageRow({ id: IMAGE_B, patient_id: PATIENT_B, tenant_id: TENANT_A })],
                error: null,
              })
            );
          },
        };
        return builder;
      },
      storage: {
        from() {
          return {
            createSignedUrl: async () => ({
              data: { signedUrl: "https://signed.example/preview" },
              error: null,
            }),
          };
        },
      },
    };
    const result = await listPatientGatewayImages(CTX_A, {
      writeAudit: false,
      supabase: leak as never,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "ownership_denied");
  });

  it("I. upload intent reused incorrectly denied", async () => {
    process.env.FI_INTERNAL_IMAGING_HMAC_SECRET = SECRET;
    const path = `tenant/${TENANT_A}/patients/${PATIENT_A}/${IMAGE_A}-gateway-upload.jpg`;
    const token = signPatientGatewayUploadIntent(
      {
        intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
        imageId: IMAGE_A,
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        authUserId: AUTH_A,
        slot: "front_hairline",
        mimeType: "image/jpeg",
        fileSize: 1000,
        bucket: "patient-images",
        storagePath: path,
      },
      SECRET
    );
    const result = await completePatientGatewayUpload(
      CTX_A,
      { intentToken: token },
      {
        writeAudit: false,
        supabase: createCompleteMock({
          existingById: { id: IMAGE_A, tenant_id: TENANT_A, patient_id: PATIENT_A },
          storageOk: true,
        }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "intent_replay");
  });

  it("H. tampered storage path denied", async () => {
    process.env.FI_INTERNAL_IMAGING_HMAC_SECRET = SECRET;
    const path = `tenant/${TENANT_A}/patients/${PATIENT_A}/${IMAGE_A}-gateway-upload.jpg`;
    const token = signPatientGatewayUploadIntent(
      {
        intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
        imageId: IMAGE_A,
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        authUserId: AUTH_A,
        slot: "front_hairline",
        mimeType: "image/jpeg",
        fileSize: 1000,
        bucket: "patient-images",
        storagePath: path,
      },
      SECRET
    );
    const result = await completePatientGatewayUpload(
      CTX_A,
      { intentToken: token, storagePath: "tenant/evil/patients/x/y.jpg" },
      {
        writeAudit: false,
        supabase: createCompleteMock({ storageOk: true }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "path_mismatch");
  });

  it("J. expired upload intent denied at complete", async () => {
    process.env.FI_INTERNAL_IMAGING_HMAC_SECRET = SECRET;
    const token = signPatientGatewayUploadIntent(
      {
        intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
        imageId: IMAGE_A,
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        authUserId: AUTH_A,
        slot: "front_hairline",
        mimeType: "image/jpeg",
        fileSize: 1000,
        bucket: "patient-images",
        storagePath: `tenant/${TENANT_A}/patients/${PATIENT_A}/${IMAGE_A}.jpg`,
        exp: Date.now() - 5000,
      },
      SECRET
    );
    const result = await completePatientGatewayUpload(
      CTX_A,
      { intentToken: token },
      {
        writeAudit: false,
        nowMs: Date.now(),
        supabase: createCompleteMock({ storageOk: true }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "intent_expired");
  });

  it("K. completion against another patient's upload denied", async () => {
    process.env.FI_INTERNAL_IMAGING_HMAC_SECRET = SECRET;
    const token = signPatientGatewayUploadIntent(
      {
        intentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
        imageId: IMAGE_A,
        tenantId: TENANT_A,
        patientId: PATIENT_A,
        authUserId: AUTH_A,
        slot: "front_hairline",
        mimeType: "image/jpeg",
        fileSize: 1000,
        bucket: "patient-images",
        storagePath: `tenant/${TENANT_A}/patients/${PATIENT_A}/${IMAGE_A}.jpg`,
      },
      SECRET
    );
    const result = await completePatientGatewayUpload(
      CTX_B,
      { intentToken: token },
      {
        writeAudit: false,
        supabase: createCompleteMock({ storageOk: true }) as never,
      }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.code === "ownership_denied" || result.code === "wrong_tenant");
  });

  it("upload-intent rejects invalid category without creating capability", async () => {
    process.env.FI_INTERNAL_IMAGING_HMAC_SECRET = SECRET;
    const result = await createPatientGatewayUploadIntent(
      CTX_A,
      { category: "progress", mimeType: "image/jpeg", fileSize: 1000 },
      { writeAudit: false, supabase: createListMock([]) as never }
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, "invalid_category");
  });

  it("L. staff createPatientImageRecord export remains available", () => {
    assert.equal(typeof createPatientImageRecord, "function");
  });

  it("M. existing patient portal upload surface remains available", () => {
    assert.ok(PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.length >= 3);
    assert.ok(PATIENT_PORTAL_IMAGE_SLOT_OPTIONS.some((s) => s.slug === "fu_front"));
    const fields = buildPatientPortalImageUploadFields({ protocolSlotSlug: "fu_front" });
    assert.equal(fields.capture_source, "patient_portal");
    assert.equal(fields.image_category, "progress");
  });
});
