import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import {
  buildShadowHairAuditAuditCompletedIntelligenceEnvelope,
  maybeEmitShadowHairAuditAuditCompletedFromImagesIngest,
} from "./shadowHairAuditAuditCompletedBus";
import {
  registerInternalIntelligenceHandler,
  __resetInternalIntelligenceHandlersForTests,
} from "./internalBus";
import {
  enqueueInternalIntelligenceEvent,
  drainInternalIntelligenceEventQueue,
  getInternalIntelligenceQueueSnapshot,
  __resetInternalIntelligenceEventQueueForTests,
} from "./internalBusQueue";
import {
  isInternalIntelligenceInternalBusObservabilityEnabled,
  isInternalIntelligenceInternalBusQueueEnabled,
} from "./internalBusQueueEnv";
import {
  mapDrainInternalIntelligenceOutcomeToLogLike,
  mapEnqueueInternalIntelligenceOutcomeToLogLike,
} from "./internalBusObservability";

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
  },
};

describe("internalBusQueueEnv (Stage 12)", () => {
  it("queue disabled by default (unset flag)", () => {
    assert.equal(
      isInternalIntelligenceInternalBusQueueEnabled({
        env: { NODE_ENV: "test" },
        nodeEnv: "test",
      }),
      false
    );
  });

  it("queue disabled in production even when flag is 1", () => {
    assert.equal(
      isInternalIntelligenceInternalBusQueueEnabled({
        env: {
          NODE_ENV: "production",
          FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
        },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("queue enabled in non-production when flag is 1", () => {
    assert.equal(
      isInternalIntelligenceInternalBusQueueEnabled({
        env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
        nodeEnv: "test",
      }),
      true
    );
  });

  it("observability flag disabled in production even when 1", () => {
    assert.equal(
      isInternalIntelligenceInternalBusObservabilityEnabled({
        env: {
          NODE_ENV: "production",
          FI_INTELLIGENCE_INTERNAL_BUS_OBSERVABILITY_ENABLED: "1",
        },
        nodeEnv: "production",
      }),
      false
    );
  });
});

describe("internalBusQueue (Stage 12)", () => {
  beforeEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
  });

  afterEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
  });

  it("enqueue returns skipped_disabled when queue flag off", async () => {
    const r = await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: { NODE_ENV: "test" },
      nodeEnv: "test",
    });
    assert.deepEqual(r, { status: "skipped_disabled" });
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 0);
  });

  it("enqueue stores sanitized summary (no raw filenames in snapshot)", async () => {
    const r = await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(r.status, "enqueued");
    const snap = getInternalIntelligenceQueueSnapshot();
    assert.equal(snap.depth, 1);
    assert.equal(snap.items[0]?.payload_summary.top_level_key_count, 1);
    assert.deepEqual(snap.items[0]?.payload_summary.top_level_keys_sample, ["images"]);
    const raw = JSON.stringify(snap.items[0]);
    assert.equal(raw.includes("secret.jpg"), false);
    assert.equal(raw.includes("/phi/path"), false);
  });

  it("drain runs handlers in test and captures failures without throwing", async () => {
    registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      throw new Error("boom");
    });
    await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    const d = await drainInternalIntelligenceEventQueue({
      env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(d.status, "drained");
    if (d.status === "drained") {
      assert.equal(d.drained, 1);
      assert.equal(d.items[0]?.handler_errors.length, 1);
      assert.equal(d.items[0]?.handler_errors[0], "boom");
    }
  });

  it("drain returns skipped_production in production (handlers not invoked)", async () => {
    await enqueueInternalIntelligenceEvent(sampleEnvelope, {
      env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    let calls = 0;
    registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    const d = await drainInternalIntelligenceEventQueue({
      env: {
        NODE_ENV: "production",
        FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
      },
      nodeEnv: "production",
    });
    assert.deepEqual(d, { status: "skipped_production", drained: 0 });
    assert.equal(calls, 0);
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 1);
  });
});

