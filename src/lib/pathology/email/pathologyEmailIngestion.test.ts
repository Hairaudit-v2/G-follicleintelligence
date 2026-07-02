import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  decodeBase64Attachment,
  isPdfBytes,
  normalizeGenericPathologyEmailPayload,
  parsePathologyEmailAttachment,
} from "@/src/lib/pathology/email/pathologyEmailAttachmentParser.server";
import { buildPathologyEmailAttachmentDedupHash } from "@/src/lib/pathology/email/pathologyEmailDedup.server";
import {
  isPathologyEmailIngestionEnabledFromEnv,
  readPathologyEmailMaxAttachmentBytesFromEnv,
} from "@/src/lib/pathology/email/pathologyEmailIngestionEnv";
import { ingestPathologyEmailWebhook } from "@/src/lib/pathology/email/pathologyEmailIngestion.server";
import type {
  PathologyEmailInboundMessageRow,
  PathologyEmailNormalizedPayload,
  PathologyEmailRouteRow,
} from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  assertPathologyEmailSenderAllowed,
  assertPathologyEmailWebhookAuthorized,
  PathologyEmailIngestionDisabledError,
  PathologyEmailSenderNotAllowedError,
  PathologyEmailWebhookAuthError,
} from "@/src/lib/pathology/email/pathologyEmailIngestionSecurity.server";
import {
  resolvePathologyEmailRouteForAddress,
  PathologyEmailRouteNotFoundError,
} from "@/src/lib/pathology/email/pathologyEmailTenantRouting.server";
import type { PathologyInboundDocumentRow } from "@/src/lib/pathology/pathologyInboxTypes";
import { isPathologyExtractionEnabledFromEnv } from "@/src/lib/pathology/pathologyExtractionEnv";
import { enqueuePathologyExtractionJob } from "@/src/lib/pathology/pathologyExtractionJobRunner.server";

const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const ROUTE_EMAIL = "pathology+evolved@example.com";
const WEBHOOK_SECRET = "test-webhook-secret-32chars-min";

