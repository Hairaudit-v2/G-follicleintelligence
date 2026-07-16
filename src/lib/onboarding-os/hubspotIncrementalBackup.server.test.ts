import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runIncrementalNotesBackup, recoverStuckIncrementalRun } from "./hubspotIncrementalBackup.server";
import { HUBSPOT_INCREMENTAL_STUCK_AGE_MS } from "./hubspotIncrementalBackupCore";

type Row = Record<string, unknown>;

function makeSupabaseMock(state: {
  runs: Row[];
  notes: Row[];
  watermarks: Row[];
  events: Row[];
  forceFinalizeError?: boolean;
  forceInsertConflict?: boolean;
}) {
  const auth = { id: "auth-session-1" };

  function from(table: string) {
    if (table === "fi_external_connector_auth_sessions") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: auth, error: null }),
            }),
          }),
        }),
      };
    }

    if (table === "fi_external_connector_verification_events") {
      return {
        insert: async (row: Row) => {
          state.events.push(row);
          return { error: null };
        },
      };
    }

    if (table === "fi_external_hubspot_backup_watermarks") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: state.watermarks[0] ?? null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
        insert: async (row: Row) => {
          state.watermarks.push({ ...row, id: "wm-1", version: 1 });
          return { error: null };
        },
        update: (patch: Row) => ({
          eq: () => ({
            eq: async () => {
              if (state.watermarks[0]) Object.assign(state.watermarks[0], patch);
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "fi_external_hubspot_note_staging") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              in: async (_col: string, ids: string[]) => ({
                data: state.notes.filter((n) => ids.includes(String(n.hubspot_record_id))),
                error: null,
              }),
            }),
          }),
        }),
        upsert: async (rows: Row[]) => {
          for (const row of rows) {
            const id = String(row.hubspot_record_id);
            const idx = state.notes.findIndex((n) => n.hubspot_record_id === id);
            if (idx >= 0) state.notes[idx] = { ...state.notes[idx], ...row };
            else state.notes.push(row);
          }
          return { error: null };
        },
      };
    }

    if (table === "fi_external_hubspot_association_staging") {
      return {
        upsert: async () => ({ error: null }),
      };
    }

    if (table === "fi_external_hubspot_sync_runs") {
      return {
        select: () => ({
          eq: (col: string, val: unknown) => {
            const chain = {
              eq: (col2: string, val2: unknown) => ({
                eq: (col3: string, val3: unknown) => ({
                  maybeSingle: async () => {
                    const found = state.runs.find(
                      (r) =>
                        r[col] === val &&
                        r[col2] === val2 &&
                        (val3 === undefined || r[col3] === val3)
                    );
                    return { data: found ?? null, error: null };
                  },
                }),
                maybeSingle: async () => {
                  const found = state.runs.find((r) => r[col] === val && r[col2] === val2);
                  return { data: found ?? null, error: null };
                },
                single: async () => {
                  const found = state.runs.find((r) => r[col] === val && r[col2] === val2);
                  return { data: found ?? null, error: found ? null : { message: "missing" } };
                },
              }),
              maybeSingle: async () => {
                const found = state.runs.find((r) => r[col] === val);
                return { data: found ?? null, error: null };
              },
              single: async () => {
                const found = state.runs.find((r) => r[col] === val);
                return { data: found ?? null, error: found ? null : { message: "missing" } };
              },
            };
            return chain;
          },
        }),
        insert: async (row: Row) => {
          if (state.forceInsertConflict) {
            return {
              data: null,
              error: { message: 'duplicate key value violates unique constraint "uq_hubspot_incremental_active_run"' },
            };
          }
          const created = {
            ...row,
            id: row.id ?? `run-${state.runs.length + 1}`,
            engagement_counters: {},
            last_checkpoint_at: null,
          };
          state.runs.push(created);
          return {
            data: created,
            error: null,
            select: () => ({
              single: async () => ({ data: created, error: null }),
            }),
          };
        },
        update: (patch: Row) => ({
          eq: (col: string, val: unknown) => ({
            eq: async (col2: string, val2: unknown) => {
              if (state.forceFinalizeError && patch.status && patch.status !== "started") {
                return { error: { message: "finalize failed" } };
              }
              const run = state.runs.find((r) => r[col] === val && r[col2] === val2);
              if (run) Object.assign(run, patch);
              return { error: null };
            },
            // single-eq update path
            then: undefined,
          }),
        }),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  }

  // Fix insert().select().single() chain used by production code
  const originalFrom = from;
  return {
    from: (table: string) => {
      const api = originalFrom(table);
      if (table === "fi_external_hubspot_sync_runs") {
        return {
          ...api,
          insert: (row: Row) => {
            if (state.forceInsertConflict) {
              return {
                select: () => ({
                  single: async () => ({
                    data: null,
                    error: {
                      message:
                        'duplicate key value violates unique constraint "uq_hubspot_incremental_active_run"',
                    },
                  }),
                }),
              };
            }
            const created = {
              ...row,
              id: `run-${state.runs.length + 1}`,
              engagement_counters: {},
              last_checkpoint_at: null,
            };
            state.runs.push(created);
            return {
              select: () => ({
                single: async () => ({ data: created, error: null }),
              }),
            };
          },
          update: (patch: Row) => ({
            eq: (col: string, val: unknown) => {
              const apply = (col2?: string, val2?: unknown) => {
                if (state.forceFinalizeError && patch.completed_at) {
                  return Promise.resolve({ error: { message: "finalize failed" } });
                }
                const run = state.runs.find((r) => {
                  if (r[col] !== val) return false;
                  if (col2 != null && r[col2] !== val2) return false;
                  return true;
                });
                if (run) Object.assign(run, patch);
                return Promise.resolve({ error: null });
              };
              return {
                eq: (col2: string, val2: unknown) => apply(col2, val2),
                then: (resolve: (v: unknown) => unknown) => resolve(apply()),
              };
            },
          }),
          select: () => ({
            eq: (col: string, val: unknown) => ({
              eq: (col2: string, val2: unknown) => ({
                eq: (col3: string, val3: unknown) => ({
                  maybeSingle: async () => ({
                    data:
                      state.runs.find(
                        (r) => r[col] === val && r[col2] === val2 && r[col3] === val3
                      ) ?? null,
                    error: null,
                  }),
                }),
                maybeSingle: async () => ({
                  data: state.runs.find((r) => r[col] === val && r[col2] === val2) ?? null,
                  error: null,
                }),
                single: async () => {
                  const found = state.runs.find((r) => r[col] === val && r[col2] === val2);
                  return { data: found ?? null, error: found ? null : { message: "missing" } };
                },
              }),
              maybeSingle: async () => ({
                data: state.runs.find((r) => r[col] === val) ?? null,
                error: null,
              }),
            }),
          }),
        };
      }
      return api;
    },
  };
}

