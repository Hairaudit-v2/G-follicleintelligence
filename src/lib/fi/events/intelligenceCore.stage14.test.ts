import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  FI_EVENTS_SOURCE_FIELD,
  FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD,
  compareIntelligenceEventLogsToFiEvents,
  computeCompareIntelligenceLogsToFiEventsSummary,
} from "./compareIntelligenceEventLogsToFiEvents.server";
import {
  __resetInternalIntelligenceEventQueueForTests,
  getInternalIntelligenceQueueSnapshot,
} from "./internalBusQueue";
import { parseIntelligenceEventLogReplayCliArgs } from "./intelligenceEventLogReplayCliArgs";
import type { IntelligenceEventLogReplayCandidate } from "./intelligenceEventLogReplayTypes";
import { clampIntelligenceEventLogReplayLimit } from "./loadIntelligenceEventReplayCandidates.server";
import { loadIntelligenceEventReplayCandidates } from "./loadIntelligenceEventReplayCandidates.server";
import {
  buildShadowReplayEnvelopeFromCandidate,
  replayIntelligenceEventLogs,
} from "./replayIntelligenceEventLogs.server";

function thenableResult<T>(result: T): { then: (fn: (v: T) => unknown) => Promise<unknown> } {
  return {
    then(fn: (v: T) => unknown) {
      return Promise.resolve(result).then(fn);
    },
  };
}

function createIntelLogChain(rows: unknown[]) {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = chain;
  b.eq = chain;
  b.gte = chain;
  b.lte = chain;
  b.order = chain;
  b.limit = () => thenableResult({ data: rows, error: null });
  return b;
}

function mockSupabaseForIntelRows(rows: unknown[]): SupabaseClient {
  return {
    from(table: string) {
      assert.equal(table, "fi_intelligence_event_logs");
      return createIntelLogChain(rows);
    },
  } as unknown as SupabaseClient;
}

function mockSupabaseDual(intel: unknown[], fi: unknown[]): SupabaseClient {
  return {
    from(table: string) {
      return createIntelLogChain(table === "fi_intelligence_event_logs" ? intel : fi);
    },
  } as unknown as SupabaseClient;
}

const validCandidate: IntelligenceEventLogReplayCandidate = {
  id: "00000000-0000-4000-8000-000000000001",
  event_name: "hairaudit.audit.completed",
  source: "hairaudit",
  source_event_id: null,
  correlation_id: "corr-1",
  privacy_level: "internal_debug",
  delivery_mode: "internal_only",
  status: "enqueued",
  payload_summary: {
    schema_version: 1,
    patient_notes: "SHOULD_NOT_APPEAR_IN_ENVELOPE",
  },
  warnings: [],
  error_message: null,
  occurred_at: "2026-06-01T12:00:00.000Z",
  created_at: "2026-06-01T12:01:00.000Z",
};

