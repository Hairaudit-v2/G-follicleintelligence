import assert from "node:assert/strict";
import test from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PathologyEmailInboundMessageRow,
  PathologyEmailRouteRow,
} from "@/src/lib/pathology/email/pathologyEmailIngestionTypes";
import {
  aggregatePathologyEmailRouteMessageStats,
  buildEvolvedPathologyInboundEmail,
  EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL,
  EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG,
  isValidPathologyInboundEmail,
  normalizePathologyInboundEmail,
} from "@/src/lib/pathology/email/pathologyEmailRoutesCore";
import {
  createPathologyEmailRoute,
  PathologyEmailRouteDuplicateError,
  PathologyEmailRouteMutationNotFoundError,
  PathologyEmailRouteValidationError,
  updatePathologyEmailRouteStatus,
} from "@/src/lib/pathology/email/pathologyEmailRoutesMutations.server";
import { seedEvolvedPathologyEmailRoute } from "@/src/lib/pathology/email/pathologyEmailRoutesSeed.server";
import type { PathologyInboundDocumentRow } from "@/src/lib/pathology/pathologyInboxTypes";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const ROUTE_EMAIL = "pathology+evolved@inbound.example.com";

type RoutesMockState = {
  tenants: Array<{ id: string; slug: string }>;
  routes: PathologyEmailRouteRow[];
  messages: Array<{
    tenant_id: string;
    to_email: string;
    received_at: string | null;
    created_at: string;
    provider: string;
  }>;
  inbound: PathologyInboundDocumentRow[];
  inboundEvents: Record<string, unknown>[];
  storage: Map<string, Uint8Array>;
  nextRouteId: number;
  nextMessageId: number;
  nextDocId: number;
};

function routeRow(partial: Partial<PathologyEmailRouteRow> = {}): PathologyEmailRouteRow {
  return {
    id: partial.id ?? "route-1",
    tenant_id: partial.tenant_id ?? TENANT_A,
    inbound_email: partial.inbound_email ?? ROUTE_EMAIL,
    route_status: partial.route_status ?? "active",
    source_label: partial.source_label ?? EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL,
    default_source_channel: partial.default_source_channel ?? "email",
    created_at: partial.created_at ?? "2026-07-02T10:00:00.000Z",
    updated_at: partial.updated_at ?? "2026-07-02T10:00:00.000Z",
  };
}