const auth = {
  actorAuthUserId: "actor-1",
  fiUserId: null,
  actorLabel: "test",
};

describe("runIncrementalNotesBackup", () => {
  it("completes empty range, verifies, and advances watermark", async () => {
    const state = { runs: [] as Row[], notes: [] as Row[], watermarks: [] as Row[], events: [] as Row[] };
    const supabase = makeSupabaseMock(state) as never;
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [], paging: {} }), { status: 200 });

    const result = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      fetchImpl,
      authSessionId: "auth-session-1",
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.emptyRange, true);
    assert.equal(result.status, "completed");
    assert.equal(result.verificationState, "passed");
    assert.equal(result.watermarkAdvanced, true);
    assert.equal(state.watermarks.length, 1);
    assert.equal(state.watermarks[0]?.watermark_timestamp, "2026-07-16T01:00:00.000Z");
    assert.ok(state.events.some((e) => (e.detail as Row).event === "verification_passed"));
    assert.ok(state.events.some((e) => (e.detail as Row).event === "watermark_advanced"));
  });

  it("inserts one note then same-range rerun is unchanged (single destination row)", async () => {
    const note = {
      id: "note-1",
      createdAt: "2026-07-16T00:10:00.000Z",
      updatedAt: "2026-07-16T00:10:00.000Z",
      properties: { hs_note_body: "TEST", hs_timestamp: "2026-07-16T00:10:00.000Z" },
    };
    const state = { runs: [] as Row[], notes: [] as Row[], watermarks: [] as Row[], events: [] as Row[] };
    const supabase = makeSupabaseMock(state) as never;
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ results: [note], paging: {} }), { status: 200 });

    const first = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      fetchImpl,
      authSessionId: "auth-session-1",
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.counters.inserted, 1);
    assert.equal(state.notes.length, 1);

    // Clear active run so second insert is allowed; keep staged note.
    state.runs = [];
    const second = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      fetchImpl,
      authSessionId: "auth-session-1",
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(state.notes.length, 1);
    assert.equal(second.counters.inserted, 0);
    assert.ok(second.counters.unchanged + second.counters.updated >= 1);
  });

  it("rejects overlapping active run (concurrency fail-closed)", async () => {
    const state = {
      runs: [] as Row[],
      notes: [] as Row[],
      watermarks: [] as Row[],
      events: [] as Row[],
      forceInsertConflict: true,
    };
    const supabase = makeSupabaseMock(state) as never;
    const result = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      fetchImpl: async () => new Response("{}", { status: 200 }),
      authSessionId: "auth-session-1",
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.exitHint, "conflict");
    assert.equal(state.watermarks.length, 0);
  });

  it("resume preserves original cutoff bounds", async () => {
    const state = {
      runs: [
        {
          id: "run-resume",
          tenant_id: "tenant-1",
          integration_id: "integ-1",
          status: "started",
          backup_run_type: "incremental",
          incremental_dataset: "notes",
          incremental_cutoff_from: "2026-07-16T00:00:00.000Z",
          incremental_cutoff_to: "2026-07-16T01:00:00.000Z",
          incremental_checkpoint: { searchAfter: null, lastUpdatedAt: null, lastId: null, pagesCompleted: 0 },
          incremental_verification_state: "pending",
          detail: { milestone: "FI-HUBSPOT-INCREMENTAL-BACKUP-1" },
          engagement_counters: {},
          started_at: "2026-07-16T00:05:00.000Z",
          last_checkpoint_at: "2026-07-16T00:05:00.000Z",
        },
      ] as Row[],
      notes: [] as Row[],
      watermarks: [] as Row[],
      events: [] as Row[],
    };
    const supabase = makeSupabaseMock(state) as never;
    const widened = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T02:00:00.000Z",
      resumeRunId: "run-resume",
      fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
      authSessionId: "auth-session-1",
    });
    assert.equal(widened.ok, false);
    if (widened.ok) return;
    assert.match(widened.error, /immutable range|must match/i);

    const ok = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      resumeRunId: "run-resume",
      fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
      authSessionId: "auth-session-1",
    });
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.cutoffFrom, "2026-07-16T00:00:00.000Z");
    assert.equal(ok.cutoffTo, "2026-07-16T01:00:00.000Z");
    assert.ok(state.events.some((e) => (e.detail as Row).event === "run_resumed"));
  });

  it("does not advance watermark when finalisation fails", async () => {
    const state = {
      runs: [] as Row[],
      notes: [] as Row[],
      watermarks: [] as Row[],
      events: [] as Row[],
      forceFinalizeError: true,
    };
    const supabase = makeSupabaseMock(state) as never;
    const result = await runIncrementalNotesBackup({
      supabase,
      accessToken: "token",
      tenantId: "tenant-1",
      integrationId: "integ-1",
      portalId: "123",
      auth,
      cutoffFrom: "2026-07-16T00:00:00.000Z",
      cutoffTo: "2026-07-16T01:00:00.000Z",
      fetchImpl: async () => new Response(JSON.stringify({ results: [] }), { status: 200 }),
      authSessionId: "auth-session-1",
    });
    assert.equal(result.ok, false);
    assert.equal(state.watermarks.length, 0);
    assert.ok(!state.events.some((e) => (e.detail as Row).event === "watermark_advanced"));
  });
});

