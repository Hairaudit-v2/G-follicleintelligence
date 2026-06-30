import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, beforeEach, afterEach } from "node:test";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  enqueueInternalIntelligenceEvent,
  __resetInternalIntelligenceEventQueueForTests,
  getInternalIntelligenceQueueSnapshot,
} from "./internalBusQueue";
import { isFiIntelligenceEventLogPersistEnabled } from "./persistentEventLogEnv";
import { persistIntelligenceEventLog } from "./persistIntelligenceEventLog.server";
import {
  sanitizeIntelligenceEventForPersistence,
  sanitizeIntelligencePayloadKeysForPersistence,
} from "./sanitizeIntelligenceEventForPersistence";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_PATH = join(
  __dirname,
  "../../../../supabase/migrations/20260816120001_fi_intelligence_event_logs.sql"
);

const sampleEnvelope = {
  schema_version: 1,
  emitted_at: "2026-06-01T12:00:00.000Z",
  source: "hairaudit" as const,
  event_name: "hairaudit.audit.completed" as const,
  delivery_mode: "internal_only" as const,
  privacy_level: "internal_debug" as const,
  correlation_id: "case-99",
  payload: {
    images: [{ type: "scalp", filename: "secret.jpg", storage_path: "/phi/path" }],
    patient_notes: "do not store",
    case_id: "c1",
  },
};