function createRoutesMockSupabase(state: RoutesMockState): SupabaseClient {
  function findRouteByEmail(email: string): PathologyEmailRouteRow | undefined {
    const normalized = normalizePathologyInboundEmail(email);
    return state.routes.find((route) => normalizePathologyInboundEmail(route.inbound_email) === normalized);
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
            const route = findRouteByEmail(val);
            return {
              maybeSingle: async () => ({ data: route ?? null, error: null }),
            };
          }
          filters[col] = val;
          return chain;
        },
        order() {
          return chain;
        },
        maybeSingle: async () => {
          if (table === "fi_tenants" && filters.slug) {
            const tenant = state.tenants.find((row) => row.slug === filters.slug);
            return { data: tenant ?? null, error: null };
          }
          if (table === "fi_pathology_email_routes") {
            if (filters.id && filters.tenant_id) {
              const route = state.routes.find(
                (row) => row.id === filters.id && row.tenant_id === filters.tenant_id
              );
              return { data: route ?? null, error: null };
            }
            const route = findRouteByEmail(filters.inbound_email ?? "");
            return { data: route ?? null, error: null };
          }
          if (table === "fi_pathology_inbound_email_messages") {
            const msg = state.messages.find(
              (row) => row.tenant_id === filters.tenant_id && row.to_email === filters.to_email
            );
            return { data: msg ?? null, error: null };
          }
          if (table === "fi_pathology_inbound_documents") {
            const doc = state.inbound.find(
              (row) =>
                row.tenant_id === filters.tenant_id &&
                row.email_attachment_dedup_hash === filters.email_attachment_dedup_hash
            );
            return { data: doc ?? null, error: null };
          }
          return { data: null, error: null };
        },
        single: async () => {
          if (table === "fi_pathology_email_routes" && insertPayload) {
            state.nextRouteId += 1;
            const row = insertPayload as Record<string, unknown>;
            const route = routeRow({
              id: `route-${state.nextRouteId}`,
              tenant_id: String(row.tenant_id),
              inbound_email: String(row.inbound_email),
              route_status: String(row.route_status ?? "active") as PathologyEmailRouteRow["route_status"],
              source_label: row.source_label != null ? String(row.source_label) : null,
            });
            state.routes.push(route);
            return { data: route, error: null };
          }
          if (table === "fi_pathology_email_routes" && updatePayload) {
            const route = state.routes.find(
              (row) => row.id === filters.id && row.tenant_id === filters.tenant_id
            );
            if (!route) return { data: null, error: { message: "not found" } };
            Object.assign(route, updatePayload);
            return { data: route, error: null };
          }
          if (table === "fi_pathology_inbound_documents" && insertPayload) {
            state.nextDocId += 1;
            const row = insertPayload as Record<string, unknown>;
            const doc: PathologyInboundDocumentRow = {
              id: `doc-${state.nextDocId}`,
              tenant_id: String(row.tenant_id),
              source_channel: "email",
              storage_bucket: null,
              storage_path: null,
              original_filename: String(row.original_filename ?? "inbound.pdf"),
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
              inbound_email_message_id: null,
              email_from: null,
              email_subject: null,
              email_source_label: null,
              email_attachment_dedup_hash: null,
              created_at: "2026-07-02T12:00:00.000Z",
              updated_at: "2026-07-02T12:00:00.000Z",
            };
            state.inbound.push(doc);
            return { data: doc, error: null };
          }
          if (table === "fi_pathology_inbound_email_messages" && insertPayload) {
            state.nextMessageId += 1;
            const row = insertPayload as Record<string, unknown>;
            const message: PathologyEmailInboundMessageRow = {
              id: `msg-${state.nextMessageId}`,
              tenant_id: String(row.tenant_id),
              provider: String(row.provider),
              provider_message_id: null,
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
            state.messages.push({
              tenant_id: message.tenant_id,
              to_email: message.to_email,
              received_at: message.received_at,
              created_at: message.created_at,
              provider: message.provider,
            });
            return { data: message, error: null };
          }
          return { data: null, error: null };
        },
        then(onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (table === "fi_pathology_email_routes" && !insertPayload && !updatePayload) {
            const rows =
              filters.tenant_id != null
                ? state.routes.filter((route) => route.tenant_id === filters.tenant_id)
                : state.routes;
            return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_email_messages" && !insertPayload) {
            const rows = state.messages.filter((row) => row.tenant_id === filters.tenant_id);
            return Promise.resolve({ data: rows, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_document_events" && insertPayload) {
            state.inboundEvents.push(insertPayload as Record<string, unknown>);
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_email_messages" && updatePayload) {
            return Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected);
          }
          if (table === "fi_pathology_inbound_documents" && updatePayload) {
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
        };
      },
    },
  };

  return client as unknown as SupabaseClient;
}

function freshState(): RoutesMockState {
  return {
    tenants: [{ id: TENANT_A, slug: EVOLVED_PATHOLOGY_EMAIL_TENANT_SLUG }],
    routes: [],
    messages: [],
    inbound: [],
    inboundEvents: [],
    storage: new Map(),
    nextRouteId: 0,
    nextMessageId: 0,
    nextDocId: 0,
  };
}

test("email normalization lowercases inbound addresses", () => {
  assert.equal(normalizePathologyInboundEmail("  Pathology+Evolved@Example.COM "), "pathology+evolved@example.com");
  assert.equal(isValidPathologyInboundEmail("pathology+evolved@inbound.example.com"), true);
  assert.equal(isValidPathologyInboundEmail("not-an-email"), false);
});

test("buildEvolvedPathologyInboundEmail uses inbound subdomain", () => {
  assert.equal(
    buildEvolvedPathologyInboundEmail("follicleintelligence.com"),
    "pathology+evolved@inbound.follicleintelligence.com"
  );
});