describe("internalBusObservability (Stage 12)", () => {
  it("maps enqueue/drain outcomes into IntelligenceEventLogRecord-like objects", () => {
    const base = {
      event_name: "hairaudit.audit.completed",
      source: "hairaudit",
      correlation_id: "c1",
      privacy_level: "internal_debug",
      delivery_mode: "internal_only",
      emitted_at: "2026-06-01T12:00:00.000Z",
    };
    const enq = mapEnqueueInternalIntelligenceOutcomeToLogLike({
      envelope: base,
      result: { status: "enqueued", queue_item_id: "x", depth_after: 1 },
      warnings: [{ code: "w", message: "m" }],
      created_at: "2026-06-01T12:00:01.000Z",
    });
    assert.equal(enq.event_name, "hairaudit.audit.completed");
    assert.equal(enq.source, "hairaudit");
    assert.equal(enq.correlation_id, "c1");
    assert.equal(enq.privacy_level, "internal_debug");
    assert.equal(enq.delivery_mode, "internal_only");
    assert.equal(enq.status, "enqueued");
    assert.equal(enq.warnings?.length, 1);
    assert.equal(enq.occurred_at, "2026-06-01T12:00:00.000Z");
    assert.equal(enq.created_at, "2026-06-01T12:00:01.000Z");

    const dr = mapDrainInternalIntelligenceOutcomeToLogLike({
      envelope: base,
      result: {
        status: "drained",
        drained: 1,
        items: [
          { queue_item_id: "x", event_name: "hairaudit.audit.completed", handler_errors: ["e1"] },
        ],
      },
      created_at: "2026-06-01T12:00:02.000Z",
    });
    assert.equal(dr.status, "error");
    assert.equal(dr.error_message, "e1");
    assert.equal(dr.created_at, "2026-06-01T12:00:02.000Z");

    const skip = mapEnqueueInternalIntelligenceOutcomeToLogLike({
      envelope: base,
      result: { status: "skipped_disabled" },
    });
    assert.equal(skip.status, "skipped_disabled");

    const ok = mapDrainInternalIntelligenceOutcomeToLogLike({
      envelope: base,
      result: {
        status: "drained",
        drained: 1,
        items: [
          { queue_item_id: "x", event_name: "hairaudit.audit.completed", handler_errors: [] },
        ],
      },
    });
    assert.equal(ok.status, "processed");
  });
});

describe("Stage 11 shadow + Stage 12 queue integration", () => {
  beforeEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
  });

  afterEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
  });

  const imagesEnvelope = {
    tenant_id: "t1",
    event_type: "hairaudit.images.uploaded" as const,
    source_system: "hairaudit" as const,
    source_event_id: "img-evt-1",
    occurred_at: "2026-06-01T12:00:00.000Z",
    identifiers: { source_case_id: "case-1" },
    payload: {
      images: [
        {
          type: "scalp",
          filename: "a.jpg",
          storage_path: "/p/a.jpg",
        },
      ],
    },
  };

  it("uses enqueue when queue flag is 1; direct emit when queue disabled", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });

    await maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(imagesEnvelope, {
      env: {
        FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1",
        FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1",
      },
      nodeEnv: "test",
    });
    assert.equal(calls, 0);
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 1);

    await drainInternalIntelligenceEventQueue({
      env: { FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(calls, 1);

    __resetInternalIntelligenceEventQueueForTests();
    calls = 0;

    await maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(imagesEnvelope, {
      env: {
        FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1",
      },
      nodeEnv: "test",
    });
    assert.equal(calls, 1);
    assert.equal(getInternalIntelligenceQueueSnapshot().depth, 0);

    stop();
  });

  it("shadow envelope builder is unchanged for queue path (parse still ok)", () => {
    const shadow = buildShadowHairAuditAuditCompletedIntelligenceEnvelope(imagesEnvelope);
    assert.equal(shadow.event_name, "hairaudit.audit.completed");
  });
});
