import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { promoteInboundPathologyDocument } from "@/src/lib/pathology/pathologyInboxMutations.server";
import type {
  PathologyExtractionJobRow,
  PathologyInboundDocumentRow,
} from "@/src/lib/pathology/pathologyInboxTypes";
import {
  isPathologyAutoDraftEnabledFromEnv,
  isPathologyExtractionEnabledFromEnv,
} from "@/src/lib/pathology/pathologyExtractionEnv";
import {
  buildPathologyExtractionIdempotencyKey,
  enqueuePathologyExtractionJob,
  maybeEnqueueAndRunPathologyExtractionAfterUpload,
  runPathologyExtractionForDocument,
} from "@/src/lib/pathology/pathologyExtractionJobRunner.server";
import { createDraftPathologyResultFromExtraction } from "@/src/lib/pathology/pathologyAutoDraftResult.server";
import { extractPathologyMarkersFromPdf } from "@/src/lib/pathology/pathologyPdfExtractCore";
import { buildPathologyMedicalIntelligencePreview } from "@/src/lib/pathology/pathologyExtractionPreview.server";
import { normalizePathologyExtractedMarkers } from "@/src/lib/pathology/pathologyMarkerNormalize";
import {
  runPathologyExtractionOnPdf,
  setPathologyExtractionProviderForTests,
} from "@/src/lib/pathology/pathologyExtractionWorker.server";
import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const PATIENT = "patient-1";
const DOC = "doc-1";
const JOB = "job-1";
const RESULT = "result-1";

type MockState = {
  inbound: PathologyInboundDocumentRow;
  jobs: Map<string, PathologyExtractionJobRow>;
  jobByKey: Map<string, string>;
  inboundEvents: Record<string, unknown>[];
  result: PathologyResultRow | null;
  items: PathologyResultItemRow[];
  patients: Set<string>;
  storage: Map<string, Uint8Array>;
  env: Record<string, string | undefined>;
};

function inboundRow(partial: Partial<PathologyInboundDocumentRow> = {}): PathologyInboundDocumentRow {
  return {
    id: DOC,
    tenant_id: TENANT,
    source_channel: "manual_upload",
    storage_bucket: "patient-images",
    storage_path: `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`,
    original_filename: "lab.pdf",
    content_type: "application/pdf",
    match_status: "pending",
    suggested_patient_id: null,
    confirmed_patient_id: null,
    match_confidence: null,
    match_evidence: {},
    extracted_patient_name: null,
    extracted_dob: null,
    extracted_mrn: null,
    promoted_result_id: null,
    extraction_status: "not_started",
    extraction_job_id: null,
    draft_result_id: null,
    ready_for_review_at: null,
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
    ...partial,
  };
}

function jobRow(partial: Partial<PathologyExtractionJobRow> = {}): PathologyExtractionJobRow {
  return {
    id: JOB,
    tenant_id: TENANT,
    inbound_document_id: DOC,
    result_id: null,
    status: "queued",
    provider: null,
    raw_extraction_json: {},
    normalized_items_json: [],
    error_message: null,
    idempotency_key: buildPathologyExtractionIdempotencyKey(TENANT, DOC),
    started_at: null,
    completed_at: null,
    extracted_marker_count: 0,
    skipped_marker_count: 0,
    review_status: "pending_review",
    raw_text_preview: null,
    medical_intelligence_preview_json: {},
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
    ...partial,
  };
}

