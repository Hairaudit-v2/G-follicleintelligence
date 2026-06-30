import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { parseReplayIntelligenceEventLogsScriptArgs } from "./governedIntelligenceReplayCliArgs";
import { replayIntelligenceEventLogs } from "./replayIntelligenceEventLogs.server";
import { runStagingIntelligenceReplay } from "./runStagingIntelligenceReplay.server";
import {
  isStagingActivationEventAllowed,
  getStagingActivationAllowedEvents,
} from "./stagingActivationAllowlist";
import { isStagingIntelligenceActivationEnabled } from "./stagingActivationEnv";
import type { IntelligenceEventLogReplayCandidate } from "./intelligenceEventLogReplayTypes";

const __dirname = dirname(fileURLToPath(import.meta.url));

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

const fullStagingEnv = {
  NODE_ENV: "test",
  FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
  FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED: "1",
  FI_INTELLIGENCE_STAGING_ALLOWED_EVENT: "hairaudit.audit.completed",
  FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
} as const;

function approvedEnqueueShadowRow(
  id: string,
  overrides: Partial<{
    event_name: string | null;
    replay_mode: string;
    approval_status: string;
  }> = {}
) {
  return {
    id,
    requested_by: "a",
    approved_by: "b",
    approval_status: overrides.approval_status ?? "approved",
    replay_mode: overrides.replay_mode ?? "enqueue_shadow",
    event_name: overrides.event_name ?? "hairaudit.audit.completed",
    source: null,
    status_filter: null,
    privacy_level: "internal_debug",
    since: null,
    until: null,
    correlation_id: null,
    limit_count: 10,
    candidate_count: 0,
    processed_count: 0,
    failed_count: 0,
    warning_count: 0,
    summary: {},
    warnings: [],
    created_at: "2026-06-01T12:00:00.000Z",
    approved_at: "2026-06-01T12:05:00.000Z",
    completed_at: null,
  };
}

describe("stagingActivationEnv (Stage 17)", () => {
  it("defaults staging activation off", () => {
    assert.equal(isStagingIntelligenceActivationEnabled({ env: {}, nodeEnv: "test" }), false);
  });

  it("is false in production even when staging flags are set", () => {
    assert.equal(
      isStagingIntelligenceActivationEnabled({
        env: {
          FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ALLOWED_EVENT: "hairaudit.audit.completed",
        },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("is false when FI_INTELLIGENCE_STAGING_ALLOWED_EVENT is not the fixed hairaudit name", () => {
    assert.equal(
      isStagingIntelligenceActivationEnabled({
        env: {
          FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ACTIVATION_ENABLED: "1",
          FI_INTELLIGENCE_STAGING_ALLOWED_EVENT: "hli.progression.review.completed",
        },
        nodeEnv: "test",
      }),
      false
    );
  });

  it("is true only with governed replay + staging flags + exact allowed event (non-production)", () => {
    assert.equal(
      isStagingIntelligenceActivationEnabled({ env: { ...fullStagingEnv }, nodeEnv: "test" }),
      true
    );
  });
});

describe("stagingActivationAllowlist (Stage 17)", () => {
  it("only allows hairaudit.audit.completed", () => {
    assert.equal(isStagingActivationEventAllowed("hairaudit.audit.completed"), true);
    assert.equal(isStagingActivationEventAllowed("hli.progression.review.completed"), false);
    assert.deepEqual(getStagingActivationAllowedEvents(), ["hairaudit.audit.completed"]);
  });
});

describe("parseReplayIntelligenceEventLogsScriptArgs staging (Stage 17)", () => {
  it("parses --staging-activate-run with --json", () => {
    const id = "00000000-0000-4000-8000-0000000000ab";
    const r = parseReplayIntelligenceEventLogsScriptArgs([
      "node",
      "x.js",
      "--staging-activate-run",
      id,
      "--json",
    ]);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.value.kind, "staging_activate_run");
    if (r.value.kind !== "staging_activate_run") return;
    assert.equal(r.value.runId, id);
    assert.equal(r.value.printJson, true);
  });

  it("requires --json for --staging-activate-run", () => {
    const r = parseReplayIntelligenceEventLogsScriptArgs([
      "node",
      "x.js",
      "--staging-activate-run",
      "00000000-0000-4000-8000-0000000000ac",
    ]);
    assert.equal(r.ok, false);
  });
});

describe("runStagingIntelligenceReplay (Stage 17)", () => {
  it("rejects production before touching supabase", async () => {
    const r = await runStagingIntelligenceReplay("any-id", null, {
      omitPlatformAdminAssertForOperatorCli: true,
      env: { ...fullStagingEnv, NODE_ENV: "production" },
      nodeEnv: "production",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "staging_replay_production_blocked");
    assert.ok(r.rollback_instructions.length > 0);
  });

  it("rejects when staging activation env is disabled", async () => {
    const r = await runStagingIntelligenceReplay("any-id", null, {
      omitPlatformAdminAssertForOperatorCli: true,
      env: { NODE_ENV: "test", FI_INTELLIGENCE_GOVERNED_REPLAY_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "staging_activation_disabled");
  });

  it("rejects wrong replay_mode", async () => {
    const id = "00000000-0000-4000-8000-0000000000de";
    const replay = createReplayRunsMock(
      new Map([[id, approvedEnqueueShadowRow(id, { replay_mode: "dry_run" })]])
    );
    const client = mockSupabaseReplayRunsAndIntel(replay, [validCandidate]);
    const r = await runStagingIntelligenceReplay(id, null, {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { ...fullStagingEnv },
      nodeEnv: "test",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "staging_replay_mode_blocked");
  });

  it("rejects wrong event_name for staging allow-list", async () => {
    const id = "00000000-0000-4000-8000-0000000000ef";
    const replay = createReplayRunsMock(
      new Map([
        [id, approvedEnqueueShadowRow(id, { event_name: "hli.progression.review.completed" })],
      ])
    );
    const client = mockSupabaseReplayRunsAndIntel(replay, [validCandidate]);
    const r = await runStagingIntelligenceReplay(id, null, {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { ...fullStagingEnv },
      nodeEnv: "test",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.code, "staging_event_not_allowed");
  });

  it("executes approved enqueue_shadow hairaudit run when staging env is on", async () => {
    const id = "00000000-0000-4000-8000-0000000000fa";
    const replay = createReplayRunsMock(new Map([[id, approvedEnqueueShadowRow(id)]]));
    const client = mockSupabaseReplayRunsAndIntel(replay, [validCandidate]);
    const r = await runStagingIntelligenceReplay(id, null, {
      supabaseClientForTests: client,
      omitPlatformAdminAssertForOperatorCli: true,
      env: { ...fullStagingEnv },
      nodeEnv: "test",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.ok(r.data.rollback_instructions.length > 0);
    assert.ok(r.data.replay_summary);
  });
});

describe("no production downstream dispatch path (Stage 17 regression)", () => {
  it("keeps enqueue_shadow replay inert in production (Stage 14 engine)", async () => {
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

  it("staging runner source hard-blocks production NODE_ENV", () => {
    const p = join(__dirname, "runStagingIntelligenceReplay.server.ts");
    const src = readFileSync(p, "utf8");
    assert.match(src, /nodeEnv === "production"/);
    assert.match(src, /enqueue_shadow/);
  });
});
