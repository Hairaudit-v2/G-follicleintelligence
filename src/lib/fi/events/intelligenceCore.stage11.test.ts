import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { parseIntelligenceEventEnvelope } from "@follicle/intelligence-core";
import {
  buildShadowHairAuditAuditCompletedIntelligenceEnvelope,
  maybeEmitShadowHairAuditAuditCompletedFromImagesIngest,
} from "./shadowHairAuditAuditCompletedBus";
import { isInternalIntelligenceBusShadowEnabled } from "./internalBusEnv";
import {
  emitInternalIntelligenceEvent,
  registerInternalIntelligenceHandler,
  __resetInternalIntelligenceHandlersForTests,
} from "./internalBus";
import { __resetInternalIntelligenceEventQueueForTests } from "./internalBusQueue";

describe("internalBusEnv (Stage 11 shadow gate)", () => {
  it("is disabled by default (unset flag)", () => {
    assert.equal(
      isInternalIntelligenceBusShadowEnabled({
        env: { NODE_ENV: "test" },
        nodeEnv: "test",
      }),
      false
    );
  });

  it("is false in production even when flag is 1", () => {
    assert.equal(
      isInternalIntelligenceBusShadowEnabled({
        env: {
          NODE_ENV: "production",
          FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1",
        },
        nodeEnv: "production",
      }),
      false
    );
  });

  it("is true in non-production when flag is 1", () => {
    assert.equal(
      isInternalIntelligenceBusShadowEnabled({
        env: { FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1" },
        nodeEnv: "test",
      }),
      true
    );
  });

  it("is false when flag is not exactly 1", () => {
    assert.equal(
      isInternalIntelligenceBusShadowEnabled({
        env: { FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "true" },
        nodeEnv: "development",
      }),
      false
    );
  });
});

describe("shadow hairaudit.audit.completed bus (Stage 11)", () => {
  beforeEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
    delete process.env.FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED;
    delete process.env.FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED;
  });

  afterEach(() => {
    __resetInternalIntelligenceHandlersForTests();
    __resetInternalIntelligenceEventQueueForTests();
    delete process.env.FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED;
    delete process.env.FI_INTELLIGENCE_INTERNAL_BUS_QUEUE_ENABLED;
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

  it("buildShadowHairAuditAuditCompletedIntelligenceEnvelope parses via intelligence-core", () => {
    const shadow = buildShadowHairAuditAuditCompletedIntelligenceEnvelope(imagesEnvelope);
    assert.equal(shadow.event_name, "hairaudit.audit.completed");
    const payload = { ...shadow.payload } as Record<string, unknown>;
    const mirrorKey = "__fiAdapterRoundTrip";
    assert.ok(mirrorKey in payload);
    delete payload[mirrorKey];
    const r = parseIntelligenceEventEnvelope({ ...shadow, payload });
    assert.equal(r.ok, true);
  });

  it("shadow emit invokes bus handler when flag enabled (non-production)", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    await maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(imagesEnvelope, {
      env: { FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(calls, 1);
    stop();
  });

  it("shadow emit does not run for non-images HairAudit envelopes", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    const caseEnvelope = {
      tenant_id: "t1",
      event_type: "hairaudit.case.submitted" as const,
      source_system: "hairaudit" as const,
      source_event_id: "case-1",
      payload: { case: { primary_concern: "x" } },
    };
    await maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(caseEnvelope, {
      env: { FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1" },
      nodeEnv: "test",
    });
    assert.equal(calls, 0);
    stop();
  });

  it("bus handler error does not propagate from maybeEmit", async () => {
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      throw new Error("handler boom");
    });
    await assert.doesNotReject(() =>
      maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(imagesEnvelope, {
        env: { FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1" },
        nodeEnv: "test",
      })
    );
    stop();
  });

  it("production nodeEnv skips shadow emit (zero handler calls)", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    await maybeEmitShadowHairAuditAuditCompletedFromImagesIngest(imagesEnvelope, {
      env: {
        NODE_ENV: "production",
        FI_INTELLIGENCE_INTERNAL_BUS_SHADOW_ENABLED: "1",
      },
      nodeEnv: "production",
    });
    assert.equal(calls, 0);
    stop();
  });

  it("noop mode does not execute handlers (explicit control)", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    const shadow = buildShadowHairAuditAuditCompletedIntelligenceEnvelope(imagesEnvelope);
    await emitInternalIntelligenceEvent(shadow, { mode: "noop" });
    assert.equal(calls, 0);
    stop();
  });
});