function minimalPdfBytes(label = "lab"): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4\nFI_PATHOLOGY_MARKERS_JSON=[{"test_label":"${label}","result_value":"1"}]\n`);
}

function pdfAttachment(filename: string, bytes: Uint8Array) {
  return {
    filename,
    contentType: "application/pdf",
    sizeBytes: bytes.length,
    contentBase64: Buffer.from(bytes).toString("base64"),
  };
}

function basePayload(partial: Partial<PathologyEmailNormalizedPayload> = {}): PathologyEmailNormalizedPayload {
  const pdf = minimalPdfBytes();
  return {
    provider: "generic",
    providerMessageId: "msg-001",
    fromEmail: "lab@pathology.example",
    toEmails: [ROUTE_EMAIL],
    subject: "Blood results",
    receivedAt: "2026-07-02T12:00:00.000Z",
    headers: {},
    attachments: [pdfAttachment("results.pdf", pdf)],
    ...partial,
  };
}

type EmailMockState = {
  routes: PathologyEmailRouteRow[];
  messages: PathologyEmailInboundMessageRow[];
  inbound: PathologyInboundDocumentRow[];
  inboundEvents: Record<string, unknown>[];
  storage: Map<string, Uint8Array>;
  jobs: Map<string, Record<string, unknown>>;
  nextDocId: number;
  nextMessageId: number;
  nextJobId: number;
};

function routeRow(partial: Partial<PathologyEmailRouteRow> = {}): PathologyEmailRouteRow {
  return {
    id: "route-1",
    tenant_id: TENANT,
    inbound_email: ROUTE_EMAIL,
    route_status: "active",
    source_label: "Evolved Lab",
    default_source_channel: "email",
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
    ...partial,
  };
}

function createEmailMockSupabase(state: EmailMockState): SupabaseClient {
  function findRoute(email: string): PathologyEmailRouteRow | undefined {
    const normalized = email.trim().toLowerCase();
    return state.routes.find((r) => r.inbound_email.trim().toLowerCase() === normalized);
  }

  const client = {
    from(table: string) {
      const filters: Record<string, string> = {};
      let insertPayload: Record<string, unknown> | Record<string, unknown>[] | null = null;
      let updatePayload: Record<string, unknown> | null = null;

      const chain = {
        select(_cols?: string) {
          return chain;
        },
        insert(payload: Record<string, unknown> | Record<string, unknown>[]) {
          insertPayload = payload;
          return chain;
        },
        update(payload: Record<string, unknown>) {
          updatePayload = payload;
          return chain;
        },
        eq(col: string, val: string) {
          filters[col] = val;
          return chain;
        },
        ilike(col: string, val: string) {
          if (table === "fi_pathology_email_routes" && col === "inbound_email") {
            const route = findRoute(val);
            return {
              maybeSingle: async () => ({
                data: route ?? null,
                error: null,
              }),
            };
          }
          filters[col] = val;
          return chain;
        },
        maybeSingle: async () => {
          if (table === "fi_pathology_email_routes") {
            const route = findRoute(filters.inbound_email ?? "");
            return { data: route ?? null, error: null };
          }
          if (table === "fi_pathology_inbound_email_messages") {
            const msg = state.messages.find(
              (m) =>
                m.tenant_id === filters.tenant_id &&
                (filters.dedup_hash ? m.dedup_hash === filters.dedup_hash : m.id === filters.id)
            );
            return { data: msg ?? null, error: null };
          }
          if (table === "fi_pathology_inbound_documents") {
            const doc = state.inbound.find(
              (d) =>
                d.tenant_id === filters.tenant_id &&
                (filters.email_attachment_dedup_hash
                  ? d.email_attachment_dedup_hash === filters.email_attachment_dedup_hash
                  : d.id === filters.id)
            );
            return { data: doc ?? null, error: null };
          }
          if (table === "fi_pathology_extraction_jobs") {
            if (filters.idempotency_key) {
              const job = state.jobs.get(`key:${filters.idempotency_key}`);
              return { data: job ?? null, error: null };
            }
            if (filters.id && filters.tenant_id) {
              const job = [...state.jobs.values()].find(
                (j) => String(j.id) === filters.id && String(j.tenant_id) === filters.tenant_id
              );
              return { data: job ?? null, error: null };
            }
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "fi_pathology_inbound_documents" && insertPayload) {
            const row = insertPayload as Record<string, unknown>;
            state.nextDocId += 1;
            const doc: PathologyInboundDocumentRow = {
              id: `doc-${state.nextDocId}`,
              tenant_id: String(row.tenant_id),
              source_channel: String(row.source_channel ?? "email") as PathologyInboundDocumentRow["source_channel"],
              storage_bucket: null,
              storage_path: null,
              original_filename: String(row.original_filename ?? "inbound.pdf"),
              content_type: String(row.content_type ?? "application/pdf"),
              match_status: "pending",
              suggested_patient_id: null,
              confirmed_patient_id: null,
              match_confidence: null,
              match_evidence: {},
              extracted_patient_name: row.extracted_patient_name != null ? String(row.extracted_patient_name) : null,
              extracted_dob: null,
              extracted_mrn: null,
              promoted_result_id: null,
              extraction_status: "not_started",
              extraction_job_id: null,
              draft_result_id: null,
              ready_for_review_at: null,
              inbound_email_message_id:
                row.inbound_email_message_id != null ? String(row.inbound_email_message_id) : null,
              email_from: row.email_from != null ? String(row.email_from) : null,
              email_subject: row.email_subject != null ? String(row.email_subject) : null,
              email_source_label:
                row.email_source_label != null ? String(row.email_source_label) : null,
              email_attachment_dedup_hash:
                row.email_attachment_dedup_hash != null ? String(row.email_attachment_dedup_hash) : null,
              created_at: "2026-07-02T12:00:00.000Z",
              updated_at: "2026-07-02T12:00:00.000Z",
            };
            state.inbound.push(doc);
            return { data: doc, error: null };
          }

          if (table === "fi_pathology_inbound_documents" && updatePayload) {
            const doc = state.inbound.find(
              (d) => d.tenant_id === filters.tenant_id && d.id === filters.id
            );
            if (!doc) return { data: null, error: { message: "not found" } };
            Object.assign(doc, updatePayload);
            if (updatePayload.storage_path) {
              doc.storage_bucket = String(updatePayload.storage_bucket ?? "patient-images");
              doc.storage_path = String(updatePayload.storage_path);
            }
            return { data: doc, error: null };
          }

          if (table === "fi_pathology_inbound_email_messages" && insertPayload) {
            state.nextMessageId += 1;
            const row = insertPayload as Record<string, unknown>;
            const message: PathologyEmailInboundMessageRow = {
              id: `msg-row-${state.nextMessageId}`,
              tenant_id: String(row.tenant_id),
              provider: String(row.provider),
              provider_message_id:
                row.provider_message_id != null ? String(row.provider_message_id) : null,
              from_email: row.from_email != null ? String(row.from_email) : null,
              to_email: String(row.to_email),
              subject: row.subject != null ? String(row.subject) : null,
              received_at: row.received_at != null ? String(row.received_at) : null,
              raw_headers: {},
              attachment_count: Number(row.attachment_count ?? 0),
              accepted_attachment_count: 0,
              rejected_attachment_count: 0,
              dedup_hash: String(row.dedup_hash),
              status: "received",
              failure_reason: null,
              created_inbound_document_ids: [],
              created_at: "2026-07-02T12:00:00.000Z",
            };
            state.messages.push(message);
            return { data: message, error: null };
          }

          if (table === "fi_pathology_extraction_jobs" && insertPayload) {
            state.nextJobId += 1;
            const job: Record<string, unknown> = {
              id: `job-${state.nextJobId}`,
              status: "queued",
              provider: null,
              raw_extraction_json: {},
              normalized_items_json: [],
              error_message: null,
              started_at: null,
              completed_at: null,
              extracted_marker_count: 0,
              skipped_marker_count: 0,
              review_status: "pending_review",
              raw_text_preview: null,
              medical_intelligence_preview_json: {},
              created_at: "2026-07-02T12:00:00.000Z",
              updated_at: "2026-07-02T12:00:00.000Z",
              ...(insertPayload as Record<string, unknown>),
            };
            state.jobs.set(`key:${String(job.idempotency_key)}`, job);
            state.jobs.set(`id:${String(job.id)}`, job);
            const inboundDocumentId = (job as { inbound_document_id?: unknown }).inbound_document_id;
            const doc = state.inbound.find((d) => d.id === String(inboundDocumentId ?? ""));
            if (doc) {
              doc.extraction_job_id = String(job.id);
              doc.extraction_status = "queued";
            }
            return { data: job, error: null };
          }

          return { data: null, error: null };
        },
        then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (table === "fi_pathology_inbound_document_events" && insertPayload) {
            state.inboundEvents.push(insertPayload as Record<string, unknown>);
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_documents" && updatePayload && !insertPayload) {
            const doc = state.inbound.find(
              (d) => d.tenant_id === filters.tenant_id && d.id === filters.id
            );
            if (doc) Object.assign(doc, updatePayload);
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_email_messages" && updatePayload) {
            const msg = state.messages.find(
              (m) => m.tenant_id === filters.tenant_id && m.id === filters.id
            );
            if (msg) Object.assign(msg, updatePayload);
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_extraction_jobs" && updatePayload) {
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
    storage: {
      from(_bucket: string) {
        return {
          upload(path: string, bytes: Uint8Array) {
            state.storage.set(path, bytes);
            return Promise.resolve({ data: { path }, error: null });
          },
          download(path: string) {
            const bytes = state.storage.get(path);
            if (!bytes) return Promise.resolve({ data: null, error: { message: "missing" } });
            return Promise.resolve({
              data: {
                arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
              },
              error: null,
            });
          },
        };
      },
    },
  };

  return client as unknown as SupabaseClient;
}

function freshState(): EmailMockState {
  return {
    routes: [routeRow()],
    messages: [],
    inbound: [],
    inboundEvents: [],
    storage: new Map(),
    jobs: new Map(),
    nextDocId: 0,
    nextMessageId: 0,
    nextJobId: 0,
  };
}

function testEnv(overrides: Record<string, string> = {}): Record<string, string> {
  return {
    PATHOLOGY_EMAIL_INGESTION_ENABLED: "true",
    PATHOLOGY_EMAIL_WEBHOOK_SECRET: WEBHOOK_SECRET,
    PATHOLOGY_EMAIL_ALLOWED_SENDERS: "",
    PATHOLOGY_EMAIL_MAX_ATTACHMENT_MB: "15",
    PATHOLOGY_EXTRACTION_ENABLED: "false",
    ...overrides,
  };
}

test("pathology email env defaults ingestion off", () => {
  assert.equal(isPathologyEmailIngestionEnabledFromEnv({ PATHOLOGY_EMAIL_INGESTION_ENABLED: "false" }), false);
  assert.equal(readPathologyEmailMaxAttachmentBytesFromEnv({}), 15 * 1024 * 1024);
});

test("webhook disabled rejects authorization", () => {
  assert.throws(
    () =>
      assertPathologyEmailWebhookAuthorized(
        new Request("http://localhost/api/integrations/pathology-email/inbound", {
          headers: { "x-pathology-email-webhook-secret": WEBHOOK_SECRET },
        }),
        { PATHOLOGY_EMAIL_INGESTION_ENABLED: "false", PATHOLOGY_EMAIL_WEBHOOK_SECRET: WEBHOOK_SECRET }
      ),
    PathologyEmailIngestionDisabledError
  );
});

test("missing or invalid webhook secret rejects", () => {
  assert.throws(
    () =>
      assertPathologyEmailWebhookAuthorized(
        new Request("http://localhost/api/integrations/pathology-email/inbound"),
        testEnv()
      ),
    PathologyEmailWebhookAuthError
  );

  assert.throws(
    () =>
      assertPathologyEmailWebhookAuthorized(
        new Request("http://localhost/api/integrations/pathology-email/inbound", {
          headers: { "x-pathology-email-webhook-secret": "wrong-secret-value-0123456789" },
        }),
        testEnv()
      ),
    PathologyEmailWebhookAuthError
  );
});

test("allowed sender list enforced when configured", () => {
  assert.doesNotThrow(() =>
    assertPathologyEmailSenderAllowed("lab@pathology.example", testEnv())
  );
  assert.throws(
    () =>
      assertPathologyEmailSenderAllowed(
        "other@example.com",
        testEnv({ PATHOLOGY_EMAIL_ALLOWED_SENDERS: "lab@pathology.example" })
      ),
    PathologyEmailSenderNotAllowedError
  );
});

test("unknown inbound email rejects ingestion", async () => {
  const state = freshState();
  state.routes = [];
  const client = createEmailMockSupabase(state);
  const result = await ingestPathologyEmailWebhook(basePayload(), testEnv(), client);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.httpStatus, 404);
});

test("valid email with PDF creates inbound document", async () => {
  const state = freshState();
  const client = createEmailMockSupabase(state);
  const result = await ingestPathologyEmailWebhook(basePayload(), testEnv(), client);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.acceptedCount, 1);
  assert.equal(state.inbound.length, 1);
  assert.equal(state.inbound[0]?.source_channel, "email");
  assert.equal(state.inbound[0]?.email_source_label, "Evolved Lab");
  assert.ok(state.inboundEvents.some((e) => e.event_type === "email_attachment_accepted"));
});

test("valid email with multiple PDFs creates multiple documents", async () => {
  const state = freshState();
  const client = createEmailMockSupabase(state);
  const result = await ingestPathologyEmailWebhook(
    basePayload({
      attachments: [
        pdfAttachment("a.pdf", minimalPdfBytes("a")),
        pdfAttachment("b.pdf", minimalPdfBytes("b")),
      ],
    }),
    testEnv(),
    client
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.acceptedCount, 2);
  assert.equal(state.inbound.length, 2);
});

test("non-PDF attachment rejected safely", async () => {
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const parsed = parsePathologyEmailAttachment(
    {
      filename: "image.png",
      contentType: "image/png",
      sizeBytes: pngBytes.length,
      contentBase64: Buffer.from(pngBytes).toString("base64"),
    },
    15 * 1024 * 1024
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.reason, "not_pdf");
});

test("oversized PDF rejected", async () => {
  const bytes = minimalPdfBytes();
  const parsed = parsePathologyEmailAttachment(
    pdfAttachment("big.pdf", bytes),
    bytes.length - 1
  );
  assert.equal(parsed.ok, false);
  if (parsed.ok) return;
  assert.equal(parsed.reason, "oversized");
});

test("duplicate webhook does not create duplicate documents", async () => {
  const state = freshState();
  const client = createEmailMockSupabase(state);
  const payload = basePayload();
  const first = await ingestPathologyEmailWebhook(payload, testEnv(), client);
  const second = await ingestPathologyEmailWebhook(payload, testEnv(), client);
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (!first.ok || !second.ok) return;
  assert.equal(state.inbound.length, 1);
  assert.equal(second.duplicate, true);
  assert.equal(second.status, "duplicate");
});

test("email-created document enqueues extraction when flag enabled", async () => {
  const state = freshState();
  const client = createEmailMockSupabase(state);
  const prev = process.env.PATHOLOGY_EXTRACTION_ENABLED;
  process.env.PATHOLOGY_EXTRACTION_ENABLED = "false";
  try {
    const result = await ingestPathologyEmailWebhook(basePayload(), testEnv(), client);
    assert.equal(result.ok, true);
    if (!result.ok) return;

    const docId = result.createdDocumentIds[0];
    assert.ok(docId);

    process.env.PATHOLOGY_EXTRACTION_ENABLED = "true";
    assert.equal(isPathologyExtractionEnabledFromEnv(), true);

    const job = await enqueuePathologyExtractionJob(
      { tenantId: TENANT, documentId: docId, actingUserId: null },
      client
    );
    assert.equal(job.created, true);
    assert.ok(
      state.inboundEvents.some((e) => e.event_type === "extraction_queued")
    );
  } finally {
    process.env.PATHOLOGY_EXTRACTION_ENABLED = prev;
  }
});

test("tenant routing enforced via inbound address", async () => {
  const state = freshState();
  state.routes = [
    routeRow({ tenant_id: OTHER_TENANT, inbound_email: "other@example.com" }),
    routeRow({ tenant_id: TENANT, inbound_email: ROUTE_EMAIL }),
  ];
  const client = createEmailMockSupabase(state);

  await assert.rejects(
    () => resolvePathologyEmailRouteForAddress("missing@example.com", client),
    PathologyEmailRouteNotFoundError
  );

  const route = await resolvePathologyEmailRouteForAddress(ROUTE_EMAIL, client);
  assert.equal(route.tenant_id, TENANT);

  const result = await ingestPathologyEmailWebhook(basePayload(), testEnv(), client);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.tenantId, TENANT);
});

test("generic provider payload normalizes to internal shape", () => {
  const payload = normalizeGenericPathologyEmailPayload({
    provider: "generic",
    providerMessageId: "abc",
    fromEmail: "a@b.com",
    toEmails: [ROUTE_EMAIL],
    subject: "Test",
    attachments: [{ filename: "x.pdf", contentType: "application/pdf", sizeBytes: 4, contentBase64: "JVBERi0=" }],
  });
  assert.equal(payload.provider, "generic");
  assert.equal(payload.toEmails[0], ROUTE_EMAIL);
  assert.equal(payload.attachments.length, 1);
});

test("attachment dedup hash is stable", () => {
  const bytes = minimalPdfBytes();
  const hashA = buildPathologyEmailAttachmentDedupHash({
    tenantId: TENANT,
    providerMessageId: "msg-1",
    filename: "lab.pdf",
    attachmentBytes: bytes,
  });
  const hashB = buildPathologyEmailAttachmentDedupHash({
    tenantId: TENANT,
    providerMessageId: "msg-1",
    filename: "lab.pdf",
    attachmentBytes: bytes,
  });
  assert.equal(hashA, hashB);
  assert.ok(isPdfBytes(bytes));
  assert.ok(decodeBase64Attachment(Buffer.from(bytes).toString("base64")));
});
