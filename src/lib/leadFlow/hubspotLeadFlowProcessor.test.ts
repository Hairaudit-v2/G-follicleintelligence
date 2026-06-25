import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeHubSpotContactToLead } from "@/src/lib/leadFlow/hubspotLeadFlowCore";
import type { FiExternalEventRow, FiLeadActivityRow, FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import {
  claimHubSpotExternalEventForProcessing,
  loadPendingExternalEvents,
  markExternalEventFailed,
  processAllTenantsPendingHubSpotExternalEvents,
  processHubSpotContactEvent,
  processPendingHubSpotExternalEvents,
  upsertLeadFromHubSpotContact,
} from "@/src/lib/leadFlow/hubspotLeadFlowProcessor.server";
import { LEADFLOW_EVENT_META_KEY } from "@/src/lib/leadFlow/leadFlowEventMeta";

const TENANT = "11111111-1111-4111-8111-111111111111";

type Store = {
  externalEvents: FiExternalEventRow[];
  leads: FiLeadRow[];
  activity: FiLeadActivityRow[];
};

function makeLead(overrides: Partial<FiLeadRow> = {}): FiLeadRow {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    hubspot_contact_id: null,
    first_name: null,
    last_name: null,
    email: null,
    phone: null,
    lead_source: null,
    procedure_interest: null,
    country: null,
    budget_range: null,
    current_stage: "new",
    lead_score: 0,
    conversion_probability: 0,
    priority_band: null,
    predicted_procedure: null,
    scoring_reasons: [],
    risk_flags: [],
    scored_at: null,
    assigned_consultant: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

function makeExternalEvent(payload: Record<string, unknown>, overrides: Partial<FiExternalEventRow> = {}): FiExternalEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    provider: "hubspot",
    event_type: "hubspot.contact.updated",
    external_id: "501",
    provider_event_id: `evt-${randomUUID()}`,
    payload_json: payload,
    status: "pending",
    error_message: null,
    retry_count: 0,
    last_retry_at: null,
    processed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

const TENANT_B = "22222222-2222-4222-8222-222222222222";

function matchesFilters(row: Record<string, unknown>, filters: Record<string, string | string[]>): boolean {
  for (const [key, value] of Object.entries(filters)) {
    if (key === "__or" || key.startsWith("__in:")) continue;
    if (Array.isArray(value)) {
      if (!value.includes(String(row[key] ?? ""))) return false;
    } else if (String(row[key] ?? "") !== value) {
      return false;
    }
  }
  for (const [key, allowed] of Object.entries(filters)) {
    if (!key.startsWith("__in:")) continue;
    const col = key.slice(5);
    const vals = allowed as string[];
    if (!vals.includes(String(row[col] ?? ""))) return false;
  }
  return true;
}

function makeStoreSupabase(store: Store): SupabaseClient {
  const buildSelect = (table: string) => {
    const filters: Record<string, string | string[]> = {};
    let limit = 100;
    const chain: Record<string, unknown> = {
      eq: (col: string, val: unknown) => {
        filters[col] = String(val);
        return chain;
      },
      in: (col: string, vals: unknown[]) => {
        filters[`__in:${col}`] = vals.map(String);
        return chain;
      },
      order: () => chain,
      limit: (n: number) => {
        limit = n;
        return chain;
      },
      maybeSingle: async () => {
        const rows = getTable(table).filter((row) => matchesFilters(row as Record<string, unknown>, filters));
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = getTable(table).filter((row) => matchesFilters(row as Record<string, unknown>, filters));
        if (!rows[0]) return { data: null, error: { message: "not found" } };
        return { data: rows[0], error: null };
      },
      then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
        let rows = getTable(table).filter((row) => matchesFilters(row as Record<string, unknown>, filters));
        rows = rows.slice(0, limit);
        return Promise.resolve({ data: rows, error: null }).then(onF, onR);
      },
    };
    return chain;
  };

  function getTable(table: string): unknown[] {
    if (table === "fi_external_events") return store.externalEvents;
    if (table === "fi_leads") return store.leads;
    if (table === "fi_lead_activity") return store.activity;
    return [];
  }

  const from = (table: string) => ({
    select: () => buildSelect(table),
    insert: (row: Record<string, unknown>) => {
      const insertedRow = { id: randomUUID(), created_at: new Date().toISOString(), ...row } as Record<string, unknown>;
      const applyInsert = () => {
        if (table === "fi_external_events") {
          const duplicate = store.externalEvents.some(
            (e) =>
              e.tenant_id === insertedRow.tenant_id &&
              e.provider === insertedRow.provider &&
              e.provider_event_id === insertedRow.provider_event_id
          );
          if (duplicate) return { data: null, error: { code: "23505", message: "duplicate" } };
          store.externalEvents.push(insertedRow as FiExternalEventRow);
        } else if (table === "fi_leads") {
          store.leads.push({ ...insertedRow, updated_at: new Date().toISOString() } as FiLeadRow);
        } else if (table === "fi_lead_activity") {
          store.activity.push(insertedRow as FiLeadActivityRow);
        }
        return { data: insertedRow, error: null };
      };

      const result = applyInsert();
      const thenable = {
        select: () => ({
          maybeSingle: async () => result,
          single: async () => result,
        }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(onF, onR),
      };
      return thenable;
    },
    update: (patch: Record<string, unknown>) => {
      const filters: Record<string, string | string[]> = {};
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          filters[`__in:${col}`] = vals.map(String);
          return chain;
        },
        select: () => ({
          maybeSingle: async () => {
            const tableRows = getTable(table) as Array<Record<string, unknown>>;
            const row = tableRows.find((r) => matchesFilters(r, filters));
            if (!row) return { data: null, error: null };
            Object.assign(row, patch, { updated_at: new Date().toISOString() });
            return { data: row, error: null };
          },
          single: async () => {
            const tableRows = getTable(table) as Array<Record<string, unknown>>;
            const row = tableRows.find((r) => matchesFilters(r, filters));
            if (!row) return { data: null, error: { message: "not found" } };
            Object.assign(row, patch, { updated_at: new Date().toISOString() });
            return { data: row, error: null };
          },
        }),
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          const tableRows = getTable(table) as Array<Record<string, unknown>>;
          for (const row of tableRows) {
            if (matchesFilters(row, filters)) Object.assign(row, patch);
          }
          return Promise.resolve({ data: null, error: null }).then(onF, onR);
        },
      };
      return chain;
    },
  });

  return { from } as unknown as SupabaseClient;
}

