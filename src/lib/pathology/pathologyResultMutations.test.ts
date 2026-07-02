import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE } from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";
import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";
import {
  createPathologyResult,
  markPathologyResultReviewed,
  patchPathologyResultDraft,
} from "@/src/lib/pathology/pathologyResultMutations.server";

const TENANT = "tenant-1";
const PATIENT = "patient-1";
const RESULT = "result-1";

function fiItem(
  partial: Partial<PathologyResultItemRow> &
    Pick<PathologyResultItemRow, "test_label" | "result_value">
): PathologyResultItemRow {
  return {
    id: partial.id ?? "item-1",
    tenant_id: partial.tenant_id ?? TENANT,
    result_id: partial.result_id ?? RESULT,
    test_code: partial.test_code ?? null,
    test_label: partial.test_label,
    result_value: partial.result_value,
    result_unit: partial.result_unit ?? null,
    reference_range: partial.reference_range ?? null,
    flag: partial.flag ?? "unknown",
    sort_order: partial.sort_order ?? 0,
    metadata: partial.metadata ?? {},
    created_at: partial.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

type MockState = {
  result: PathologyResultRow;
  items: PathologyResultItemRow[];
  crmEvents: Record<string, unknown>[];
};

function createMockSupabase(state: MockState): SupabaseClient {
  function eqChain(filters: Record<string, string>) {
    const matches = (row: Record<string, unknown>) =>
      Object.entries(filters).every(([key, val]) => String(row[key]) === val);

    return {
      eq(col: string, val: string) {
        return eqChain({ ...filters, [col]: val });
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return Promise.resolve({
          data: state.items.filter((item) => matches(item as unknown as Record<string, unknown>)),
          error: null,
        });
      },
      maybeSingle: async () => {
        if (matches(state.result as unknown as Record<string, unknown>)) {
          return { data: state.result, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: state.result, error: null }),
    };
  }

  const client = {
    from(table: string) {
      if (table === "fi_pathology_results") {
        return {
          select(_cols?: string) {
            return eqChain({});
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      select(_cols?: string) {
                        return {
                          single: async () => {
                            if (
                              String(state.result[col as keyof PathologyResultRow]) !== val ||
                              String(state.result[col2 as keyof PathologyResultRow]) !== val2
                            ) {
                              return { data: null, error: { message: "not found" } };
                            }
                            state.result = {
                              ...state.result,
                              ...(patch as Partial<PathologyResultRow>),
                              metadata:
                                patch.metadata &&
                                typeof patch.metadata === "object" &&
                                !Array.isArray(patch.metadata)
                                  ? (patch.metadata as Record<string, unknown>)
                                  : state.result.metadata,
                            };
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
          select(_cols?: string) {
            return eqChain({});
          },
          delete() {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ error: null });
                  },
                };
              },
            };
          },
          insert(rows: PathologyResultItemRow[] | Record<string, unknown>[]) {
            state.items = rows.map((row, idx) => ({
              ...fiItem({
                id: `item-${idx + 1}`,
                test_label: String((row as PathologyResultItemRow).test_label),
                result_value: String((row as PathologyResultItemRow).result_value),
              }),
              ...(row as PathologyResultItemRow),
            }));
            return {
              select(_cols?: string) {
                return Promise.resolve({ data: state.items, error: null });
              },
            };
          },
        };
      }

      if (table === "fi_crm_activity_events") {
        return {
          insert(row: Record<string, unknown>) {
            state.crmEvents.push(row);
            return {
              select(_cols?: string) {
                return {
                  single: async () => ({
                    data: { id: "evt-1", ...row },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from() {
        return {
          upload: async () => ({ error: null }),
        };
      },
    },
  };

  return client as unknown as SupabaseClient;
}

function createMockSupabaseForCreate(initialMetadata: Record<string, unknown> = {}): {
  client: SupabaseClient;
  state: MockState;
} {
  const state: MockState = {
    result: draftResult(initialMetadata),
    items: [],
    crmEvents: [],
  };

  function eqChain(filters: Record<string, string>) {
    const matches = (row: Record<string, unknown>) =>
      Object.entries(filters).every(([key, val]) => String(row[key]) === val);

    return {
      eq(col: string, val: string) {
        return eqChain({ ...filters, [col]: val });
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        return Promise.resolve({
          data: state.items.filter((item) => matches(item as unknown as Record<string, unknown>)),
          error: null,
        });
      },
      maybeSingle: async () => {
        if (tableIsPatient(filters)) {
          return { data: { id: PATIENT }, error: null };
        }
        if (matches(state.result as unknown as Record<string, unknown>)) {
          return { data: state.result, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: state.result, error: null }),
    };
  }

  function tableIsPatient(filters: Record<string, string>): boolean {
    return filters.tenant_id === TENANT && filters.id === PATIENT;
  }

  const client = {
    from(table: string) {
      if (table === "fi_patients") {
        return {
          select(_cols?: string) {
            return eqChain({});
          },
        };
      }

      if (table === "fi_pathology_results") {
        return {
          select(_cols?: string) {
            return eqChain({});
          },
          insert(payload: Record<string, unknown>) {
            state.result = {
              ...draftResult(
                payload.metadata &&
                  typeof payload.metadata === "object" &&
                  !Array.isArray(payload.metadata)
                  ? (payload.metadata as Record<string, unknown>)
                  : {}
              ),
              id: RESULT,
              tenant_id: String(payload.tenant_id),
              patient_id: String(payload.patient_id),
              pathology_request_id:
                payload.pathology_request_id != null ? String(payload.pathology_request_id) : null,
              result_date: String(payload.result_date ?? "").slice(0, 10),
              provider_name: payload.provider_name != null ? String(payload.provider_name) : null,
              source_type: String(payload.source_type) as PathologyResultRow["source_type"],
              status: String(payload.status) as PathologyResultRow["status"],
              clinical_summary:
                payload.clinical_summary != null ? String(payload.clinical_summary) : null,
              reviewed_by_user_id:
                payload.reviewed_by_user_id != null ? String(payload.reviewed_by_user_id) : null,
              reviewed_at: payload.reviewed_at != null ? String(payload.reviewed_at) : null,
              metadata:
                payload.metadata &&
                typeof payload.metadata === "object" &&
                !Array.isArray(payload.metadata)
                  ? (payload.metadata as Record<string, unknown>)
                  : {},
            };
            return {
              select(_cols?: string) {
                return {
                  single: async () => ({ data: state.result, error: null }),
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: string) {
                return {
                  eq(col2: string, val2: string) {
                    return {
                      select(_cols?: string) {
                        return {
                          single: async () => {
                            if (
                              String(state.result[col as keyof PathologyResultRow]) !== val ||
                              String(state.result[col2 as keyof PathologyResultRow]) !== val2
                            ) {
                              return { data: null, error: { message: "not found" } };
                            }
                            state.result = {
                              ...state.result,
                              ...(patch as Partial<PathologyResultRow>),
                              metadata:
                                patch.metadata &&
                                typeof patch.metadata === "object" &&
                                !Array.isArray(patch.metadata)
                                  ? (patch.metadata as Record<string, unknown>)
                                  : state.result.metadata,
                            };
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
          select(_cols?: string) {
            return eqChain({});
          },
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
          insert(rows: PathologyResultItemRow[] | Record<string, unknown>[]) {
            state.items = rows.map((row, idx) => ({
              ...fiItem({
                id: `item-${idx + 1}`,
                test_label: String((row as PathologyResultItemRow).test_label),
                result_value: String((row as PathologyResultItemRow).result_value),
              }),
              ...(row as PathologyResultItemRow),
            }));
            return {
              select(_cols?: string) {
                return Promise.resolve({ data: state.items, error: null });
              },
            };
          },
        };
      }

      if (table === "fi_crm_activity_events") {
        return {
          insert(row: Record<string, unknown>) {
            state.crmEvents.push(row);
            return {
              select(_cols?: string) {
                return {
                  single: async () => ({
                    data: { id: "evt-1", ...row },
                    error: null,
                  }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from() {
        return {
          upload: async () => ({ error: null }),
        };
      },
    },
  };

  return { client: client as unknown as SupabaseClient, state };
}

function draftResult(metadata: Record<string, unknown> = {}): PathologyResultRow {
  return {
    id: RESULT,
    tenant_id: TENANT,
    patient_id: PATIENT,
    pathology_request_id: null,
    result_date: "2026-07-01",
    provider_name: "LabCo",
    source_type: "manual_entry",
    uploaded_file_bucket: null,
    uploaded_file_path: null,
    status: "draft",
    clinical_summary: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    metadata,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}

test("markPathologyResultReviewed writes medical_intelligence_snapshot", async () => {
  const state: MockState = {
    result: draftResult(),
    items: [fiItem({ test_label: "Ferritin", result_value: "25", result_unit: "ug/L" })],
    crmEvents: [],
  };
  const client = createMockSupabase(state);

  const result = await markPathologyResultReviewed(
    TENANT,
    PATIENT,
    RESULT,
    "Reviewed summary",
    "user-1",
    client
  );

  assert.equal(result.status, "reviewed");
  const snapshot = result.metadata.medical_intelligence_snapshot as Record<string, unknown>;
  assert.ok(snapshot);
  assert.equal(snapshot.source, FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE);
  assert.equal(typeof snapshot.generated_at, "string");
  assert.ok(Array.isArray(snapshot.interpreted_markers));
  assert.equal((snapshot.interpreted_markers as unknown[]).length, 1);
});

test("patchPathologyResultDraft does not write medical_intelligence_snapshot", async () => {
  const state: MockState = {
    result: draftResult({ original_filename: "keep-me.pdf" }),
    items: [fiItem({ test_label: "Ferritin", result_value: "25" })],
    crmEvents: [],
  };
  const client = createMockSupabase(state);

  await patchPathologyResultDraft(
    TENANT,
    PATIENT,
    RESULT,
    {
      resultDate: "2026-07-02",
      providerName: "LabCo",
      pathologyRequestId: null,
      clinicalSummary: "Draft note",
      items: [{ test_label: "TSH", result_value: "2.1", flag: "normal" }],
    },
    client
  );

  assert.equal(state.result.metadata.original_filename, "keep-me.pdf");
  assert.equal(state.result.metadata.medical_intelligence_snapshot, undefined);
});

test("markPathologyResultReviewed preserves existing metadata keys", async () => {
  const state: MockState = {
    result: draftResult({ original_filename: "report.pdf", extraction_job_id: "job-9" }),
    items: [fiItem({ test_label: "Ferritin", result_value: "25" })],
    crmEvents: [],
  };
  const client = createMockSupabase(state);

  const result = await markPathologyResultReviewed(TENANT, PATIENT, RESULT, null, "user-1", client);

  assert.equal(result.metadata.original_filename, "report.pdf");
  assert.equal(result.metadata.extraction_job_id, "job-9");
  assert.ok(result.metadata.medical_intelligence_snapshot);
});

test("invalid or empty markers do not block markPathologyResultReviewed", async () => {
  const state: MockState = {
    result: draftResult(),
    items: [
      fiItem({ id: "a", test_label: "", result_value: "25" }),
      fiItem({ id: "b", test_label: "Notes", result_value: "see comment" }),
    ],
    crmEvents: [],
  };
  const client = createMockSupabase(state);

  const result = await markPathologyResultReviewed(TENANT, PATIENT, RESULT, null, "user-1", client);

  assert.equal(result.status, "reviewed");
  const snapshot = result.metadata.medical_intelligence_snapshot as Record<string, unknown>;
  assert.equal(snapshot.source, FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE);
  assert.deepEqual(snapshot.interpreted_markers, []);
  assert.equal(snapshot.skipped_marker_count, 2);
});

test("createPathologyResult with reviewed status writes medical_intelligence_snapshot", async () => {
  const { client, state } = createMockSupabaseForCreate();

  const out = await createPathologyResult(
    {
      tenantId: TENANT,
      patientId: PATIENT,
      resultDate: "2026-07-01",
      providerName: "LabCo",
      pathologyRequestId: null,
      clinicalSummary: "Reviewed on create",
      status: "reviewed",
      items: [{ test_label: "Ferritin", result_value: "25", result_unit: "ug/L", flag: "normal" }],
      pdfBytes: null,
      originalFilename: null,
      actingUserId: "user-1",
    },
    client
  );

  assert.equal(out.result.status, "reviewed");
  const snapshot = out.result.metadata.medical_intelligence_snapshot as Record<string, unknown>;
  assert.ok(snapshot);
  assert.equal(snapshot.source, FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE);
  assert.equal(typeof snapshot.generated_at, "string");
  assert.ok(Array.isArray(snapshot.interpreted_markers));
  assert.equal((snapshot.interpreted_markers as unknown[]).length, 1);
  assert.equal(state.result.metadata.medical_intelligence_snapshot, snapshot);
});

test("createPathologyResult with draft status does not write medical_intelligence_snapshot", async () => {
  const { client, state } = createMockSupabaseForCreate({ original_filename: "draft.pdf" });

  const out = await createPathologyResult(
    {
      tenantId: TENANT,
      patientId: PATIENT,
      resultDate: "2026-07-01",
      providerName: "LabCo",
      pathologyRequestId: null,
      clinicalSummary: "Draft note",
      status: "draft",
      items: [{ test_label: "Ferritin", result_value: "25", flag: "normal" }],
      pdfBytes: null,
      originalFilename: "draft.pdf",
      actingUserId: "user-1",
    },
    client
  );

  assert.equal(out.result.status, "draft");
  assert.equal(out.result.metadata.original_filename, "draft.pdf");
  assert.equal(out.result.metadata.medical_intelligence_snapshot, undefined);
  assert.equal(state.result.metadata.medical_intelligence_snapshot, undefined);
});

test("createPathologyResult reviewed preserves existing metadata keys", async () => {
  const { client } = createMockSupabaseForCreate();

  const out = await createPathologyResult(
    {
      tenantId: TENANT,
      patientId: PATIENT,
      resultDate: "2026-07-01",
      providerName: "LabCo",
      pathologyRequestId: null,
      clinicalSummary: null,
      status: "reviewed",
      items: [{ test_label: "Ferritin", result_value: "25", flag: "normal" }],
      pdfBytes: null,
      originalFilename: "report.pdf",
      actingUserId: "user-1",
    },
    client
  );

  assert.equal(out.result.metadata.original_filename, "report.pdf");
  assert.ok(out.result.metadata.medical_intelligence_snapshot);
});

test("invalid or empty markers do not block createPathologyResult reviewed", async () => {
  const { client } = createMockSupabaseForCreate();

  const out = await createPathologyResult(
    {
      tenantId: TENANT,
      patientId: PATIENT,
      resultDate: "2026-07-01",
      providerName: "LabCo",
      pathologyRequestId: null,
      clinicalSummary: null,
      status: "reviewed",
      items: [
        { test_label: "", result_value: "25", flag: "unknown" },
        { test_label: "Notes", result_value: "see comment", flag: "unknown" },
      ],
      pdfBytes: null,
      originalFilename: null,
      actingUserId: "user-1",
    },
    client
  );

  assert.equal(out.result.status, "reviewed");
  assert.equal(out.items.length, 1);
  const snapshot = out.result.metadata.medical_intelligence_snapshot as Record<string, unknown>;
  assert.equal(snapshot.source, FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE);
  assert.deepEqual(snapshot.interpreted_markers, []);
  assert.equal(snapshot.skipped_marker_count, 1);
});
