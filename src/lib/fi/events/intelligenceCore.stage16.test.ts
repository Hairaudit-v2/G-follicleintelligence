import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { GOVERNED_DISPATCH_FUTURE_ALLOWLIST, GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST } from "./governedReplayAllowlist";
import {
  canExecuteGovernedReplayRun,
  isDispatchFutureExecutionPolicyAllowed,
  isFiIntelligenceGovernedDispatchEnabled,
  isFiIntelligenceGovernedReplayEnabled,
} from "./governedReplayEnv";
import { isFiIntelligenceEventLogPersistEnabled } from "./persistentEventLogEnv";
import { executeApprovedReplayRun } from "./intelligenceReplayRunService.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

/**
 * Stage 16 source-contract tests: production governance pack guardrails.
 * Dispatch stays disabled; allow-lists stay narrow; production persistence stays off.
 */

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
    select() {
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

function mockSupabaseReplayOnly(replay: ReturnType<typeof createReplayRunsMock>): SupabaseClient {
  return {
    from(table: string) {
      if (table === "fi_intelligence_replay_runs") return replay.api;
      if (table === "fi_intelligence_event_logs") return createIntelLogChain([]);
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

describe("Stage 16 governance guardrails (source contract)", () => {
  it("does not treat FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED as production dispatch permission", () => {
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

  it("keeps dispatch_future execution blocked regardless of governed dispatch flag", async () => {
    const id = "00000000-0000-4000-8000-0000000000b1";
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
    const client = mockSupabaseReplayOnly(replay);
    const r = await executeApprovedReplayRun(id, null, {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: {
        FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
        FI_INTELLIGENCE_GOVERNED_DISPATCH_ENABLED: "1",
        NODE_ENV: "test",
      },
      nodeEnv: "test",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "dispatch_future_blocked");
  });

  it("forces production intelligence event log persistence off even when persist flag is 1", () => {
    assert.equal(
      isFiIntelligenceEventLogPersistEnabled({
        env: { FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1", NODE_ENV: "production" },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("defaults governed replay and dispatch env to off", () => {
    assert.equal(isFiIntelligenceGovernedReplayEnabled({ env: {}, nodeEnv: "test" }), false);
    assert.equal(isFiIntelligenceGovernedDispatchEnabled({ env: {}, nodeEnv: "test" }), false);
    assert.equal(canExecuteGovernedReplayRun({ env: {}, nodeEnv: "test" }), false);
  });

  it("keeps GOVERNED_DISPATCH_FUTURE_ALLOWLIST empty and disjoint from shadow enqueue allow-list", () => {
    assert.deepEqual(GOVERNED_DISPATCH_FUTURE_ALLOWLIST, []);
    const dispatchSet = new Set<string>(GOVERNED_DISPATCH_FUTURE_ALLOWLIST as readonly string[]);
    for (const n of GOVERNED_ENQUEUE_SHADOW_EVENT_ALLOWLIST) {
      assert.equal(dispatchSet.has(n), false);
    }
  });
});