describe("LeadFlow LF-2 HubSpot processor", () => {
  it("creates lead from contact event", async () => {
    const store: Store = { externalEvents: [], leads: [], activity: [] };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "501",
      properties: { firstname: "Jane", email: "jane@example.com", lifecyclestage: "lead" },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.created, true);
    assert.equal(store.leads.length, 1);
    assert.equal(store.leads[0]?.hubspot_contact_id, "501");
    assert.ok(store.activity.some((a) => a.activity_type === "lead_created"));
  });

  it("updates lead from later event and records stage change activity", async () => {
    const store: Store = {
      externalEvents: [],
      leads: [makeLead({ hubspot_contact_id: "501", email: "jane@example.com", current_stage: "new" })],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "501",
      properties: { lifecyclestage: "salesqualifiedlead", firstname: "Jane Updated" },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    assert.equal(store.leads[0]?.current_stage, "qualified");
    assert.equal(store.leads[0]?.first_name, "Jane Updated");
    assert.ok(store.activity.some((a) => a.activity_type === "stage_changed"));
  });

  it("does not create second lead for duplicate email", async () => {
    const store: Store = {
      externalEvents: [],
      leads: [makeLead({ email: "dup@example.com", hubspot_contact_id: "900" })],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "501",
      properties: { email: "dup@example.com", firstname: "Other" },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    assert.equal(store.leads.length, 1);
    assert.equal(store.leads[0]?.hubspot_contact_id, "900");
  });

  it("allows repeated external events for same HubSpot contact id", async () => {
    const store: Store = { externalEvents: [], leads: [], activity: [] };
    const supabase = makeStoreSupabase(store);
    const payload = { eventId: "evt-1", hubspot_contact_id: "501", properties: { email: "a@b.com" } };

    store.externalEvents.push(makeExternalEvent(payload, { provider_event_id: "evt-1", external_id: "501" }));
    store.externalEvents.push(
      makeExternalEvent(
        { ...payload, eventId: "evt-2", properties: { email: "a@b.com", lifecyclestage: "lead" } },
        { id: randomUUID(), provider_event_id: "evt-2", external_id: "501" }
      )
    );

    assert.equal(store.externalEvents.filter((e) => e.external_id === "501").length, 2);
    const pending = await loadPendingExternalEvents({ tenantId: TENANT, supabase });
    assert.equal(pending.length, 2);
  });

  it("records failed event status when normalization fails", async () => {
    const store: Store = {
      externalEvents: [makeExternalEvent({ properties: {} }, { external_id: null })],
      leads: [],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const event = store.externalEvents[0]!;
    const claimed = await claimHubSpotExternalEventForProcessing(event.id, TENANT, supabase);
    assert.ok(claimed);
    assert.equal(store.externalEvents[0]?.status, "processing");

    const result = await processHubSpotContactEvent(claimed!, supabase);
    assert.equal(result.ok, false);
    const marked = await markExternalEventFailed(TENANT, event.id, result.ok ? undefined : result.message, supabase);
    assert.equal(marked.ok, true);
    if (!marked.ok) return;
    assert.equal(marked.outcome, "retried");
    assert.equal(store.externalEvents[0]?.status, "retrying");
    assert.equal(store.externalEvents[0]?.retry_count, 1);
    assert.ok(store.externalEvents[0]?.error_message);
    assert.ok(store.externalEvents[0]?.last_retry_at);
  });

  it("moves pending events through processing to processed", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent({
          hubspot_contact_id: "777",
          properties: { email: "process@example.com", firstname: "Proc" },
        }),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const results = await processPendingHubSpotExternalEvents({ tenantId: TENANT, supabase });
    assert.equal(results.length, 1);
    assert.equal(results[0]?.outcome, "processed");
    assert.equal(store.leads.length, 1);
    assert.equal(store.externalEvents[0]?.status, "processed");
    const meta = (store.externalEvents[0]?.payload_json as Record<string, unknown>)?.[LEADFLOW_EVENT_META_KEY] as {
      processing_started_at?: string;
    };
    assert.ok(meta?.processing_started_at);
  });

  it("all-tenants mode processes tenant-safe batches", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent(
          { hubspot_contact_id: "1", properties: { email: "a@example.com" } },
          { tenant_id: TENANT }
        ),
        makeExternalEvent(
          { hubspot_contact_id: "2", properties: { email: "b@example.com" } },
          { tenant_id: TENANT_B }
        ),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const result = await processAllTenantsPendingHubSpotExternalEvents({ limit: 50, supabase });
    assert.equal(result.tenantsTouched, 2);
    assert.equal(result.results.length, 2);
    assert.equal(store.leads.length, 2);
    assert.ok(store.externalEvents.every((e) => e.status === "processed"));
  });

  it("dedupes identical provider_event_id webhook deliveries", async () => {
    const store: Store = { externalEvents: [], leads: [], activity: [] };
    const supabase = makeStoreSupabase(store);
    const payload = {
      tenant_id: TENANT,
      provider: "hubspot",
      event_type: "hubspot.contact.updated",
      external_id: "501",
      provider_event_id: `${TENANT}::hubspot::evt-dup`,
      payload_json: { eventId: "evt-dup", hubspot_contact_id: "501" },
      status: "pending",
    };

    const first = await supabase.from("fi_external_events").insert(payload).select().maybeSingle();
    const second = await supabase.from("fi_external_events").insert(payload).select().maybeSingle();
    assert.equal(first.error, null);
    assert.equal(second.error?.code, "23505");
    assert.equal(store.externalEvents.length, 1);
  });

  it("records error_message and increments retry_count on failure", async () => {
    const store: Store = {
      externalEvents: [makeExternalEvent({ properties: {} }, { external_id: null })],
      leads: [],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);

    await processPendingHubSpotExternalEvents({ tenantId: TENANT, limit: 1, supabase });

    assert.equal(store.externalEvents[0]?.status, "retrying");
    assert.equal(store.externalEvents[0]?.retry_count, 1);
    assert.ok(store.externalEvents[0]?.error_message);
  });

  it("stops retrying after 3 failed attempts", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent({ properties: {} }, { external_id: null, retry_count: 2, status: "retrying" }),
      ],
      leads: [],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);

    await processPendingHubSpotExternalEvents({ tenantId: TENANT, limit: 1, supabase });

    assert.equal(store.externalEvents[0]?.status, "failed");
    assert.equal(store.externalEvents[0]?.retry_count, 3);
  });

  it("does not reprocess already processed events with same provider_event_id", async () => {
    const store: Store = {
      externalEvents: [
        makeExternalEvent(
          { hubspot_contact_id: "501", properties: { email: "done@example.com" } },
          { provider_event_id: "evt-done", status: "processed", processed_at: new Date().toISOString() }
        ),
      ],
      leads: [makeLead({ hubspot_contact_id: "501", email: "done@example.com" })],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);

    const results = await processPendingHubSpotExternalEvents({ tenantId: TENANT, supabase });
    assert.equal(results.length, 0);
    assert.equal(store.externalEvents[0]?.status, "processed");
  });
});