function createMockSupabase(state: MockState): SupabaseClient {
  const client = {
    from(table: string) {
      if (table === "fi_pathology_inbound_documents") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const filters = { [col]: val };
                return {
                  eq(col2: string, val2: string) {
                    const all = { ...filters, [col2]: val2 };
                    return {
                      maybeSingle: async () => {
                        if (all.tenant_id === OTHER_TENANT) return { data: null, error: null };
                        if (all.id && all.id !== state.inbound.id) return { data: null, error: null };
                        if (all.tenant_id && all.tenant_id !== TENANT) return { data: null, error: null };
                        return { data: state.inbound, error: null };
                      },
                      single: async () => ({ data: state.inbound, error: null }),
                    };
                  },
                  order() {
                    return Promise.resolve({ data: [state.inbound], error: null });
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            state.inbound = inboundRow({
              id: DOC,
              tenant_id: String(payload.tenant_id),
              match_status: String(payload.match_status || "pending") as PathologyInboundDocumentRow["match_status"],
            });
            return {
              select() {
                return { single: async () => ({ data: state.inbound, error: null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(_c: string, _v: string) {
                return {
                  eq(_c2: string, _v2: string) {
                    state.inbound = { ...state.inbound, ...(patch as Partial<PathologyInboundDocumentRow>) };
                    return {
                      select() {
                        return { single: async () => ({ data: state.inbound, error: null }) };
                      },
                      then(onFulfilled: (v: unknown) => unknown) {
                        return Promise.resolve({ error: null }).then(onFulfilled);
                      },
                    };
                  },
                  select() {
                    return { single: async () => ({ data: state.inbound, error: null }) };
                  },
                  then(onFulfilled: (v: unknown) => unknown) {
                    state.inbound = { ...state.inbound, ...(patch as Partial<PathologyInboundDocumentRow>) };
                    return Promise.resolve({ error: null }).then(onFulfilled);
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_pathology_extraction_jobs") {
        return {
          select(_cols?: string) {
            return {
              eq(col: string, val: string) {
                const filters: Record<string, string> = { [col]: val };
                return {
                  eq(col2: string, val2: string) {
                    filters[col2] = val2;
                    return {
                      maybeSingle: async () => {
                        if (filters.idempotency_key) {
                          const id = state.jobByKey.get(filters.idempotency_key);
                          if (!id) return { data: null, error: null };
                          return { data: state.jobs.get(id), error: null };
                        }
                        if (filters.id) {
                          const row = state.jobs.get(filters.id);
                          return { data: row ?? null, error: null };
                        }
                        return { data: null, error: null };
                      },
                      single: async () => {
                        const row = filters.id ? state.jobs.get(filters.id) : null;
                        return { data: row, error: row ? null : { message: "not found" } };
                      },
                    };
                  },
                  maybeSingle: async () => {
                    if (filters.idempotency_key) {
                      const id = state.jobByKey.get(filters.idempotency_key);
                      return { data: id ? state.jobs.get(id) : null, error: null };
                    }
                    return { data: null, error: null };
                  },
                  in(_col: string, vals: string[]) {
                    const rows = vals.map((id) => state.jobs.get(id)).filter(Boolean);
                    return Promise.resolve({ data: rows, error: null });
                  },
                };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            const id = `job-${state.jobs.size + 1}`;
            const row = jobRow({
              id,
              tenant_id: String(payload.tenant_id),
              inbound_document_id: payload.inbound_document_id != null ? String(payload.inbound_document_id) : null,
              idempotency_key: String(payload.idempotency_key),
              status: String(payload.status ?? "queued") as PathologyExtractionJobRow["status"],
            });
            state.jobs.set(id, row);
            state.jobByKey.set(row.idempotency_key, id);
            return {
              select() {
                return { single: async () => ({ data: row, error: null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                const filters: Record<string, string> = { [col]: val };
                return {
                  eq(col2: string, val2: string) {
                    filters[col2] = val2;
                    const jobId = filters.id;
                    const existing = jobId ? state.jobs.get(jobId) : undefined;
                    if (!existing) {
                      return {
                        select() {
                          return {
                            single: async () => ({ data: null, error: { message: "not found" } }),
                          };
                        },
                      };
                    }
                    const next = {
                      ...existing,
                      ...(patch as Partial<PathologyExtractionJobRow>),
                      normalized_items_json: Array.isArray(patch.normalized_items_json)
                        ? patch.normalized_items_json
                        : existing.normalized_items_json,
                      raw_extraction_json:
                        patch.raw_extraction_json && typeof patch.raw_extraction_json === "object"
                          ? (patch.raw_extraction_json as Record<string, unknown>)
                          : existing.raw_extraction_json,
                      medical_intelligence_preview_json:
                        patch.medical_intelligence_preview_json &&
                        typeof patch.medical_intelligence_preview_json === "object"
                          ? (patch.medical_intelligence_preview_json as Record<string, unknown>)
                          : existing.medical_intelligence_preview_json,
                    };
                    state.jobs.set(jobId, next);
                    return {
                      select() {
                        return { single: async () => ({ data: next, error: null }) };
                      },
                      then(onFulfilled: (v: unknown) => unknown) {
                        return Promise.resolve({ error: null }).then(onFulfilled);
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_pathology_inbound_document_events") {
        return {
          insert(row: Record<string, unknown>) {
            state.inboundEvents.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "fi_patients") {
        return {
          select() {
            return {
              eq(_c: string, _v: string) {
                return {
                  eq(_c2: string, pid: string) {
                    return {
                      maybeSingle: async () =>
                        state.patients.has(pid)
                          ? { data: { id: pid, person_id: "person-1" }, error: null }
                          : { data: null, error: null },
                    };
                  },
                  in(_c: string, vals: string[]) {
                    return Promise.resolve({
                      data: vals.filter((id) => state.patients.has(id)).map((id) => ({ id, person_id: "person-1" })),
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_persons") {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      data: [{ id: "person-1", metadata: { hubspot: { first_name: "Jane", last_name: "Doe" } } }],
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_pathology_results") {
        return {
          insert(payload: Record<string, unknown>) {
            state.result = {
              id: RESULT,
              tenant_id: TENANT,
              patient_id: String(payload.patient_id),
              pathology_request_id: null,
              result_date: String(payload.result_date),
              provider_name: null,
              source_type: "uploaded_pdf",
              uploaded_file_bucket: "patient-images",
              uploaded_file_path: `tenant/${TENANT}/patients/${PATIENT}/pathology-results/${RESULT}.pdf`,
              status: String(payload.status) as PathologyResultRow["status"],
              clinical_summary: null,
              reviewed_by_user_id: null,
              reviewed_at: null,
              metadata: {},
              created_at: "2026-07-02T10:00:00.000Z",
              updated_at: "2026-07-02T10:00:00.000Z",
            };
            return {
              select() {
                return { single: async () => ({ data: state.result, error: null }) };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      select() {
                        return {
                          single: async () => {
                            if (!state.result) return { data: null, error: { message: "missing" } };
                            state.result = { ...state.result, ...(patch as Partial<PathologyResultRow>) };
                            return { data: state.result, error: null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "fi_pathology_result_items") {
        return {
          delete() {
            return {
              eq() {
                return {
                  eq() {
                    state.items = [];
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
          insert(rows: Record<string, unknown>[]) {
            state.items = rows.map((row, idx) => ({
              id: `item-${idx + 1}`,
              tenant_id: TENANT,
              result_id: RESULT,
              test_code: row.test_code != null ? String(row.test_code) : null,
              test_label: String(row.test_label),
              result_value: String(row.result_value ?? ""),
              result_unit: row.result_unit != null ? String(row.result_unit) : null,
              reference_range: row.reference_range != null ? String(row.reference_range) : null,
              flag: String(row.flag) as PathologyResultItemRow["flag"],
              sort_order: idx,
              metadata: {},
              created_at: "2026-07-02T10:00:00.000Z",
            }));
            return { select: async () => ({ data: state.items, error: null }) };
          },
        };
      }

      if (table === "fi_crm_activity_events") {
        return {
          insert() {
            return { select() { return { single: async () => ({ data: { id: "evt-1" }, error: null }) }; } };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from(_bucket: string) {
        return {
          upload: async (path: string, bytes: Uint8Array) => {
            state.storage.set(path, bytes);
            return { error: null };
          },
          download: async (path: string) => {
            const bytes = state.storage.get(path);
            if (!bytes) return { data: null, error: { message: "missing" } };
            return { data: new Blob([bytes as BlobPart]), error: null };
          },
        };
      },
    },
  };

  return client as unknown as SupabaseClient;
}

const SAMPLE_MARKERS = [
  {
    test_label: "Ferritin",
    result_value: "45",
    result_unit: "ug/L",
    reference_range: "30-300",
    flag: "normal",
    confidence: 0.9,
  },
  {
    test_label: "Vitamin D",
    result_value: "62",
    result_unit: "nmol/L",
    reference_range: "50-200",
    flag: "normal",
    confidence: 0.88,
  },
];

test("feature flags default to disabled", () => {
  assert.equal(isPathologyExtractionEnabledFromEnv({}), false);
  assert.equal(isPathologyAutoDraftEnabledFromEnv({}), false);
  assert.equal(isPathologyExtractionEnabledFromEnv({ PATHOLOGY_EXTRACTION_ENABLED: "true" }), true);
});

test("extraction idempotency key is stable per document", () => {
  const a = buildPathologyExtractionIdempotencyKey(TENANT, DOC);
  const b = buildPathologyExtractionIdempotencyKey(TENANT, DOC);
  assert.equal(a, b);
  assert.notEqual(a, buildPathologyExtractionIdempotencyKey(TENANT, DOC, "retry-1"));
});

test("embedded JSON fixture extracts markers", () => {
  const pdfText = `FI_PATHOLOGY_MARKERS_JSON=${JSON.stringify(SAMPLE_MARKERS)}`;
  const out = extractPathologyMarkersFromPdf(new TextEncoder().encode(pdfText));
  assert.equal(out.source, "embedded_json");
  assert.equal(out.markers.length, 2);
});

test("medical intelligence preview is generated from extracted markers", () => {
  const normalized = normalizePathologyExtractedMarkers(SAMPLE_MARKERS);
  const preview = buildPathologyMedicalIntelligencePreview(normalized);
  assert.ok(preview);
  assert.ok(preview!.interpretedMarkers.length >= 1);
  assert.equal(preview!.clinicianReviewRequired, true);
});

test("enqueue extraction job is idempotent", async () => {
  const state: MockState = {
    inbound: inboundRow(),
    jobs: new Map(),
    jobByKey: new Map(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map(),
    env: {},
  };
  const client = createMockSupabase(state);

  const first = await enqueuePathologyExtractionJob(
    { tenantId: TENANT, documentId: DOC, actingUserId: null },
    client
  );
  const second = await enqueuePathologyExtractionJob(
    { tenantId: TENANT, documentId: DOC, actingUserId: null },
    client
  );

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.job.id, second.job.id);
});

test("unmatched document stores extraction preview but does not create draft result", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const pdfBytes = new TextEncoder().encode(
    `FI_PATHOLOGY_MARKERS_JSON=${JSON.stringify(SAMPLE_MARKERS)}`
  );

  const state: MockState = {
    inbound: inboundRow({ match_status: "pending", storage_path: pdfPath }),
    jobs: new Map(),
    jobByKey: new Map(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map([[pdfPath, pdfBytes]]),
    env: { PATHOLOGY_EXTRACTION_ENABLED: "true" },
  };
  const client = createMockSupabase(state);

  const prevExtract = process.env.PATHOLOGY_EXTRACTION_ENABLED;
  process.env.PATHOLOGY_EXTRACTION_ENABLED = "true";
  try {
    setPathologyExtractionProviderForTests(() => ({
      provider: "test",
      rawText: "fixture",
      markers: SAMPLE_MARKERS,
      ocrConfidence: 0.95,
      source: "embedded_json",
      skippedRawCount: 0,
    }));

    const out = await runPathologyExtractionForDocument(TENANT, DOC, null, client);
    assert.equal(out.job.status, "succeeded");
    assert.equal(out.job.extracted_marker_count, 2);
    assert.equal(state.inbound.draft_result_id, null);
    assert.equal(state.result, null);
    assert.ok(state.inboundEvents.some((e) => e.event_type === "ready_for_review"));
  } finally {
    setPathologyExtractionProviderForTests(null);
    process.env.PATHOLOGY_EXTRACTION_ENABLED = prevExtract;
  }
});

test("matched document creates draft result from extracted markers", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const succeededJob = jobRow({
    status: "succeeded",
    normalized_items_json: normalizePathologyExtractedMarkers(SAMPLE_MARKERS),
    extracted_marker_count: 2,
  });

  const state: MockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      extraction_job_id: JOB,
      extraction_status: "succeeded",
    }),
    jobs: new Map([[JOB, succeededJob]]),
    jobByKey: new Map([[succeededJob.idempotency_key, JOB]]),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map([[pdfPath, new Uint8Array([1, 2, 3])]]),
    env: {},
  };
  const client = createMockSupabase(state);

  const out = await createDraftPathologyResultFromExtraction(
    { tenantId: TENANT, documentId: DOC, actingUserId: null },
    client
  );

  assert.equal(out.created, true);
  assert.equal(out.resultId, RESULT);
  assert.equal(state.result?.status, "draft");
  assert.equal(state.items.length, 2);
  assert.equal(state.inbound.draft_result_id, RESULT);
});

test("draft result is not reviewed automatically", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const succeededJob = jobRow({
    status: "succeeded",
    normalized_items_json: normalizePathologyExtractedMarkers(SAMPLE_MARKERS),
    extracted_marker_count: 1,
  });

  const state: MockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      extraction_job_id: JOB,
      extraction_status: "succeeded",
    }),
    jobs: new Map([[JOB, succeededJob]]),
    jobByKey: new Map([[succeededJob.idempotency_key, JOB]]),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map([[pdfPath, new Uint8Array([1])]]),
    env: {},
  };
  const client = createMockSupabase(state);

  await createDraftPathologyResultFromExtraction(
    { tenantId: TENANT, documentId: DOC, actingUserId: null },
    client
  );

  assert.equal(state.result?.status, "draft");
  assert.equal(state.result?.reviewed_at, null);
  assert.equal(state.result?.metadata?.medical_intelligence_snapshot, undefined);
});

test("failed extraction does not block manual promotion", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const state: MockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      extraction_status: "failed",
      extraction_job_id: JOB,
    }),
    jobs: new Map([[JOB, jobRow({ status: "failed", error_message: "OCR failed" })]]),
    jobByKey: new Map(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map([[pdfPath, new Uint8Array([9])]]),
    env: {},
  };
  const client = createMockSupabase(state);

  const out = await promoteInboundPathologyDocument(
    {
      tenantId: TENANT,
      documentId: DOC,
      resultDate: "2026-07-02",
      providerName: null,
      clinicalSummary: null,
      status: "draft",
      items: [],
      actingUserId: null,
    },
    client
  );

  assert.ok(out.resultId);
  assert.equal(state.inbound.match_status, "promoted");
});

test("dismissed extraction cannot auto-create draft", async () => {
  const succeededJob = jobRow({
    status: "succeeded",
    review_status: "dismissed",
    normalized_items_json: normalizePathologyExtractedMarkers(SAMPLE_MARKERS),
  });

  const state: MockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      extraction_job_id: JOB,
      extraction_status: "succeeded",
    }),
    jobs: new Map([[JOB, succeededJob]]),
    jobByKey: new Map([[succeededJob.idempotency_key, JOB]]),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map(),
    env: {},
  };
  const client = createMockSupabase(state);

  await assert.rejects(
    () =>
      createDraftPathologyResultFromExtraction(
        { tenantId: TENANT, documentId: DOC, actingUserId: null },
        client
      ),
    /Dismissed extractions cannot create draft results/
  );
});

test("tenant scoping enforced on extraction enqueue", async () => {
  const state: MockState = {
    inbound: inboundRow(),
    jobs: new Map(),
    jobByKey: new Map(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map(),
    env: {},
  };
  const client = createMockSupabase(state);

  const prev = process.env.PATHOLOGY_EXTRACTION_ENABLED;
  process.env.PATHOLOGY_EXTRACTION_ENABLED = "true";
  try {
    setPathologyExtractionProviderForTests(() => ({
      provider: "test",
      rawText: "",
      markers: SAMPLE_MARKERS,
      ocrConfidence: 0.9,
      source: "embedded_json",
      skippedRawCount: 0,
    }));

    await assert.rejects(
      () => runPathologyExtractionForDocument(OTHER_TENANT, DOC, null, client),
      /Inbound document not found|Extraction job not found|not found/
    );
  } finally {
    setPathologyExtractionProviderForTests(null);
    process.env.PATHOLOGY_EXTRACTION_ENABLED = prev;
  }
});

test("upload does not enqueue extraction when flag disabled", async () => {
  const prev = process.env.PATHOLOGY_EXTRACTION_ENABLED;
  process.env.PATHOLOGY_EXTRACTION_ENABLED = "false";
  try {
    assert.equal(isPathologyExtractionEnabledFromEnv(process.env), false);
    const out = await maybeEnqueueAndRunPathologyExtractionAfterUpload(TENANT, DOC, null);
    assert.equal(out, null);
  } finally {
    process.env.PATHOLOGY_EXTRACTION_ENABLED = prev;
  }
});

test("upload enqueues extraction when flag enabled", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const state: MockState = {
    inbound: inboundRow({ storage_path: pdfPath }),
    jobs: new Map(),
    jobByKey: new Map(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    storage: new Map([[pdfPath, new TextEncoder().encode(`FI_PATHOLOGY_MARKERS_JSON=${JSON.stringify(SAMPLE_MARKERS)}`)]]),
    env: {},
  };
  const client = createMockSupabase(state);
  const prev = process.env.PATHOLOGY_EXTRACTION_ENABLED;
  process.env.PATHOLOGY_EXTRACTION_ENABLED = "true";
  try {
    setPathologyExtractionProviderForTests(() => ({
      provider: "test",
      rawText: "fixture",
      markers: SAMPLE_MARKERS,
      ocrConfidence: 0.95,
      source: "embedded_json",
      skippedRawCount: 0,
    }));
    const out = await maybeEnqueueAndRunPathologyExtractionAfterUpload(TENANT, DOC, null, client);
    assert.ok(out);
    assert.equal(out!.status, "succeeded");
    assert.ok(state.inboundEvents.some((e) => e.event_type === "extraction_queued"));
  } finally {
    setPathologyExtractionProviderForTests(null);
    process.env.PATHOLOGY_EXTRACTION_ENABLED = prev;
  }
});

test("worker maps markers through normalization pipeline", async () => {
  setPathologyExtractionProviderForTests(() => ({
    provider: "test",
    rawText: "fixture",
    markers: [{ test_label: "Ferritin", result_value: "45", result_unit: "ug/L", flag: "normal" }],
    ocrConfidence: 0.8,
    source: "embedded_json",
    skippedRawCount: 0,
  }));
  try {
    const out = await runPathologyExtractionOnPdf(new Uint8Array([1]));
    assert.equal(out.extractedMarkerCount, 1);
    assert.ok(out.medicalIntelligencePreview);
  } finally {
    setPathologyExtractionProviderForTests(null);
  }
});
