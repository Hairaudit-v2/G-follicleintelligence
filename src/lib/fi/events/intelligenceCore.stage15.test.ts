import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { GOVERNED_DISPATCH_FUTURE_ALLOWLIST, GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST, isEnqueueShadowEventNameAllowlisted } from "./governedReplayAllowlist";
import {
  canExecuteGovernedReplayRun,
  isDispatchFutureExecutionPolicyAllowed,
  isFiIntelligenceGovernedDispatchEnabled,
  isFiIntelligenceGovernedReplayEnabled,
} from "./governedReplayEnv";
import { parseReplayIntelligenceEventLogsScriptArgs } from "./governedIntelligenceReplayCliArgs";
import { parseIntelligenceEventLogReplayCliArgs } from "./intelligenceEventLogReplayCliArgs";
import {
  approveReplayRun,
  createReplayRunDraft,
  executeApprovedReplayRun,
  submitReplayRunForApproval,
} from "./intelligenceReplayRunService.server";
import type { IntelligenceEventLogReplayCandidate } from "./intelligenceEventLogReplayTypes";
import { buildShadowReplayEnvelopeFromCandidate, replayIntelligenceEventLogs } from "./replayIntelligenceEventLogs.server";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(__dirname, "../../../../supabase/migrations/20260818120001_fi_intelligence_replay_runs.sql");

function thenableResult<T>(result: T): { then: (fn: (v: T) => unknown) => Promise<unknown> } {
  return {
    then(fn: (v: T) => unknown) {
      return Promise.resolve(result).then(fn);
    },
  };
}

