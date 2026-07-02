import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import { FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE } from "@/src/lib/clinical-intelligence/fiPathologyMedicalIntelligenceTypes";
import type { PathologyInboundDocumentRow } from "@/src/lib/pathology/pathologyInboxTypes";
import {
  confirmInboundDocumentMatch,
  promoteInboundPathologyDocument,
  rejectInboundDocumentMatch,
  uploadInboundPathologyDocument,
} from "@/src/lib/pathology/pathologyInboxMutations.server";
import type { PathologyResultItemRow, PathologyResultRow } from "@/src/lib/pathology/pathologyResultTypes";

const TENANT = "tenant-1";
const OTHER_TENANT = "tenant-2";
const PATIENT = "patient-1";
const DOC = "doc-1";
const RESULT = "result-1";

type InboxMockState = {
  inbound: PathologyInboundDocumentRow;
  inboundEvents: Record<string, unknown>[];
  result: PathologyResultRow | null;
  items: PathologyResultItemRow[];
  patients: Set<string>;
  crmEvents: Record<string, unknown>[];
  storage: Map<string, Uint8Array>;
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
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
    ...partial,
  };
}

function draftResult(metadata: Record<string, unknown> = {}): PathologyResultRow {
  return {
    id: RESULT,
    tenant_id: TENANT,
    patient_id: PATIENT,
    pathology_request_id: null,
    result_date: "2026-07-02",
    provider_name: null,
    source_type: "uploaded_pdf",
    uploaded_file_bucket: "patient-images",
    uploaded_file_path: `tenant/${TENANT}/patients/${PATIENT}/pathology-results/${RESULT}.pdf`,
    status: "draft",
    clinical_summary: null,
    reviewed_by_user_id: null,
    reviewed_at: null,
    metadata,
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
  };
}

