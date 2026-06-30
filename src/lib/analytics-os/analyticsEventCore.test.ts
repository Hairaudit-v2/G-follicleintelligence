import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  aggregateAnalyticsEvents,
  assertAnalyticsEventsTenantScoped,
  getAnalyticsEvents,
  getAnalyticsEventsByEntity,
  getAnalyticsEventsByModule,
  publishAnalyticsEvent,
  recordAnalyticsEvent,
  validateAnalyticsEventInput,
  validateAnalyticsEventMetadata,
  AnalyticsEventValidationError,
} from "@/src/lib/analytics-os/analyticsEventCore";
import { publishWorkforceEvent } from "@/src/lib/analytics-os/analyticsModulePublishers";

const TENANT_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CLINIC_A = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type StoredRow = Record<string, unknown>;

function createAnalyticsEventsMock(initial: StoredRow[] = []) {
  const store = [...initial];

  const api = {
    insert(row: StoredRow) {
      const id = randomUUID();
      const full: StoredRow = {
        ...row,
        id,
        created_at: new Date().toISOString(),
      };
      store.push(full);
      return {
        select() {
          return {
            single() {
              return Promise.resolve({ data: full, error: null });
            },
          };
        },
      };
    },
    select(_cols?: string) {
      return {
        eq(col: string, val: unknown) {
          return buildFilterChain((row) => row[col] === val);
        },
      };
    },
  };

  function buildFilterChain(predicate: (row: StoredRow) => boolean) {
    const filters: Array<(row: StoredRow) => boolean> = [predicate];

    const chain = {
      eq(col: string, val: unknown) {
        filters.push((row) => row[col] === val);
        return chain;
      },
      gte(col: string, val: string) {
        filters.push((row) => String(row[col]) >= val);
        return chain;
      },
      lte(col: string, val: string) {
        filters.push((row) => String(row[col]) <= val);
        return chain;
      },
      order(_col: string, _opts?: { ascending: boolean }) {
        return chain;
      },
      limit(n: number) {
        const data = store.filter((row) => filters.every((f) => f(row))).slice(0, n);
        return Promise.resolve({ data, error: null });
      },
      then(fn: (v: { data: StoredRow[]; error: null }) => unknown) {
        const data = store.filter((row) => filters.every((f) => f(row)));
        return Promise.resolve(fn({ data, error: null }));
      },
    };

    return chain;
  }

  const client = {
    from(table: string) {
      assert.equal(table, "fi_analytics_events");
      return api;
    },
  } as unknown as SupabaseClient;

  return { client, store };
}

