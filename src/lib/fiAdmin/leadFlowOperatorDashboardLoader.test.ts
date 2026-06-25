import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { FiExternalEventRow, FiLeadRow } from "@/src/lib/leadFlow/leadFlowFoundationTypes";
import {
  buildLeadFlowOperatorPipelineColumns,
  buildLeadFlowOperatorPredictedProcedureCounts,
  buildLeadFlowOperatorPriorityCounts,
  buildLeadFlowOperatorSummaryMetrics,
  formatLeadFlowOperatorName,
  labelLeadFlowOperatorActivityType,
  sanitizeLeadFlowOperatorFailedEvent,
  selectLeadFlowOperatorHighPriorityLeads,
  summarizeLeadFlowOperatorActivityMetadata,
} from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCore";
import { composeLeadFlowOperatorDashboardPayload } from "@/src/lib/fiAdmin/leadFlowOperatorDashboardCompose";
import { loadLeadFlowQueueHealth } from "@/src/lib/leadFlow/leadFlowQueueHealth.server";

const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";

function makeLead(overrides: Partial<FiLeadRow> & { tenant_id?: string } = {}): FiLeadRow {
  const id = overrides.id ?? randomUUID();
  return {
    id,
    tenant_id: overrides.tenant_id ?? TENANT_A,
    hubspot_contact_id: null,
    first_name: "Alex",
    last_name: "Rivera",
    email: "alex@example.com",
    phone: "+61400000000",
    lead_source: "hubspot",
    procedure_interest: "FUE hairline",
    country: "Australia",
    budget_range: "high",
    current_stage: "new",
    lead_score: 50,
    conversion_probability: 40,
    priority_band: "medium",
    predicted_procedure: "fue_transplant",
    scoring_reasons: [],
    risk_flags: [],
    scored_at: new Date().toISOString(),
    assigned_consultant: null,
    created_at: "2026-06-20T10:00:00.000Z",
    updated_at: "2026-06-25T10:00:00.000Z",
    ...overrides,
  };
}

function makeFailedEvent(overrides: Partial<FiExternalEventRow> = {}): FiExternalEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT_A,
    provider: "hubspot",
    event_type: "hubspot.contact.updated",
    external_id: "9001",
    provider_event_id: `evt-${randomUUID()}`,
    payload_json: { secret: "should-not-leak" },
    status: "failed",
    error_message: 'Bearer abc123token and "access_token": "xyz"',
    retry_count: 3,
    last_retry_at: "2026-06-25T11:00:00.000Z",
    processed_at: null,
    created_at: "2026-06-25T10:30:00.000Z",
    ...overrides,
  };
}

