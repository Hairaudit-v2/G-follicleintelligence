import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runScheduledHubspotIncrementalNotesBackup } from "./hubspotScheduledIncrementalBackup.server";

type Row = Record<string, unknown>;

function makeSupabaseMock(state: {
  watermark: Row | null;
  events: Row[];
  alerts: Row[];
  authSessionId?: string;
}) {
  return {
    from(table: string) {
      if (table === "fi_external_hubspot_backup_watermarks") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      eq() {
                        return {
                          async maybeSingle() {
                            return { data: state.watermark, error: null };
                          },
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "fi_external_connector_auth_sessions") {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return {
                      async maybeSingle() {
                        return {
                          data: state.authSessionId ? { id: state.authSessionId } : null,
                          error: null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "fi_external_connector_verification_events") {
        return {
          async insert(row: Row) {
            state.events.push(row);
            return { error: null };
          },
        };
      }
      if (table === "fi_admin_notifications") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return { data: null, error: null };
                  },
                };
              },
            };
          },
          async insert(row: Row) {
            state.alerts.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("runScheduledHubspotIncrementalNotesBackup", () => {
  it("refuses when kill switch is not enabled", async () => {
    const result = await runScheduledHubspotIncrementalNotesBackup({
      getEnv: () => undefined,
      actorAuthUserId: "actor-1",
      nowIso: "2026-07-16T04:00:00.000Z",
      supabaseClientForTests: makeSupabaseMock({
        watermark: null,
        events: [],
        alerts: [],
      }) as never,
    });
    assert.equal(result.outcome, "disabled");
    assert.equal(result.ok, false);
  });

  it("refuses missing watermark without calling backup", async () => {
    let called = false;
    const result = await runScheduledHubspotIncrementalNotesBackup({
      getEnv: (key) =>
        key === "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED"
          ? "true"
          : key === "FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID"
            ? "actor-1"
            : undefined,
      actorAuthUserId: "actor-1",
      nowIso: "2026-07-16T04:00:00.000Z",
      supabaseClientForTests: makeSupabaseMock({
        watermark: null,
        events: [],
        alerts: [],
        authSessionId: "auth-1",
      }) as never,
      runBackup: async () => {
        called = true;
        return { ok: false, error: "should not run", exitHint: "failed" };
      },
    });
    assert.equal(called, false);
    assert.equal(result.outcome, "missing_watermark");
  });

  it("runs empty successful range and records invocation", async () => {
    const state = {
      watermark: {
        watermark_timestamp: "2026-07-16T03:20:00.000Z",
        last_verified_run_id: "run-prev",
      },
      events: [] as Row[],
      alerts: [] as Row[],
      authSessionId: "auth-1",
    };
    // After success, watermark loader still returns prior then we re-read — simulate advanced.
    let reads = 0;
    const supabase = {
      from(table: string) {
        if (table === "fi_external_hubspot_backup_watermarks") {
          return {
            select() {
              return {
                eq() {
                  return {
                    eq() {
                      return {
                        eq() {
                          return {
                            async maybeSingle() {
                              reads += 1;
                              if (reads === 1) {
                                return { data: state.watermark, error: null };
                              }
                              return {
                                data: {
                                  watermark_timestamp: "2026-07-16T04:00:00.000Z",
                                  last_verified_run_id: "run-1",
                                },
                                error: null,
                              };
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        }
        return (makeSupabaseMock(state) as { from: (t: string) => unknown }).from(table);
      },
    };

    const result = await runScheduledHubspotIncrementalNotesBackup({
      getEnv: (key) =>
        key === "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED"
          ? "true"
          : key === "FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID"
            ? "actor-1"
            : undefined,
      actorAuthUserId: "actor-1",
      nowIso: "2026-07-16T04:00:00.000Z",
      supabaseClientForTests: supabase as never,
      runBackup: async (_i, _t, input) => {
        assert.equal(input.cutoffFrom, "2026-07-16T03:20:00.000Z");
        assert.equal(input.cutoffTo, "2026-07-16T04:00:00.000Z");
        return {
          ok: true,
          runId: "run-1",
          status: "completed",
          verificationState: "passed",
          watermarkAdvanced: true,
          counters: {
            discovered: 0,
            inRange: 0,
            inserted: 0,
            updated: 0,
            unchanged: 0,
            failed: 0,
            skippedOutOfRange: 0,
          },
          cutoffFrom: input.cutoffFrom,
          cutoffTo: input.cutoffTo,
          emptyRange: true,
        };
      },
    });

    assert.equal(result.ok, true);
    assert.equal(result.outcome, "empty_success");
    assert.equal(result.runId, "run-1");
    assert.equal(result.watermarkAfter, "2026-07-16T04:00:00.000Z");
    assert.ok(state.events.some((e) => (e.detail as Row).event === "scheduled_invocation"));
  });

  it("fails closed on overlap without changing watermark", async () => {
    const state = {
      watermark: {
        watermark_timestamp: "2026-07-16T03:20:00.000Z",
        last_verified_run_id: "run-prev",
      },
      events: [] as Row[],
      alerts: [] as Row[],
      authSessionId: "auth-1",
    };
    const result = await runScheduledHubspotIncrementalNotesBackup({
      getEnv: (key) =>
        key === "FI_HUBSPOT_INCREMENTAL_BACKUP_ENABLED"
          ? "true"
          : key === "FI_HUBSPOT_RECOVERY_ACTOR_AUTH_USER_ID"
            ? "actor-1"
            : undefined,
      actorAuthUserId: "actor-1",
      nowIso: "2026-07-16T04:00:00.000Z",
      supabaseClientForTests: makeSupabaseMock(state) as never,
      runBackup: async () => ({
        ok: false,
        error: "An incremental notes backup is already active.",
        exitHint: "conflict",
      }),
    });
    assert.equal(result.outcome, "overlap_blocked");
    assert.equal(result.watermarkAfter, "2026-07-16T03:20:00.000Z");
    assert.equal(state.alerts.length, 1);
  });
});