describe("analyticsEventCore", () => {
  it("validates metadata must be a plain object", () => {
    assert.throws(() => validateAnalyticsEventMetadata([]), AnalyticsEventValidationError);
    assert.deepEqual(validateAnalyticsEventMetadata({ staff_role: "nurse" }), {
      staff_role: "nurse",
    });
  });

  it("validates module and event type contracts", () => {
    assert.doesNotThrow(() =>
      validateAnalyticsEventInput({
        tenantId: TENANT_A,
        moduleName: "workforce_os",
        eventType: "staff_assigned",
      })
    );

    assert.throws(
      () =>
        validateAnalyticsEventInput({
          tenantId: TENANT_A,
          moduleName: "workforce_os",
          eventType: "invoice_paid",
        }),
      AnalyticsEventValidationError
    );

    assert.throws(
      () =>
        validateAnalyticsEventInput({
          tenantId: TENANT_A,
          moduleName: "unknown_module" as "workforce_os",
          eventType: "staff_assigned",
        }),
      AnalyticsEventValidationError
    );
  });

  it("records and publishes analytics events", async () => {
    const { client, store } = createAnalyticsEventsMock();

    const row = await recordAnalyticsEvent(
      {
        tenantId: TENANT_A,
        clinicId: CLINIC_A,
        moduleName: "workforce_os",
        eventType: "staff_assigned",
        entityId: randomUUID(),
        entityType: "booking",
        eventValue: 82,
        eventMetadata: { staff_role: "nurse" },
      },
      { supabaseClientForTests: client }
    );

    assert.equal(row.module_name, "workforce_os");
    assert.equal(row.event_type, "staff_assigned");
    assert.equal(store.length, 1);

    const published = await publishAnalyticsEvent(
      {
        tenantId: TENANT_A,
        moduleName: "financial_os",
        eventType: "payment_received",
        eventMetadata: {},
      },
      { supabaseClientForTests: client }
    );
    assert.ok(published);
    assert.equal(store.length, 2);
  });

  it("publishAnalyticsEvent swallows validation errors", async () => {
    const { client } = createAnalyticsEventsMock();
    const result = await publishAnalyticsEvent(
      {
        tenantId: TENANT_A,
        moduleName: "workforce_os",
        eventType: "payment_received",
      },
      { supabaseClientForTests: client }
    );
    assert.equal(result, null);
  });

  it("filters events by module", async () => {
    const entityId = randomUUID();
    const { client } = createAnalyticsEventsMock([
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: CLINIC_A,
        module_name: "workforce_os",
        event_type: "staff_assigned",
        entity_id: entityId,
        entity_type: "booking",
        event_value: 90,
        event_metadata: {},
        occurred_at: "2026-06-01T10:00:00.000Z",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: CLINIC_A,
        module_name: "financial_os",
        event_type: "payment_received",
        entity_id: randomUUID(),
        entity_type: "invoice",
        event_value: 12000,
        event_metadata: {},
        occurred_at: "2026-06-02T10:00:00.000Z",
        created_at: "2026-06-02T10:00:00.000Z",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_B,
        clinic_id: null,
        module_name: "workforce_os",
        event_type: "staff_assigned",
        entity_id: randomUUID(),
        entity_type: "booking",
        event_value: 50,
        event_metadata: {},
        occurred_at: "2026-06-03T10:00:00.000Z",
        created_at: "2026-06-03T10:00:00.000Z",
      },
    ]);

    const workforceEvents = await getAnalyticsEventsByModule(TENANT_A, "workforce_os", {
      supabaseClientForTests: client,
    });
    assert.equal(workforceEvents.length, 1);
    assert.equal(workforceEvents[0]?.module_name, "workforce_os");

    const entityEvents = await getAnalyticsEventsByEntity(TENANT_A, entityId, {
      supabaseClientForTests: client,
    });
    assert.equal(entityEvents.length, 1);
    assert.equal(entityEvents[0]?.entity_id, entityId);
  });

  it("enforces tenant isolation on reads", async () => {
    const { client } = createAnalyticsEventsMock([
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: null,
        module_name: "surgery_os",
        event_type: "surgery_completed",
        entity_id: randomUUID(),
        entity_type: "surgery",
        event_value: null,
        event_metadata: {},
        occurred_at: "2026-06-01T10:00:00.000Z",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_B,
        clinic_id: null,
        module_name: "surgery_os",
        event_type: "surgery_completed",
        entity_id: randomUUID(),
        entity_type: "surgery",
        event_value: null,
        event_metadata: {},
        occurred_at: "2026-06-01T11:00:00.000Z",
        created_at: "2026-06-01T11:00:00.000Z",
      },
    ]);

    const tenantAEvents = await getAnalyticsEvents(
      { tenantId: TENANT_A },
      { supabaseClientForTests: client }
    );
    assert.equal(tenantAEvents.length, 1);
    assert.equal(tenantAEvents[0]?.tenant_id, TENANT_A);

    assert.doesNotThrow(() => assertAnalyticsEventsTenantScoped(TENANT_A, tenantAEvents));
    assert.throws(() => assertAnalyticsEventsTenantScoped(TENANT_B, tenantAEvents));
  });

  it("aggregates events by module and event type", async () => {
    const { client } = createAnalyticsEventsMock([
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: CLINIC_A,
        module_name: "financial_os",
        event_type: "payment_received",
        entity_id: randomUUID(),
        entity_type: "invoice",
        event_value: 100,
        event_metadata: {},
        occurred_at: "2026-06-01T10:00:00.000Z",
        created_at: "2026-06-01T10:00:00.000Z",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: CLINIC_A,
        module_name: "financial_os",
        event_type: "payment_received",
        entity_id: randomUUID(),
        entity_type: "invoice",
        event_value: 200,
        event_metadata: {},
        occurred_at: "2026-06-02T10:00:00.000Z",
        created_at: "2026-06-02T10:00:00.000Z",
      },
      {
        id: randomUUID(),
        tenant_id: TENANT_A,
        clinic_id: CLINIC_A,
        module_name: "consultation_os",
        event_type: "quote_sent",
        entity_id: randomUUID(),
        entity_type: "lead",
        event_value: null,
        event_metadata: {},
        occurred_at: "2026-06-03T10:00:00.000Z",
        created_at: "2026-06-03T10:00:00.000Z",
      },
    ]);

    const aggregates = await aggregateAnalyticsEvents(
      { tenantId: TENANT_A, moduleName: "financial_os" },
      { supabaseClientForTests: client }
    );

    assert.equal(aggregates.length, 1);
    assert.equal(aggregates[0]?.event_count, 2);
    assert.equal(aggregates[0]?.event_value_sum, 300);
  });

  it("module publisher delegates to workforce_os module", async () => {
    const { client, store } = createAnalyticsEventsMock();
    await publishWorkforceEvent(
      {
        tenantId: TENANT_A,
        eventType: "staff_assigned",
        eventMetadata: { staff_role: "surgeon" },
      },
      { supabaseClientForTests: client }
    );
    assert.equal(store.length, 1);
    assert.equal(store[0]?.module_name, "workforce_os");
    assert.equal(store[0]?.event_type, "staff_assigned");
  });
});

describe("analyticsEventTypes", () => {
  it("exports standardized module event enums", async () => {
    const types = await import("@/src/lib/analytics-os/analyticsEventTypes");
    assert.ok(types.WORKFORCE_EVENTS.includes("staff_assigned"));
    assert.ok(types.SURGERY_EVENTS.includes("surgery_completed"));
    assert.ok(types.FINANCIAL_EVENTS.includes("payment_received"));
    assert.ok(types.CONSULTATION_EVENTS.includes("quote_sent"));
    assert.ok(types.LEADFLOW_EVENTS.includes("lead_stage_changed"));
    assert.ok(types.PATIENT_EVENTS.includes("patient_images_uploaded"));
    assert.ok(types.IMAGING_EVENTS.includes("imaging_protocol_completed"));
    assert.ok(types.AUDIT_EVENTS.includes("audit_intelligence_completed"));
  });
});