type MockStore = {
  leads: FiLeadRow[];
  externalEvents: FiExternalEventRow[];
  integrations: Array<{ tenant_id: string; provider: string; status: string; config: Record<string, unknown> }>;
  activities: Array<{
    id: string;
    lead_id: string;
    activity_type: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
};

function makeOperatorDashboardSupabase(store: MockStore, tenantFilter?: string): SupabaseClient {
  const from = (table: string) => {
    if (table === "fi_leads") {
      const filters: Record<string, string> = {};
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        order: () => chain,
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          const rows = store.leads.filter((row) => {
            for (const [key, value] of Object.entries(filters)) {
              if (String((row as unknown as Record<string, unknown>)[key]) !== value) return false;
            }
            return true;
          });
          if (tenantFilter) {
            assert.equal(filters.tenant_id, tenantFilter);
          }
          return Promise.resolve({ data: rows, error: null }).then(onF, onR);
        },
      };
      return { select: () => chain };
    }

    if (table === "fi_tenant_external_integrations") {
      const filters: Record<string, string> = {};
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        neq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => {
          const row = store.integrations.find((integration) => {
            for (const [key, value] of Object.entries(filters)) {
              if (String((integration as Record<string, unknown>)[key]) !== value) return false;
            }
            return true;
          });
          return { data: row ?? null, error: null };
        },
      };
      return { select: () => chain };
    }

    if (table === "fi_lead_activity") {
      const filters: Record<string, string> = {};
      let limit = 20;
      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        order: () => chain,
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          const leadById = new Map(store.leads.map((lead) => [lead.id, lead]));
          let rows = store.activities
            .map((activity) => {
              const lead = leadById.get(activity.lead_id);
              if (!lead) return null;
              return {
                ...activity,
                fi_leads: {
                  first_name: lead.first_name,
                  last_name: lead.last_name,
                  tenant_id: lead.tenant_id,
                },
              };
            })
            .filter(Boolean) as Array<Record<string, unknown>>;

          if (filters["fi_leads.tenant_id"]) {
            rows = rows.filter((row) => {
              const lead = row.fi_leads as { tenant_id: string };
              return lead.tenant_id === filters["fi_leads.tenant_id"];
            });
          }

          rows = rows.slice(0, limit);
          return Promise.resolve({ data: rows, error: null }).then(onF, onR);
        },
      };
      return { select: () => chain };
    }

    if (table === "fi_external_events") {
      const filters: Record<string, unknown> = {};
      let head = false;
      let orderCol: string | null = null;
      let orderAsc = true;
      let limit = 100;
      let gteCol: { col: string; val: string } | null = null;
      let notNullCol: string | null = null;

      const chain: Record<string, unknown> = {
        eq: (col: string, val: unknown) => {
          filters[col] = String(val);
          return chain;
        },
        in: (col: string, vals: unknown[]) => {
          filters[`__in_${col}`] = vals.map(String);
          return chain;
        },
        gte: (col: string, val: unknown) => {
          gteCol = { col, val: String(val) };
          return chain;
        },
        not: (col: string) => {
          notNullCol = col;
          return chain;
        },
        order: (col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) => {
          orderCol = col;
          orderAsc = opts?.ascending !== false;
          return chain;
        },
        limit: (n: number) => {
          limit = n;
          return chain;
        },
        maybeSingle: async () => {
          const rows = filterExternalEvents(store.externalEvents, filters, gteCol, notNullCol, orderCol, orderAsc);
          return { data: rows[0] ?? null, error: null };
        },
        then: (onF: (v: unknown) => unknown, onR?: (e: unknown) => unknown) => {
          const rows = filterExternalEvents(store.externalEvents, filters, gteCol, notNullCol, orderCol, orderAsc).slice(
            0,
            limit
          );
          if (head) {
            return Promise.resolve({ count: rows.length, error: null }).then(onF, onR);
          }
          return Promise.resolve({ data: rows, error: null }).then(onF, onR);
        },
      };

      return {
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          head = opts?.head === true;
          return chain;
        },
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  };

  return { from } as unknown as SupabaseClient;
}

