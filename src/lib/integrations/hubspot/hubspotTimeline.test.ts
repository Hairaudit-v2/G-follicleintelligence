import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { resolveHubspotContactIdentity } from "./resolveHubspotContactIdentity.server";
import { appendPatientTimelineEvent } from "./appendPatientTimelineEvent.server";
import {
  processHubspotContactWebhook,
  processHubspotEmailEventWebhook,
} from "./hubspotTimelineProcessors.server";
import { loadPatientTimeline } from "./loadPatientTimeline.server";
import { withHubspotTimelineAudit } from "./hubspotTimelineWebhookAudit.server";
import {
  hubspotContactWebhookSchema,
  hubspotEmailEventWebhookSchema,
} from "./hubspotTimelineSchemas";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PERSON = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PATIENT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LEAD = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type QueryCtx = {
  table: string;
  filters: Record<string, string>;
  ordered: boolean;
  op: "select" | "insert" | "update";
  insertRow?: Record<string, unknown>;
};
type Resolved = { data: unknown; error: { code?: string; message?: string } | null };

function makeSupabase(resolve: (ctx: QueryCtx) => Resolved): SupabaseClient {
  const buildSelect = (table: string) => {
    const ctx: QueryCtx = { table, filters: {}, ordered: false, op: "select" };
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        ctx.filters[col] = String(val);
        return chain;
      },
      or: (expr: string) => {
        ctx.filters.__or = expr;
        return chain;
      },
      order: () => {
        ctx.ordered = true;
        return chain;
      },
      limit: () => chain,
      maybeSingle: async () => resolve(ctx),
      single: async () => resolve(ctx),
      then: (onF: (v: Resolved) => unknown, onR?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(ctx)).then(onF, onR),
    };
    return chain;
  };

  const from = (table: string) => ({
    select: () => buildSelect(table),
    insert: (row: Record<string, unknown>) => ({
      select: () => ({
        single: async () => resolve({ table, filters: {}, ordered: false, op: "insert", insertRow: row }),
      }),
    }),
    update: () => ({
      eq: async () => resolve({ table, filters: {}, ordered: false, op: "update" }),
    }),
  });

  return { from } as unknown as SupabaseClient;
}

const OK_NULL: Resolved = { data: null, error: null };

describe("resolveHubspotContactIdentity", () => {
  it("matches by hubspot_contact_id via fi_person_source_ids", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_person_source_ids") return { data: { person_id: PERSON }, error: null };
      if (ctx.table === "fi_patients") return { data: { id: PATIENT }, error: null };
      if (ctx.table === "fi_crm_leads") return { data: { id: LEAD, patient_id: PATIENT }, error: null };
      return OK_NULL;
    });
    const r = await resolveHubspotContactIdentity(supabase, TENANT, { hubspotContactId: "HS-1" });
    assert.ok(r);
    assert.equal(r!.matchedBy, "hubspot_contact_id");
    assert.equal(r!.person_id, PERSON);
    assert.equal(r!.patient_id, PATIENT);
    assert.equal(r!.crm_lead_id, LEAD);
  });

  it("matches by email via fi_persons.metadata", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_persons") return { data: { id: PERSON }, error: null };
      if (ctx.table === "fi_patients") return { data: { id: PATIENT }, error: null };
      return OK_NULL;
    });
    const r = await resolveHubspotContactIdentity(supabase, TENANT, { email: "Jane@Example.com" });
    assert.ok(r);
    assert.equal(r!.matchedBy, "email");
    assert.equal(r!.person_id, PERSON);
  });

  it("matches by explicit crm_lead_id", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_crm_leads" && ctx.filters.id) {
        return { data: { id: LEAD, person_id: PERSON, patient_id: null }, error: null };
      }
      if (ctx.table === "fi_patients") return { data: { id: PATIENT }, error: null };
      return OK_NULL;
    });
    const r = await resolveHubspotContactIdentity(supabase, TENANT, { crmLeadId: LEAD });
    assert.ok(r);
    assert.equal(r!.matchedBy, "crm_lead_link");
    assert.equal(r!.crm_lead_id, LEAD);
    assert.equal(r!.patient_id, PATIENT);
  });

  it("matches by hubspot_deal_id via fi_crm_lead_source_ids", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_crm_lead_source_ids") return { data: { lead_id: LEAD }, error: null };
      if (ctx.table === "fi_crm_leads" && ctx.filters.id) {
        return { data: { id: LEAD, person_id: PERSON, patient_id: PATIENT }, error: null };
      }
      return OK_NULL;
    });
    const r = await resolveHubspotContactIdentity(supabase, TENANT, { hubspotDealId: "DEAL-9" });
    assert.ok(r);
    assert.equal(r!.matchedBy, "hubspot_deal_id");
    assert.equal(r!.patient_id, PATIENT);
  });

  it("returns null when nothing matches", async () => {
    const supabase = makeSupabase(() => OK_NULL);
    const r = await resolveHubspotContactIdentity(supabase, TENANT, { hubspotContactId: "nope", email: "no@x.com" });
    assert.equal(r, null);
  });
});