test("createPathologyEmailRoute stores normalized email", async () => {
  const state = freshState();
  const client = createRoutesMockSupabase(state);
  const route = await createPathologyEmailRoute(
    {
      tenantId: TENANT_A,
      inboundEmail: "  Pathology+Evolved@INBOUND.Example.COM ",
      sourceLabel: EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL,
    },
    client
  );
  assert.equal(route.inbound_email, "pathology+evolved@inbound.example.com");
  assert.equal(route.route_status, "active");
});

test("createPathologyEmailRoute rejects duplicate addresses globally", async () => {
  const state = freshState();
  state.routes = [routeRow({ tenant_id: TENANT_B, inbound_email: ROUTE_EMAIL })];
  const client = createRoutesMockSupabase(state);
  await assert.rejects(
    () =>
      createPathologyEmailRoute(
        { tenantId: TENANT_A, inboundEmail: ROUTE_EMAIL.toUpperCase() },
        client
      ),
    PathologyEmailRouteDuplicateError
  );
});

test("createPathologyEmailRoute validates email format", async () => {
  const state = freshState();
  const client = createRoutesMockSupabase(state);
  await assert.rejects(
    () => createPathologyEmailRoute({ tenantId: TENANT_A, inboundEmail: "bad-address" }, client),
    PathologyEmailRouteValidationError
  );
});

test("updatePathologyEmailRouteStatus is tenant scoped", async () => {
  const state = freshState();
  state.routes = [routeRow({ id: "route-tenant-a", tenant_id: TENANT_A })];
  const client = createRoutesMockSupabase(state);

  await assert.rejects(
    () =>
      updatePathologyEmailRouteStatus(
        { tenantId: TENANT_B, routeId: "route-tenant-a", routeStatus: "disabled" },
        client
      ),
    PathologyEmailRouteMutationNotFoundError
  );

  const updated = await updatePathologyEmailRouteStatus(
    { tenantId: TENANT_A, routeId: "route-tenant-a", routeStatus: "disabled" },
    client
  );
  assert.equal(updated.route_status, "disabled");
});

test("seedEvolvedPathologyEmailRoute is idempotent and resolves tenant by slug", async () => {
  const state = freshState();
  const client = createRoutesMockSupabase(state);

  const first = await seedEvolvedPathologyEmailRoute({ inboundDomain: "example.com", client });
  assert.equal(first.created, true);
  assert.ok(first.route);
  assert.equal(first.route?.source_label, EVOLVED_PATHOLOGY_EMAIL_SOURCE_LABEL);

  const second = await seedEvolvedPathologyEmailRoute({ inboundDomain: "example.com", client });
  assert.equal(second.created, false);
  assert.equal(second.route?.id, first.route?.id);
});

test("seedEvolvedPathologyEmailRoute skips when tenant slug missing", async () => {
  const state = freshState();
  state.tenants = [];
  const client = createRoutesMockSupabase(state);
  const result = await seedEvolvedPathologyEmailRoute({ inboundDomain: "example.com", client });
  assert.equal(result.created, false);
  assert.equal(result.route, null);
  assert.match(result.skippedReason ?? "", /not found/i);
});

test("message stats aggregate counts and last provider", () => {
  const stats = aggregatePathologyEmailRouteMessageStats([
    {
      to_email: ROUTE_EMAIL,
      received_at: "2026-07-02T10:00:00.000Z",
      created_at: "2026-07-02T10:00:00.000Z",
      provider: "postmark",
    },
    {
      to_email: ROUTE_EMAIL,
      received_at: "2026-07-02T12:00:00.000Z",
      created_at: "2026-07-02T12:00:00.000Z",
      provider: "mailgun",
    },
  ]);
  const row = stats.get(normalizePathologyInboundEmail(ROUTE_EMAIL));
  assert.equal(row?.message_count, 2);
  assert.equal(row?.last_provider, "mailgun");
  assert.equal(row?.last_used_at, "2026-07-02T12:00:00.000Z");
});