function filterExternalEvents(
  events: FiExternalEventRow[],
  filters: Record<string, unknown>,
  gteCol: { col: string; val: string } | null,
  notNullCol: string | null,
  orderCol: string | null,
  orderAsc: boolean
): FiExternalEventRow[] {
  let rows = events.filter((row) => {
    for (const [key, value] of Object.entries(filters)) {
      if (key.startsWith("__in_")) {
        const col = key.slice(5);
        const allowed = value as string[];
        if (!allowed.includes(String((row as unknown as Record<string, unknown>)[col]))) return false;
        continue;
      }
      if (String((row as unknown as Record<string, unknown>)[key]) !== String(value)) return false;
    }
    if (gteCol && String((row as unknown as Record<string, unknown>)[gteCol.col] ?? "") < gteCol.val) {
      return false;
    }
    if (notNullCol && (row as unknown as Record<string, unknown>)[notNullCol] == null) return false;
    return true;
  });

  if (orderCol) {
    rows = [...rows].sort((a, b) => {
      const av = String((a as unknown as Record<string, unknown>)[orderCol] ?? "");
      const bv = String((b as unknown as Record<string, unknown>)[orderCol] ?? "");
      return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }

  return rows;
}

describe("LeadFlow operator dashboard core", () => {
  it("calculates priority counts correctly", () => {
    const leads = [
      makeLead({ priority_band: "urgent" }),
      makeLead({ priority_band: "high" }),
      makeLead({ priority_band: "medium" }),
      makeLead({ priority_band: "low" }),
      makeLead({ priority_band: null }),
    ];

    const counts = buildLeadFlowOperatorPriorityCounts(leads);
    assert.equal(counts.urgent, 1);
    assert.equal(counts.high, 1);
    assert.equal(counts.medium, 1);
    assert.equal(counts.low, 2);
  });

  it("calculates pipeline counts by current_stage", () => {
    const leads = [
      makeLead({ current_stage: "new" }),
      makeLead({ current_stage: "new" }),
      makeLead({ current_stage: "contacted" }),
      makeLead({ current_stage: "consultation_booked" }),
      makeLead({ current_stage: "proposal_sent" }),
      makeLead({ current_stage: "won" }),
      makeLead({ current_stage: "lost" }),
      makeLead({ current_stage: "qualified" }),
    ];

    const pipeline = buildLeadFlowOperatorPipelineColumns(leads);
    assert.equal(pipeline.find((col) => col.stage === "new")?.count, 2);
    assert.equal(pipeline.find((col) => col.stage === "contacted")?.count, 1);
    assert.equal(pipeline.find((col) => col.stage === "consultation_booked")?.count, 1);
    assert.equal(pipeline.find((col) => col.stage === "proposal_sent")?.count, 1);
    assert.equal(pipeline.find((col) => col.stage === "won")?.count, 1);
    assert.equal(pipeline.find((col) => col.stage === "lost")?.count, 1);
    assert.equal(pipeline.find((col) => col.stage === "qualified"), undefined);
  });

  it("orders high-priority leads by score then updated_at", () => {
    const leads = [
      makeLead({ id: "a", priority_band: "high", lead_score: 70, updated_at: "2026-06-24T10:00:00.000Z" }),
      makeLead({ id: "b", priority_band: "urgent", lead_score: 90, updated_at: "2026-06-23T10:00:00.000Z" }),
      makeLead({ id: "c", priority_band: "urgent", lead_score: 90, updated_at: "2026-06-25T10:00:00.000Z" }),
      makeLead({ id: "d", priority_band: "low", lead_score: 99, updated_at: "2026-06-25T12:00:00.000Z" }),
    ];

    const selected = selectLeadFlowOperatorHighPriorityLeads(leads);
    assert.deepEqual(
      selected.map((lead) => lead.id),
      ["c", "b", "a"]
    );
  });

  it("sanitizes failed diagnostics", () => {
    const sanitized = sanitizeLeadFlowOperatorFailedEvent({
      id: "evt-1",
      provider: "hubspot",
      event_type: "hubspot.contact.updated",
      external_id: "501",
      provider_event_id: "delivery-1",
      error_message: 'Bearer secret-token and "access_token": "abc"',
      retry_count: 2,
      created_at: "2026-06-25T10:00:00.000Z",
      last_retry_at: null,
    });

    assert.equal(sanitized.provider, "hubspot");
    assert.equal(sanitized.externalId, "501");
    assert.match(sanitized.errorMessage ?? "", /Bearer \[redacted\]/);
    assert.doesNotMatch(sanitized.errorMessage ?? "", /secret-token/);
    assert.doesNotMatch(JSON.stringify(sanitized), /provider_event_id/);
  });

  it("handles empty lead sets without crashing", () => {
    const summary = buildLeadFlowOperatorSummaryMetrics([], 0);
    assert.equal(summary.totalLeads, 0);
    assert.deepEqual(buildLeadFlowOperatorPipelineColumns([]).map((col) => col.count), [0, 0, 0, 0, 0, 0, 0]);
    assert.equal(selectLeadFlowOperatorHighPriorityLeads([]).length, 0);
    const predicted = buildLeadFlowOperatorPredictedProcedureCounts([]);
    assert.equal(predicted.unknown, 0);
  });
});

describe("LeadFlow operator dashboard compose", () => {
  it("returns tenant-scoped metrics with queue health and sanitized diagnostics", async () => {
    const leadA = makeLead({
      id: "lead-a",
      tenant_id: TENANT_A,
      current_stage: "new",
      priority_band: "urgent",
      lead_score: 88,
      predicted_procedure: "fue_transplant",
    });

    const tenantLeads = [leadA];
    const supabase = makeOperatorDashboardSupabase(
      {
        leads: [leadA, makeLead({ id: "lead-b", tenant_id: TENANT_B, current_stage: "won", priority_band: "high" })],
        externalEvents: [
          makeFailedEvent({ tenant_id: TENANT_A }),
          makeFailedEvent({ tenant_id: TENANT_B, external_id: "other" }),
        ],
        integrations: [{ tenant_id: TENANT_A, provider: "hubspot", status: "active", config: { label: "Clinic HubSpot" } }],
        activities: [
          {
            id: "act-1",
            lead_id: "lead-a",
            activity_type: "stage_changed",
            metadata: { from_stage: "new", to_stage: "contacted" },
            created_at: "2026-06-25T09:00:00.000Z",
          },
        ],
      },
      TENANT_A
    );

    const queueHealth = await loadLeadFlowQueueHealth({ tenantId: TENANT_A, supabase });
    const payload = composeLeadFlowOperatorDashboardPayload({
      tenantId: TENANT_A,
      leads: tenantLeads,
      queueHealth,
      failedEvents: [makeFailedEvent({ tenant_id: TENANT_A })],
      hubspot: { connected: true, label: "Clinic HubSpot" },
      recentActivity: [
        {
          id: "act-1",
          activityType: "stage_changed",
          activityLabel: labelLeadFlowOperatorActivityType("stage_changed"),
          leadName: formatLeadFlowOperatorName(leadA),
          metadataSummary: summarizeLeadFlowOperatorActivityMetadata("stage_changed", {
            from_stage: "new",
            to_stage: "contacted",
          }),
          createdAt: "2026-06-25T09:00:00.000Z",
        },
      ],
    });

    assert.equal(payload.tenantId, TENANT_A);
    assert.equal(payload.summary.totalLeads, 1);
    assert.equal(payload.summary.newLeads, 1);
    assert.equal(payload.summary.procedureBooked, 0);
    assert.equal(payload.highPriorityLeads.length, 1);
    assert.equal(payload.hubspot.connected, true);
    assert.equal(payload.hubspot.label, "Clinic HubSpot");
    assert.ok(payload.queueHealth.counts.failed >= 1);
    assert.equal(payload.failedDiagnostics.length, 1);
    assert.ok(payload.failedDiagnostics[0]?.errorMessage?.includes("[redacted]"));
    assert.equal(payload.recentActivity.length, 1);
    assert.match(payload.recentActivity[0]?.metadataSummary ?? "", /Contacted/);
  });

  it("returns empty-state payload without crashing", () => {
    const payload = composeLeadFlowOperatorDashboardPayload({
      tenantId: TENANT_A,
      leads: [],
      queueHealth: {
        tenant_id: TENANT_A,
        provider: "hubspot",
        counts: { pending: 0, retrying: 0, processing: 0, processed: 0, failed: 0 },
        oldest_pending_at: null,
        newest_processed_at: null,
        failed_last_24h: 0,
        processed_last_24h: 0,
      },
      failedEvents: [],
      hubspot: { connected: false, label: null },
      recentActivity: [],
    });

    assert.equal(payload.summary.totalLeads, 0);
    assert.equal(payload.highPriorityLeads.length, 0);
    assert.equal(payload.recentActivity.length, 0);
    assert.equal(payload.failedDiagnostics.length, 0);
    assert.equal(payload.hubspot.connected, false);
    assert.equal(payload.queueHealth.counts.pending, 0);
  });
});