function createInboxMockSupabase(state: InboxMockState): SupabaseClient {
  function inboundMatches(filters: Record<string, string>): boolean {
    return Object.entries(filters).every(([k, v]) => String(state.inbound[k as keyof PathologyInboundDocumentRow]) === v);
  }

  function resolveQuery(table: string, filters: Record<string, string>) {
    if (table === "fi_patients") {
      if (filters.id) {
        const tid = filters.tenant_id;
        const id = filters.id;
        if (tid === TENANT && state.patients.has(id)) {
          return { data: { id, person_id: "person-1" }, error: null };
        }
        return { data: null, error: null };
      }
      if (filters.tenant_id === TENANT) {
        return {
          data: [...state.patients].map((id) => ({
            id,
            person_id: "person-1",
            metadata: {},
          })),
          error: null,
        };
      }
      return { data: [], error: null };
    }
    if (table === "fi_persons" && filters.tenant_id === TENANT) {
      return {
        data: [
          {
            id: "person-1",
            metadata: {
              hubspot: { first_name: "Jane", last_name: "Doe", date_of_birth: "1990-05-12" },
            },
          },
        ],
        error: null,
      };
    }
    if (table === "fi_pathology_inbound_documents") {
      if (filters.tenant_id === OTHER_TENANT) {
        return { data: null, error: null };
      }
      if (Object.keys(filters).length === 0 || inboundMatches(filters)) {
        return { data: state.inbound, error: null };
      }
      return { data: null, error: null };
    }
    if (table === "fi_pathology_result_items" && state.result) {
      return { data: state.items, error: null };
    }
    if (table === "fi_pathology_results" && state.result) {
      return { data: state.result, error: null };
    }
    return { data: null, error: null };
  }

  function eqChain(table: string, filters: Record<string, string>) {
    const chain = {
      eq(col: string, val: string) {
        return eqChain(table, { ...filters, [col]: val });
      },
      order(_col: string, _opts?: { ascending?: boolean }) {
        const resolved = resolveQuery(table, filters);
        return Promise.resolve(resolved);
      },
      in(_col: string, vals: string[]) {
        if (table === "fi_patients") {
          const rows = vals
            .filter((id) => state.patients.has(id))
            .map((id) => ({ id, person_id: "person-1" }));
          return Promise.resolve({ data: rows, error: null });
        }
        if (table === "fi_persons") {
          return Promise.resolve({
            data: [
              {
                id: "person-1",
                metadata: {
                  hubspot: { first_name: "Jane", last_name: "Doe", date_of_birth: "1990-05-12" },
                },
              },
            ],
            error: null,
          });
        }
        return Promise.resolve({ data: [], error: null });
      },
      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
        return Promise.resolve(resolveQuery(table, filters)).then(onFulfilled, onRejected);
      },
      maybeSingle: async () => resolveQuery(table, filters),
      single: async () => {
        const resolved = resolveQuery(table, filters);
        if (resolved.data == null) return { data: null, error: { message: "not found" } };
        return resolved;
      },
    };
    return chain;
  }

  const client = {
    from(table: string) {
      if (table === "fi_pathology_inbound_documents") {
        return {
          select(_cols?: string) {
            return eqChain(table, {});
          },
          insert(payload: Record<string, unknown>) {
            state.inbound = inboundRow({
              id: DOC,
              tenant_id: String(payload.tenant_id),
              match_status: String(payload.match_status) as PathologyInboundDocumentRow["match_status"],
              extracted_patient_name:
                payload.extracted_patient_name != null ? String(payload.extracted_patient_name) : null,
              extracted_dob: payload.extracted_dob != null ? String(payload.extracted_dob).slice(0, 10) : null,
              extracted_mrn: payload.extracted_mrn != null ? String(payload.extracted_mrn) : null,
              original_filename:
                payload.original_filename != null ? String(payload.original_filename) : null,
            });
            return {
              select(_cols?: string) {
                return {
                  single: async () => ({ data: state.inbound, error: null }),
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            const applyInboundUpdate = (filters: Record<string, string>) => {
              if (!inboundMatches(filters)) {
                return { error: { message: "not found" } };
              }
              state.inbound = {
                ...state.inbound,
                ...(patch as Partial<PathologyInboundDocumentRow>),
                match_evidence:
                  patch.match_evidence &&
                  typeof patch.match_evidence === "object" &&
                  !Array.isArray(patch.match_evidence)
                    ? (patch.match_evidence as Record<string, unknown>)
                    : state.inbound.match_evidence,
              };
              return { error: null };
            };

            return {
              eq(col: string, val: string) {
                const filters = { [col]: val };
                return {
                  eq(col2: string, val2: string) {
                    const allFilters = { ...filters, [col2]: val2 };
                    const terminal = {
                      select(_cols?: string) {
                        return {
                          single: async () => {
                            const applied = applyInboundUpdate(allFilters);
                            if (applied.error) return { data: null, error: applied.error };
                            return { data: state.inbound, error: null };
                          },
                        };
                      },
                      then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
                        return Promise.resolve(applyInboundUpdate(allFilters)).then(onFulfilled, onRejected);
                      },
                    };
                    return terminal;
                  },
                  select(_cols?: string) {
                    return {
                      single: async () => {
                        const applied = applyInboundUpdate(filters);
                        if (applied.error) return { data: null, error: applied.error };
                        return { data: state.inbound, error: null };
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
          select(_cols?: string) {
            return eqChain(table, {});
          },
        };
      }

      if (table === "fi_persons") {
        return {
          select(_cols?: string) {
            return eqChain(table, {});
          },
        };
      }

      if (table === "fi_pathology_results") {
        return {
          select(_cols?: string) {
            return eqChain(table, {});
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
              tenant_id: String(payload.tenant_id),
              patient_id: String(payload.patient_id),
              status: String(payload.status) as PathologyResultRow["status"],
              reviewed_at: payload.reviewed_at != null ? String(payload.reviewed_at) : null,
              reviewed_by_user_id:
                payload.reviewed_by_user_id != null ? String(payload.reviewed_by_user_id) : null,
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
              eq(_col: string, _val: string) {
                return {
                  eq(_col2: string, _val2: string) {
                    return {
                      select(_cols?: string) {
                        return {
                          single: async () => {
                            if (!state.result) return { data: null, error: { message: "not found" } };
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
            return eqChain(table, {});
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
                  single: async () => ({ data: { id: "evt-1", ...row }, error: null }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
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

test("uploadInboundPathologyDocument creates pending inbound document", async () => {
  const state: InboxMockState = {
    inbound: inboundRow(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  const out = await uploadInboundPathologyDocument(
    {
      tenantId: TENANT,
      pdfBytes: new Uint8Array([1, 2, 3]),
      originalFilename: "lab.pdf",
      actingUserId: null,
    },
    client
  );

  assert.equal(out.match_status, "pending");
  assert.equal(out.storage_path?.includes("pathology-inbox"), true);
  assert.equal(state.inboundEvents.some((e) => e.event_type === "created"), true);
});

test("upload with name/DOB hints suggests exact patient match", async () => {
  const state: InboxMockState = {
    inbound: inboundRow(),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  const out = await uploadInboundPathologyDocument(
    {
      tenantId: TENANT,
      pdfBytes: new Uint8Array([1, 2, 3]),
      originalFilename: "lab.pdf",
      extractedPatientName: "Jane Doe",
      extractedDob: "1990-05-12",
      actingUserId: null,
    },
    client
  );

  assert.equal(out.suggested_patient_id, PATIENT);
  assert.equal(out.match_confidence, 0.98);
  assert.equal(state.inboundEvents.some((e) => e.event_type === "match_suggested"), true);
});

test("confirmInboundDocumentMatch stores confirmed_patient_id", async () => {
  const state: InboxMockState = {
    inbound: inboundRow({
      suggested_patient_id: PATIENT,
      match_confidence: 0.98,
    }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  const out = await confirmInboundDocumentMatch(
    { tenantId: TENANT, documentId: DOC, patientId: PATIENT, actingUserId: null },
    client
  );

  assert.equal(out.confirmed_patient_id, PATIENT);
  assert.equal(out.match_status, "matched");
});

test("promoteInboundPathologyDocument creates fi_pathology_results", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const state: InboxMockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      storage_bucket: "patient-images",
      storage_path: pdfPath,
    }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map([[pdfPath, new Uint8Array([9, 9, 9])]]),
  };
  const client = createInboxMockSupabase(state);

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

  assert.ok(state.result);
  assert.equal(out.resultId, RESULT);
  assert.equal(state.inbound.match_status, "promoted");
  assert.equal(state.inbound.promoted_result_id, RESULT);
});

test("promoted reviewed result writes medical_intelligence_snapshot", async () => {
  const pdfPath = `tenant/${TENANT}/pathology-inbox/${DOC}.pdf`;
  const state: InboxMockState = {
    inbound: inboundRow({
      match_status: "matched",
      confirmed_patient_id: PATIENT,
      storage_bucket: "patient-images",
      storage_path: pdfPath,
    }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map([[pdfPath, new Uint8Array([9, 9, 9])]]),
  };
  const client = createInboxMockSupabase(state);

  await promoteInboundPathologyDocument(
    {
      tenantId: TENANT,
      documentId: DOC,
      resultDate: "2026-07-02",
      providerName: null,
      clinicalSummary: null,
      status: "reviewed",
      items: [
        {
          test_label: "Ferritin",
          result_value: "45",
          result_unit: "ug/L",
          reference_range: "30-300",
          flag: "normal",
        },
      ],
      actingUserId: "user-1",
    },
    client
  );

  const snapshot = state.result?.metadata?.medical_intelligence_snapshot as
    | { source?: string }
    | undefined;
  assert.ok(snapshot);
  assert.equal(snapshot.source, FI_MEDICAL_INTELLIGENCE_SNAPSHOT_SOURCE);
});

test("rejected documents cannot be promoted", async () => {
  const state: InboxMockState = {
    inbound: inboundRow({ match_status: "rejected" }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  await assert.rejects(
    () =>
      promoteInboundPathologyDocument(
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
      ),
    /Rejected documents cannot be promoted/
  );
});

test("rejectInboundDocumentMatch marks document rejected", async () => {
  const state: InboxMockState = {
    inbound: inboundRow({ suggested_patient_id: PATIENT }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  const out = await rejectInboundDocumentMatch(
    { tenantId: TENANT, documentId: DOC, actingUserId: null },
    client
  );
  assert.equal(out.match_status, "rejected");
});

test("tenant scoping enforced on confirm match", async () => {
  const state: InboxMockState = {
    inbound: inboundRow({ tenant_id: TENANT }),
    inboundEvents: [],
    result: null,
    items: [],
    patients: new Set([PATIENT]),
    crmEvents: [],
    storage: new Map(),
  };
  const client = createInboxMockSupabase(state);

  await assert.rejects(
    () =>
      confirmInboundDocumentMatch(
        { tenantId: OTHER_TENANT, documentId: DOC, patientId: PATIENT, actingUserId: null },
        client
      ),
    /Inbound document not found/
  );
});