describe("persistentEventLogEnv (Stage 13)", () => {
  it("persist disabled by default (unset flag)", () => {
    assert.equal(
      isFiIntelligenceEventLogPersistEnabled({
        env: { NODE_ENV: "test" },
        nodeEnv: "test",
      }),
      false
    );
  });

  it("persist disabled in production even when flag is 1", () => {
    assert.equal(
      isFiIntelligenceEventLogPersistEnabled({
        env: {
          NODE_ENV: "production",
          FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1",
        },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("persist enabled in non-production when flag is 1", () => {
    assert.equal(
      isFiIntelligenceEventLogPersistEnabled({
        env: { FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1" },
        nodeEnv: "test",
      }),
      true
    );
  });
});

describe("sanitizeIntelligenceEventForPersistence (Stage 13)", () => {
  it("excludes sensitive key names from key_sample and counts safe keys only", () => {
    const shape = sanitizeIntelligencePayloadKeysForPersistence(
      sampleEnvelope.payload as Record<string, unknown>
    );
    assert.equal(shape.key_sample.includes("images"), false);
    assert.equal(shape.key_sample.includes("patient_notes"), false);
    assert.equal(shape.key_sample.includes("case_id"), true);
    assert.equal(shape.key_count, 1);
  });

  it("envelope sanitizer never embeds raw payload values", () => {
    const r = sanitizeIntelligenceEventForPersistence({
      kind: "envelope",
      envelope: sampleEnvelope,
    });
    assert.equal(JSON.stringify(r.payload_summary).includes("secret"), false);
    assert.equal(JSON.stringify(r.payload_summary).includes("/phi"), false);
  });

  it("queue_summary sanitizer strips sensitive names from key_sample", () => {
    const summary = {
      queue_item_id: "iq_test",
      enqueued_at: "2026-06-01T12:00:00.000Z",
      schema_version: 1,
      emitted_at: "2026-06-01T12:00:00.000Z",
      source: "hairaudit" as const,
      event_name: "hairaudit.audit.completed" as const,
      delivery_mode: "internal_only" as const,
      privacy_level: "internal_debug" as const,
      payload_summary: {
        top_level_key_count: 3,
        top_level_keys_sample: ["images", "patient_notes", "case_id"],
      },
    };
    const r = sanitizeIntelligenceEventForPersistence({ kind: "queue_summary", summary });
    assert.deepEqual(r.payload_summary.key_sample, ["case_id"]);
    assert.equal(r.payload_summary.key_count, 1);
  });
});

function insertStubCapturingPayload(): {
  client: SupabaseClient;
  lastRow: () => Record<string, unknown> | null;
} {
  let row: Record<string, unknown> | null = null;
  const client = {
    from(table: string) {
      assert.equal(table, "fi_intelligence_event_logs");
      return {
        insert(r: Record<string, unknown>) {
          row = r;
          return {
            select() {
              return {
                single: async () => ({
                  data: { id: "00000000-0000-4000-8000-000000000042" },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;
  return {
    client,
    lastRow: () => row,
  };
}

describe("persistIntelligenceEventLog (Stage 13)", () => {
  it("returns skipped_disabled when flag off", async () => {
    const r = await persistIntelligenceEventLog(
      { status: "enqueued", envelope: sampleEnvelope },
      { env: { NODE_ENV: "test" }, nodeEnv: "test" }
    );
    assert.deepEqual(r, { status: "skipped_disabled" });
  });

  it("inserts when enabled with stub Supabase client", async () => {
    const { client } = insertStubCapturingPayload();
    const r = await persistIntelligenceEventLog(
      { status: "enqueued", envelope: sampleEnvelope },
      {
        env: { FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1", NODE_ENV: "test" },
        nodeEnv: "test",
        supabaseClientForTests: client,
      }
    );
    assert.deepEqual(r, { status: "inserted", id: "00000000-0000-4000-8000-000000000042" });
  });

  it("merged drain-style payload_summary includes handler_error_count without PHI strings", async () => {
    const { client, lastRow } = insertStubCapturingPayload();
    const summary = {
      queue_item_id: "iq_test",
      enqueued_at: "2026-06-01T12:00:00.000Z",
      schema_version: 1,
      emitted_at: "2026-06-01T12:00:00.000Z",
      source: "hairaudit" as const,
      event_name: "hairaudit.audit.completed" as const,
      delivery_mode: "internal_only" as const,
      privacy_level: "internal_debug" as const,
      payload_summary: {
        top_level_key_count: 1,
        top_level_keys_sample: ["case_id"],
      },
    };
    await persistIntelligenceEventLog(
      {
        status: "error",
        summary,
        payload_summary_extra: { handler_error_count: 2 },
        error_message: "handler_errors:2",
      },
      {
        env: { FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1", NODE_ENV: "test" },
        nodeEnv: "test",
        supabaseClientForTests: client,
      }
    );
    const r = lastRow();
    assert.ok(r);
    assert.equal((r!.payload_summary as Record<string, unknown>).handler_error_count, 2);
    assert.equal(JSON.stringify(r!.payload_summary).includes("patient"), false);
  });
});

describe("fi_intelligence_event_logs migration (Stage 13)", () => {
  it("defines table, RLS, indexes, and service_role grants", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    assert.match(sql, /fi_intelligence_event_logs/i);
    assert.match(sql, /enable row level security/i);
    assert.match(sql, /idx_fi_intelligence_event_logs_event_name_created/i);
    assert.match(sql, /idx_fi_intelligence_event_logs_correlation_id/i);
    assert.match(
      sql,
      /grant select, insert on public\.fi_intelligence_event_logs to service_role/i
    );
  });
});

describe("internalBusQueue + persistence (Stage 13)", () => {
  beforeEach(() => {
    __resetInternalIntelligenceEventQueueForTests();
  });

  afterEach(() => {
    __resetInternalIntelligenceEventQueueForTests();
  });

  it("enqueue succeeds when persistence enabled but Supabase is unconfigured (persist fails internally)", async () => {
    const r = await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: {
        NODE_ENV: "test",
        FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
        FI_INTELLIGENCE_EVENT_LOG_PERSIST_ENABLED: "1",
      },
      nodeEnv: "test",
    });
    assert.equal(r.status, "enqueued");
  });

  it("does not call persistence when persist flag is off (queue still enqueues)", async () => {
    const r = await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: {
        NODE_ENV: "test",
        FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
      },
      nodeEnv: "test",
    });
    assert.equal(r.status, "enqueued");
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 1);
  });
});