describe("appendPatientTimelineEvent", () => {
  const base = {
    tenantId: TENANT,
    patientId: PATIENT,
    personId: PERSON,
    crmLeadId: null,
    source: "hubspot.timeline_sync",
    eventType: "email_open",
    eventTimestamp: "2026-06-10T12:00:00.000Z",
    title: "Email opened",
    description: null,
    dedupeKey: "email_event:evt-1",
  };

  it("inserts a new timeline row", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.op === "insert") return { data: { id: "TL-1" }, error: null };
      return OK_NULL;
    });
    const r = await appendPatientTimelineEvent(supabase, base);
    assert.equal(r.inserted, true);
    assert.equal(r.id, "TL-1");
  });

  it("is idempotent on duplicate (23505 → no-op)", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.op === "insert") return { data: null, error: { code: "23505", message: "dup" } };
      return OK_NULL;
    });
    const r = await appendPatientTimelineEvent(supabase, base);
    assert.equal(r.inserted, false);
    assert.equal(r.id, null);
  });

  it("rejects when no anchor is provided", async () => {
    const supabase = makeSupabase(() => OK_NULL);
    await assert.rejects(() =>
      appendPatientTimelineEvent(supabase, { ...base, patientId: null, personId: null, crmLeadId: null })
    );
  });
});

describe("processHubspotContactWebhook", () => {
  it("appends a timeline event for a matched contact", async () => {
    let inserts = 0;
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_person_source_ids") return { data: { person_id: PERSON }, error: null };
      if (ctx.table === "fi_patients") return { data: { id: PATIENT }, error: null };
      if (ctx.table === "fi_crm_leads") return { data: { id: LEAD, patient_id: PATIENT }, error: null };
      if (ctx.table === "fi_patient_timeline" && ctx.op === "insert") {
        inserts += 1;
        return { data: { id: "TL-9" }, error: null };
      }
      return OK_NULL;
    });
    const payload = hubspotContactWebhookSchema.parse({
      hubspot_contact_id: "HS-1",
      event_type: "contact_updated",
      occurred_at: "2026-06-10T12:00:00.000Z",
    });
    const r = await processHubspotContactWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.matched, true);
    assert.equal(r.value.inserted, true);
    assert.equal(r.value.timeline_id, "TL-9");
    assert.equal(inserts, 1);
  });

  it("is a safe no-op when the contact does not match (no insert)", async () => {
    let inserts = 0;
    const supabase = makeSupabase((ctx) => {
      if (ctx.op === "insert") {
        inserts += 1;
        return { data: { id: "X" }, error: null };
      }
      return OK_NULL;
    });
    const payload = hubspotContactWebhookSchema.parse({ hubspot_contact_id: "UNKNOWN" });
    const r = await processHubspotContactWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.matched, false);
    assert.equal(r.value.inserted, false);
    assert.equal(inserts, 0);
  });

  it("returns 422 when no identity field is provided", async () => {
    const supabase = makeSupabase(() => OK_NULL);
    const payload = hubspotContactWebhookSchema.parse({ event_type: "contact_updated" });
    const r = await processHubspotContactWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.status, 422);
  });

  it("does not re-append on duplicate delivery (dedupe)", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_person_source_ids") return { data: { person_id: PERSON }, error: null };
      if (ctx.table === "fi_patients") return { data: { id: PATIENT }, error: null };
      if (ctx.table === "fi_crm_leads") return OK_NULL;
      if (ctx.op === "insert") return { data: null, error: { code: "23505", message: "dup" } };
      return OK_NULL;
    });
    const payload = hubspotEmailEventWebhookSchema.parse({
      hubspot_contact_id: "HS-1",
      email_event_id: "evt-77",
      event_type: "email_open",
    });
    const r = await processHubspotEmailEventWebhook(TENANT, payload, supabase);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.matched, true);
    assert.equal(r.value.inserted, false); // duplicate swallowed
  });
});