describe("recoverStuckIncrementalRun", () => {
  it("recovers stale started run without advancing watermark", async () => {
    const startedAt = new Date(Date.now() - HUBSPOT_INCREMENTAL_STUCK_AGE_MS - 60_000).toISOString();
    const state = {
      runs: [
        {
          id: "stuck-1",
          tenant_id: "tenant-1",
          integration_id: "integ-1",
          status: "started",
          backup_run_type: "incremental",
          incremental_dataset: "notes",
          detail: {},
          started_at: startedAt,
          last_checkpoint_at: startedAt,
        },
      ] as Row[],
      notes: [] as Row[],
      watermarks: [] as Row[],
      events: [] as Row[],
    };
    const supabase = makeSupabaseMock(state) as never;
    const result = await recoverStuckIncrementalRun({
      supabase,
      tenantId: "tenant-1",
      integrationId: "integ-1",
      runId: "stuck-1",
      auth,
      reason: "process terminated without finalize",
      transitionTo: "failed",
    });
    assert.equal(result.ok, true);
    assert.equal(state.runs[0]?.status, "failed");
    assert.equal(state.watermarks.length, 0);
    assert.ok(state.events.some((e) => (e.detail as Row).event === "stuck_run_recovered"));
  });

  it("refuses to recover completed runs", async () => {
    const state = {
      runs: [
        {
          id: "done-1",
          tenant_id: "tenant-1",
          integration_id: "integ-1",
          status: "completed",
          backup_run_type: "incremental",
          detail: {},
          started_at: "2026-07-16T00:00:00.000Z",
          last_checkpoint_at: "2026-07-16T00:00:00.000Z",
        },
      ] as Row[],
      notes: [] as Row[],
      watermarks: [] as Row[],
      events: [] as Row[],
    };
    const supabase = makeSupabaseMock(state) as never;
    const result = await recoverStuckIncrementalRun({
      supabase,
      tenantId: "tenant-1",
      integrationId: "integ-1",
      runId: "done-1",
      auth,
      reason: "should not work",
      transitionTo: "failed",
    });
    assert.equal(result.ok, false);
  });
});