describe("intelligenceEventLogReplayCliArgs (Stage 14)", () => {
  it("defaults to dry_run and parses filters", () => {
    const r = parseIntelligenceEventLogReplayCliArgs([
      "node",
      "x.js",
      "--event-name",
      "a.b",
      "--limit",
      "3",
      "--json",
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.mode, "dry_run");
    assert.equal(r.value.filters.event_name, "a.b");
    assert.equal(r.value.filters.limit, 3);
    assert.equal(r.value.printJson, true);
  });

  it("rejects invalid mode", () => {
    const r = parseIntelligenceEventLogReplayCliArgs(["node", "x.js", "--mode", "prod"]);
    assert.equal(r.ok, false);
  });
});

describe("clampIntelligenceEventLogReplayLimit (Stage 14)", () => {
  it("clamps to 1..500", () => {
    assert.equal(clampIntelligenceEventLogReplayLimit(undefined), 50);
    assert.equal(clampIntelligenceEventLogReplayLimit(0), 1);
    assert.equal(clampIntelligenceEventLogReplayLimit(9999), 500);
    assert.equal(clampIntelligenceEventLogReplayLimit(2.7), 2);
  });
});

describe("loadIntelligenceEventReplayCandidates (Stage 14)", () => {
  it("uses clamped limit with mock supabase (omit assert)", async () => {
    let limitSeen = -1;
    const b: Record<string, unknown> = {};
    const chain = () => b;
    b.select = chain;
    b.eq = chain;
    b.gte = chain;
    b.lte = chain;
    b.order = chain;
    b.limit = (n: number) => {
      limitSeen = n;
      return thenableResult({ data: [], error: null });
    };
    const client = {
      from() {
        return b;
      },
    } as unknown as SupabaseClient;

    const r = await loadIntelligenceEventReplayCandidates({
      filters: { limit: 900 },
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.equal(r.limit_effective, 500);
    assert.equal(limitSeen, 500);
    assert.deepEqual(r.candidates, []);
  });
});

describe("buildShadowReplayEnvelopeFromCandidate (Stage 14)", () => {
  it("does not reconstruct raw payload from payload_summary values", () => {
    const built = buildShadowReplayEnvelopeFromCandidate(validCandidate);
    assert.ok(!("error" in built));
    if ("error" in built) return;
    const s = JSON.stringify(built.envelope.payload);
    assert.equal(s.includes("SHOULD_NOT_APPEAR_IN_ENVELOPE"), false);
    assert.equal(built.envelope.payload._stage14_replay_shadow, true);
  });
});

describe("replayIntelligenceEventLogs dry_run (Stage 14)", () => {
  it("returns summary counts without enqueue", async () => {
    const client = mockSupabaseForIntelRows([validCandidate]);
    const r = await replayIntelligenceEventLogs({
      mode: "dry_run",
      filters: { limit: 10 },
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.equal(r.summary.candidates_loaded, 1);
    assert.equal(r.summary.mode, "dry_run");
    assert.ok(!r.load_error);
  });
});

describe("replayIntelligenceEventLogs validate_only (Stage 14)", () => {
  it("collects warnings for invalid rows", async () => {
    const bad: IntelligenceEventLogReplayCandidate = {
      ...validCandidate,
      id: "00000000-0000-4000-8000-000000000002",
      source: "not_a_real_source",
    };
    const client = mockSupabaseForIntelRows([bad]);
    const r = await replayIntelligenceEventLogs({
      mode: "validate_only",
      filters: {},
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.equal(r.summary.validated_failed, 1);
    assert.equal(r.summary.validated_ok, 0);
    assert.ok(r.warnings.some((w) => w.code === "validate_parse_failed"));
  });
});

describe("replayIntelligenceEventLogs enqueue_shadow (Stage 14)", () => {
  beforeEach(() => {
    __resetInternalIntelligenceEventQueueForTests();
  });

  afterEach(() => {
    __resetInternalIntelligenceEventQueueForTests();
  });

  it("is blocked when internal queue env is disabled", async () => {
    const client = mockSupabaseForIntelRows([validCandidate]);
    const r = await replayIntelligenceEventLogs({
      mode: "enqueue_shadow",
      filters: {},
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { NODE_ENV: "test", FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "0" },
      nodeEnv: "test",
    });
    assert.equal(r.summary.shadow_enqueued, 0);
    assert.equal(r.summary.shadow_skipped_disabled, 1);
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 0);
  });

  it("is blocked in production even if queue flag is set", async () => {
    const client = mockSupabaseForIntelRows([validCandidate]);
    const r = await replayIntelligenceEventLogs({
      mode: "enqueue_shadow",
      filters: {},
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { NODE_ENV: "production", FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "production",
    });
    assert.equal(r.summary.shadow_enqueued, 0);
    assert.equal(r.summary.shadow_skipped_disabled, 1);
  });

  it("enqueues when queue enabled in non-production without persisting log rows", async () => {
    const client = mockSupabaseForIntelRows([validCandidate]);
    const r = await replayIntelligenceEventLogs({
      mode: "enqueue_shadow",
      filters: {},
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { NODE_ENV: "test", FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(r.summary.shadow_enqueued, 1);
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 1);
  });
});

describe("computeCompareIntelligenceLogsToFiEventsSummary (Stage 14)", () => {
  it("exposes fi_events source field contract as source_system", () => {
    const s = computeCompareIntelligenceLogsToFiEventsSummary(
      [
        {
          id: "i1",
          event_name: "only_intel",
          source: "hairaudit",
          status: "enqueued",
          correlation_id: "c1",
          source_event_id: "missing-fi",
          created_at: "2026-01-01",
        },
      ],
      [
        {
          id: "f1",
          event_type: "only_fi",
          source_system: "hli",
          status: "processed",
          created_at: "2026-01-01",
        },
      ]
    );
    assert.equal(s.source_system, FI_EVENTS_SOURCE_FIELD);
    assert.equal(s.source, FI_INTELLIGENCE_EVENT_LOGS_SOURCE_FIELD);
    assert.equal(s.fi_events_correlation_from_payload_disabled, true);
    assert.ok(s.event_names_only_in_intelligence.includes("only_intel"));
    assert.ok(s.event_types_only_in_fi_events.includes("only_fi"));
    assert.ok(s.intelligence_source_event_ids_without_fi_events_row_sample.includes("missing-fi"));
  });
});

describe("compareIntelligenceEventLogsToFiEvents dual mock (Stage 14)", () => {
  it("loads both tables read-only shape", async () => {
    const client = mockSupabaseDual(
      [
        {
          id: "i1",
          event_name: "hairaudit.audit.completed",
          source: "hairaudit",
          status: "enqueued",
          correlation_id: null,
          source_event_id: null,
          created_at: "2026-01-01",
        },
      ],
      [
        {
          id: "f1",
          event_type: "hairaudit.audit.completed",
          source_system: "hairaudit",
          status: "processed",
          created_at: "2026-01-01",
        },
      ]
    );
    const r = await compareIntelligenceEventLogsToFiEvents({
      limit: 50,
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.ok(!r.error);
    assert.equal(r.summary.intelligence_rows_sampled, 1);
    assert.equal(r.summary.fi_events_rows_sampled, 1);
  });
});