describe("withHubspotTimelineAudit", () => {
  it("replay returns 200 duplicate and does not re-run the handler", async () => {
    const rows: { id: string; status: string; hash: string }[] = [];
    let seq = 0;
    let handlerCalls = 0;
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_integration_webhook_events" && ctx.op === "insert") {
        const hash = String(ctx.insertRow?.payload_hash);
        if (rows.some((r) => r.hash === hash)) return { data: null, error: { code: "23505", message: "dup" } };
        const id = `E-${++seq}`;
        rows.push({ id, status: "received", hash });
        return { data: { id }, error: null };
      }
      if (ctx.table === "fi_integration_webhook_events" && ctx.op === "select") {
        const found = rows[0];
        return { data: found ? { id: found.id, status: found.status } : null, error: null };
      }
      if (ctx.table === "fi_integration_webhook_events" && ctx.op === "update") {
        if (rows[0]) rows[0].status = "processed";
        return { data: null, error: null };
      }
      return OK_NULL;
    });

    const run = () =>
      withHubspotTimelineAudit({
        tenantId: TENANT,
        route: "/api/tenants/[tenantId]/integrations/hubspot/contact",
        kind: "contact",
        payload: { hubspot_contact_id: "HS-1", event_type: "contact_updated" },
        supabase,
        handler: async () => {
          handlerCalls += 1;
          return { ok: true as const, value: { matched: true } };
        },
      });

    const a = await run();
    const b = await run();
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(handlerCalls, 1);
    assert.equal("duplicate" in b && b.duplicate, true);
  });
});

describe("loadPatientTimeline", () => {
  it("returns rows anchored on the patient or its person", async () => {
    const supabase = makeSupabase((ctx) => {
      if (ctx.table === "fi_patients") return { data: { id: PATIENT, person_id: PERSON }, error: null };
      if (ctx.table === "fi_patient_timeline") {
        return {
          data: [
            {
              id: "TL-1",
              source: "hubspot.timeline_sync",
              event_type: "email_open",
              event_timestamp: "2026-06-10T12:00:00.000Z",
              title: "Email opened",
              description: null,
              crm_lead_id: null,
              metadata: {},
              created_at: "2026-06-10T12:00:01.000Z",
            },
          ],
          error: null,
        };
      }
      return OK_NULL;
    });
    const r = await loadPatientTimeline(TENANT, PATIENT, { client: supabase });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.personId, PERSON);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].event_type, "email_open");
  });

  it("returns not-found when patient is missing", async () => {
    const supabase = makeSupabase(() => OK_NULL);
    const r = await loadPatientTimeline(TENANT, PATIENT, { client: supabase });
    assert.equal(r.ok, false);
  });
});