describe("LeadFlow LF-3 HubSpot lead scoring", () => {
  it("HubSpot-created lead receives score", async () => {
    const store: Store = { externalEvents: [], leads: [], activity: [] };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "801",
      properties: {
        firstname: "Score",
        email: "score@example.com",
        phone: "+61 400 111 222",
        procedure_interest: "FUE transplant",
        country: "Australia",
        budget_range: "high",
      },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    if (!result.ok) return;

    assert.ok((store.leads[0]?.lead_score ?? 0) > 0);
    assert.ok(store.leads[0]?.priority_band);
    assert.ok(store.leads[0]?.predicted_procedure);
    assert.ok(store.leads[0]?.scored_at);
    assert.ok(Array.isArray(store.leads[0]?.scoring_reasons));
  });

  it("updated HubSpot lead recalculates score", async () => {
    const store: Store = {
      externalEvents: [],
      leads: [
        makeLead({
          hubspot_contact_id: "802",
          email: "recalc@example.com",
          lead_score: 10,
          conversion_probability: 8,
          priority_band: "low",
          predicted_procedure: "unknown",
          scored_at: new Date().toISOString(),
        }),
      ],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "802",
      properties: {
        email: "recalc@example.com",
        phone: "+61 400 333 444",
        procedure_interest: "FUE crown transplant",
        budget_range: "surgery-ready",
        country: "Australia",
      },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    assert.ok((store.leads[0]?.lead_score ?? 0) > 10);
    assert.notEqual(store.leads[0]?.priority_band, "low");
    assert.equal(store.leads[0]?.predicted_procedure, "fue_transplant");
  });

  it("priority band change appends activity", async () => {
    const store: Store = {
      externalEvents: [],
      leads: [
        makeLead({
          hubspot_contact_id: "803",
          email: "band@example.com",
          lead_score: 20,
          priority_band: "low",
          predicted_procedure: "unknown",
          scored_at: new Date().toISOString(),
        }),
      ],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "803",
      properties: {
        email: "band@example.com",
        phone: "+61 400 555 666",
        procedure_interest: "FUE hairline",
        budget_range: "high",
        country: "Australia",
        lifecyclestage: "appointmentscheduled",
      },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    assert.notEqual(store.leads[0]?.priority_band, "low");
    assert.ok(store.activity.some((a) => a.activity_type === "priority_band_changed"));
  });

  it("predicted procedure change appends activity", async () => {
    const store: Store = {
      externalEvents: [],
      leads: [
        makeLead({
          hubspot_contact_id: "804",
          email: "proc@example.com",
          phone: "61400555666",
          procedure_interest: "PRP",
          lead_score: 35,
          priority_band: "low",
          predicted_procedure: "prp",
          scored_at: new Date().toISOString(),
        }),
      ],
      activity: [],
    };
    const supabase = makeStoreSupabase(store);
    const normalized = normalizeHubSpotContactToLead({
      hubspot_contact_id: "804",
      properties: {
        email: "proc@example.com",
        phone: "+61 400 555 666",
        procedure_interest: "bad transplant repair case",
      },
    });
    assert.ok(normalized);

    const result = await upsertLeadFromHubSpotContact(TENANT, normalized!, { supabase });
    assert.equal(result.ok, true);
    assert.equal(store.leads[0]?.predicted_procedure, "repair_case");
    assert.ok(store.activity.some((a) => a.activity_type === "predicted_procedure_changed"));
  });
});