function createReplayRunsMock(initial?: Map<string, Record<string, unknown>>) {
  const store = initial ?? new Map<string, Record<string, unknown>>();

  const api = {
    insert(row: Record<string, unknown>) {
      const id = randomUUID();
      const full = {
        ...row,
        id,
        summary: row.summary ?? {},
        warnings: row.warnings ?? [],
        candidate_count: row.candidate_count ?? 0,
        processed_count: row.processed_count ?? 0,
        failed_count: row.failed_count ?? 0,
        warning_count: row.warning_count ?? 0,
      };
      store.set(id, full);
      return {
        select() {
          return {
            single() {
              return Promise.resolve({ data: { id }, error: null });
            },
          };
        },
      };
    },
    select(_sel: string) {
      return {
        eq(_col: string, val: string) {
          return {
            maybeSingle() {
              return Promise.resolve({ data: store.get(val) ?? null, error: null });
            },
          };
        },
      };
    },
    update(patch: Record<string, unknown>) {
      return {
        eq(_col: string, val: string) {
          const cur = store.get(val);
          if (cur) Object.assign(cur, patch);
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  return { store, api };
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

function mockSupabaseReplayRunsAndIntel(
  replay: ReturnType<typeof createReplayRunsMock>,
  intelRows: unknown[]
): SupabaseClient {
  return {
    from(table: string) {
      if (table === "fi_intelligence_replay_runs") return replay.api;
      if (table === "fi_intelligence_event_logs") return createIntelLogChain(intelRows);
      throw new Error(`unexpected table ${table}`);
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
  payload_summary: { schema_version: 1 },
  warnings: [],
  error_message: null,
  occurred_at: "2026-06-01T12:00:00.000Z",
  created_at: "2026-06-01T12:01:00.000Z",
};

describe("fi_intelligence_replay_runs migration (Stage 15)", () => {
  it("enables RLS, service_role grants, indexes, and constraints", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    assert.match(sql, /fi_intelligence_replay_runs/i);
    assert.match(sql, /approval_status in \(/i);
    assert.match(sql, /replay_mode in \(/i);
    assert.match(sql, /idx_fi_intelligence_replay_runs_approval_created/i);
    assert.match(sql, /idx_fi_intelligence_replay_runs_mode_created/i);
    assert.match(sql, /idx_fi_intelligence_replay_runs_event_created/i);
    assert.match(sql, /idx_fi_intelligence_replay_runs_requested_by_created/i);
    assert.match(sql, /idx_fi_intelligence_replay_runs_approved_by_created/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /grant select, insert, update, delete on public\.fi_intelligence_replay_runs to service_role/i);
  });
});

describe("governedReplayEnv (Stage 15)", () => {
  it("defaults governed replay and dispatch flags off", () => {
    assert.equal(isFiIntelligenceGovernedReplayEnabled({ env: {}, nodeEnv: "test" }), false);
    assert.equal(isFiIntelligenceGovernedDispatchEnabled({ env: {}, nodeEnv: "test" }), false);
    assert.equal(canExecuteGovernedReplayRun({ env: {}, nodeEnv: "test" }), false);
  });

  it("enables governed execute when FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED=1", () => {
    assert.equal(
      canExecuteGovernedReplayRun({ env: { FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1" }, nodeEnv: "test" }),
      true
    );
  });

  it("never allows dispatch_future policy in production", () => {
    assert.equal(
      isDispatchFutureExecutionPolicyAllowed({
        env: {
          NODE_ENV: "production",
          FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
          FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED: "1",
        },
        nodeEnv: "production",
      }),
      false
    );
  });
});

describe("governedReplayAllowlist (Stage 15)", () => {
  it("keeps dispatch_future allow-list empty", () => {
    assert.deepEqual(GOVERNED_DISPATCH_FUTURE_ALLOWLIST, []);
  });

  it("only allow-lists names that exist in intelligence-core", () => {
    assert.ok(GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST.includes("hairaudit.audit.completed"));
    assert.equal(isEnqueueShadowEventNameAllowlisted("unknown.event"), false);
  });
});

describe("parseReplayIntelligenceEventLogsScriptArgs (Stage 15)", () => {
  it("parses create-run with dispatch_future mode", () => {
    const r = parseReplayIntelligenceEventLogsScriptArgs([
      "node",
      "x.js",
      "--create-run",
      "--mode",
      "dispatch_future",
      "--json",
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.kind, "create_run");
    if (r.value.kind !== "create_run") return;
    assert.equal(r.value.value.mode, "dispatch_future");
  });

  it("rejects multiple governed flags", () => {
    const r = parseReplayIntelligenceEventLogsScriptArgs([
      "node",
      "x.js",
      "--create-run",
      "--execute-run",
      "uuid",
    ]);
    assert.equal(r.ok, false);
  });

  it("parses execute-run id", () => {
    const id = "00000000-0000-4000-8000-000000000099";
    const r = parseReplayIntelligenceEventLogsScriptArgs(["node", "x.js", "--execute-run", id]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.kind, "execute_run");
    if (r.value.kind !== "execute_run") return;
    assert.equal(r.value.runId, id);
  });
});

describe("parseIntelligenceEventLogReplayCliArgs dispatch_future (Stage 15)", () => {
  it("rejects dispatch_future without governance flag", () => {
    const r = parseIntelligenceEventLogReplayCliArgs(["node", "x.js", "--mode", "dispatch_future"]);
    assert.equal(r.ok, false);
  });

  it("accepts dispatch_future when includeDispatchFutureReplayMode", () => {
    const r = parseIntelligenceEventLogReplayCliArgs(["node", "x.js", "--mode", "dispatch_future"], {
      includeDispatchFutureReplayMode: true,
    });
    assert.equal(r.ok, true);
  });
});

describe("intelligenceReplayRunService (Stage 15)", () => {
  it("blocks enqueue_shadow draft without allow-listed event_name", async () => {
    const replay = createReplayRunsMock();
    const client = mockSupabaseReplayRunsAndIntel(replay, []);
    const r = await createReplayRunDraft({
      mode: "enqueue_shadow",
      filters: { privacy_level: "internal_debug", event_name: "unknown.event" },
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "enqueue_shadow_event_not_allowlisted");
  });

  it("blocks dispatch_future execution for an approved row", async () => {
    const id = "00000000-0000-4000-8000-0000000000aa";
    const replay = createReplayRunsMock(
      new Map([
        [
          id,
          {
            id,
            approval_status: "approved",
            replay_mode: "dispatch_future",
            event_name: null,
            source: null,
            status_filter: null,
            privacy_level: null,
            since: null,
            until: null,
            correlation_id: null,
            limit_count: 5,
            summary: {},
            warnings: [],
          },
        ],
      ])
    );
    const client = mockSupabaseReplayRunsAndIntel(replay, []);
    const r = await executeApprovedReplayRun(id, null, {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: {
        FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
        NODE_ENV: "test",
      },
      nodeEnv: "test",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "dispatch_future_blocked");
  });

  it("execute dry_run records candidate counts on the run row", async () => {
    const replay = createReplayRunsMock();
    const client = mockSupabaseReplayRunsAndIntel(replay, [validCandidate]);

    const created = await createReplayRunDraft({
      mode: "dry_run",
      filters: { limit: 10, event_name: "hairaudit.audit.completed" },
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    const runId = created.data.id;

    assert.equal((await submitReplayRunForApproval(runId, "actor", { supabaseClientForTests: client, omitPlatformAdminAssertForOperatorCli: true })).ok, true);
    assert.equal((await approveReplayRun(runId, "actor2", { supabaseClientForTests: client, omitPlatformAdminAssertForOperatorCli: true })).ok, true);

    const ex = await executeApprovedReplayRun(runId, "actor2", {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1", NODE_ENV: "test" },
      nodeEnv: "test",
    });
    assert.equal(ex.ok, true);
    const row = replay.store.get(runId);
    assert.ok(row);
    assert.equal(row?.approval_status, "completed");
    assert.equal(row?.candidate_count, 1);
    assert.equal(row?.processed_count, 1);
    assert.ok((row?.summary as Record<string, unknown>).replay_summary);
  });
});

describe("production cannot dispatch shadow replay (Stage 14/15 posture)", () => {
  it("enqueue_shadow replay stays disabled in production", async () => {
    const client = {
      from() {
        return createIntelLogChain([validCandidate]);
      },
    } as unknown as SupabaseClient;
    const r = await replayIntelligenceEventLogs({
      mode: "enqueue_shadow",
      filters: {},
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { NODE_ENV: "production", FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "production",
    });
    assert.equal(r.summary.shadow_enqueued, 0);
  });
});

describe("buildShadowReplayEnvelopeFromCandidate unchanged for ingest contract", () => {
  it("still builds replay marker payload only", () => {
    const built = buildShadowReplayEnvelopeFromCandidate(validCandidate);
    assert.ok(!("error" in built));
    if ("error" in built) return;
    assert.equal((built.envelope.payload as Record<string, unknown>)._stage14_replay_shadow, true);
  });
});
