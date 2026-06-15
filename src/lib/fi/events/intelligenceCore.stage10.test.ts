import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { INTELLIGENCE_EVENT_NAMES, parseIntelligenceEventEnvelope } from "@follicle/intelligence-core";
import { fiEventTypeSchema, FI_INGEST_CROSS_SYSTEM_EVENT_TYPES } from "@/lib/fi/events/schema";
import { FI_EVENT_TYPES, FI_VOCABULARY_OUTSIDE_INTELLIGENCE_CORE } from "@/src/lib/fi/vocabulary";
import {
  toIntelligenceEventEnvelope,
  fromIntelligenceEventEnvelope,
  mapFiSourceSystemToIntelligenceSource,
  mapIntelligenceSourceToFiSourceSystem,
  ADAPTER_PAYLOAD_MIRROR_KEY,
} from "./intelligenceCoreAdapter";
import {
  emitInternalIntelligenceEvent,
  registerInternalIntelligenceHandler,
  __resetInternalIntelligenceHandlersForTests,
} from "./internalBus";
import {
  canBuildGraphPayload,
  canEmitCrossSystemEvent,
  canExportClinicalPayload,
  getIntelligenceExportPolicy,
  __resetIntelligencePolicyCacheForTests,
} from "./intelligencePolicy";
import type { FiEventRow } from "@/lib/fi/events/idempotency";
import { fiEventRowToIntelligenceLogRecord } from "./intelligenceObservability";
describe("intelligenceCoreAdapter", () => {
  it("maps FI → intelligence envelope and back (HLI)", () => {
    const fi = {
      tenant_id: "t1",
      event_type: "hli.intake.submitted" as const,
      source_system: "hli" as const,
      source_event_id: "ext-1",
      occurred_at: "2026-01-01T00:00:00.000Z",
      identifiers: { source_case_id: "c1" },
      payload: { intake: { x: 1 } },
    };
    const { envelope, warnings } = toIntelligenceEventEnvelope(fi);
    assert.equal(envelope.source, "hli");
    assert.equal(envelope.event_name, "hli.intake.submitted");
    assert.equal(envelope.correlation_id, "c1");
    assert.ok(ADAPTER_PAYLOAD_MIRROR_KEY in envelope.payload);

    const back = fromIntelligenceEventEnvelope(envelope);
    assert.equal(back.fiCompatible.tenant_id, "t1");
    assert.equal(back.fiCompatible.source_system, "hli");
    assert.equal(back.fiCompatible.event_type, "hli.intake.submitted");
    assert.equal(back.fiCompatible.source_event_id, "ext-1");
    assert.equal(!(ADAPTER_PAYLOAD_MIRROR_KEY in back.fiCompatible.payload), true);
    assert.equal(warnings.length + back.warnings.length > 0, false);
  });

  it("preserves clinic legacy source on FI side while canonical source is fi_os", () => {
    const fi = {
      tenant_id: "t1",
      event_type: "clinic.ai.usage" as const,
      source_system: "clinic" as const,
      source_event_id: "usage-1",
      payload: { usage: { tokens: 1 } },
    };
    const { envelope } = toIntelligenceEventEnvelope(fi);
    assert.equal(envelope.source, "fi_os");
    const back = fromIntelligenceEventEnvelope(envelope);
    assert.equal(back.fiCompatible.source_system, "clinic");
  });

  it("mapFiSourceSystemToIntelligenceSource maps clinic → fi_os", () => {
    const w: { code: string; message: string }[] = [];
    assert.equal(mapFiSourceSystemToIntelligenceSource("clinic", w), "fi_os");
    assert.equal(w.length, 0);
  });

  it("mapIntelligenceSourceToFiSourceSystem maps fi_os → clinic", () => {
    const w: { code: string; message: string }[] = [];
    assert.equal(mapIntelligenceSourceToFiSourceSystem("fi_os", w), "clinic");
    assert.equal(w.length, 0);
  });
});

describe("cross-system event drift guard", () => {
  it("intelligence-core includes all FI ingest cross-system event names", () => {
    const allow = new Set<string>(INTELLIGENCE_EVENT_NAMES);
    for (const name of FI_INGEST_CROSS_SYSTEM_EVENT_TYPES) {
      assert.ok(
        allow.has(name),
        `Missing shared allow-list entry for FI ingest cross-system event: ${name}`
      );
    }
  });

  it("every fiEventTypeSchema name is either cross-system covered or explicitly local-only", () => {
    const cross = new Set<string>(FI_INGEST_CROSS_SYSTEM_EVENT_TYPES);
    const localOnly = fiEventTypeSchema.filter((n) => !cross.has(n));
    assert.deepEqual(localOnly, ["clinic.ai.usage"]);
  });

  it("vocabulary events are either in intelligence-core or documented in FI_VOCABULARY_OUTSIDE_INTELLIGENCE_CORE", () => {
    const allow = new Set<string>(INTELLIGENCE_EVENT_NAMES);
    const gapKeys = new Set(Object.keys(FI_VOCABULARY_OUTSIDE_INTELLIGENCE_CORE));
    for (const name of FI_EVENT_TYPES) {
      const ok = allow.has(name) || gapKeys.has(name);
      assert.ok(
        ok,
        `FI_EVENT_TYPES entry "${name}" is neither in intelligence-core nor in FI_VOCABULARY_OUTSIDE_INTELLIGENCE_CORE`
      );
    }
  });

  it("fails when a hypothetical new cross-system name would be missing from intelligence-core", () => {
    const allow = new Set<string>(INTELLIGENCE_EVENT_NAMES);
    const hypotheticalNewFiCrossSystem = "hairaudit.audit.started";
    assert.equal(allow.has(hypotheticalNewFiCrossSystem), false);
    const simulated = [...FI_INGEST_CROSS_SYSTEM_EVENT_TYPES, hypotheticalNewFiCrossSystem];
    const missing = simulated.filter((n) => !allow.has(n));
    assert.deepEqual(missing, [hypotheticalNewFiCrossSystem]);
  });
});

describe("intelligenceObservability adapter", () => {
  it("maps fi_events row fields into IntelligenceEventLogRecord (source-model only)", () => {
    const row = {
      id: "evt_1",
      tenant_id: "tenant_a",
      event_type: "hairaudit.case.submitted",
      source_system: "hairaudit",
      source_event_id: "src_1",
      occurred_at: "2026-06-01T12:00:00.000Z",
      payload_json: {},
      status: "processed",
      error_text: null,
      created_at: "2026-06-01T12:00:01.000Z",
      updated_at: "2026-06-01T12:00:02.000Z",
    } satisfies FiEventRow;

    const rec = fiEventRowToIntelligenceLogRecord(row);
    assert.equal(rec.id, "evt_1");
    assert.equal(rec.source, "hairaudit");
    assert.equal(rec.event_name, "hairaudit.case.submitted");
    assert.equal(rec.processing_status, "processed");
  });
});

describe("parseIntelligenceEventEnvelope + adapter", () => {
  it("accepts adapter-produced envelope after stripping internal mirror key", () => {
    const fi = {
      tenant_id: "t1",
      event_type: "hli.document.uploaded" as const,
      source_system: "hli" as const,
      source_event_id: "doc-1",
      payload: {
        document: {
          kind: "blood_pdf" as const,
          filename: "f.pdf",
          storage_path: "/p",
        },
      },
    };
    const { envelope } = toIntelligenceEventEnvelope(fi);
    const payload = { ...envelope.payload } as Record<string, unknown>;
    delete payload[ADAPTER_PAYLOAD_MIRROR_KEY];
    const r = parseIntelligenceEventEnvelope({ ...envelope, payload });
    assert.equal(r.ok, true);
  });
});

describe("intelligencePolicy adapter", () => {
  beforeEach(() => {
    __resetIntelligencePolicyCacheForTests();
    delete process.env.FI_INTELLIGENCE_POLICY_DEV;
  });

  afterEach(() => {
    __resetIntelligencePolicyCacheForTests();
    delete process.env.FI_INTELLIGENCE_POLICY_DEV;
  });

  it("defaults export gates off", () => {
    const p = getIntelligenceExportPolicy();
    assert.equal(p.exportMode, "disabled");
    assert.equal(canEmitCrossSystemEvent(), false);
    assert.equal(canExportClinicalPayload(), false);
    assert.equal(canBuildGraphPayload(), false);
  });
});

describe("internalIntelligenceBus", () => {
  beforeEach(() => {
    __resetInternalIntelligenceHandlersForTests();
  });

  afterEach(() => {
    __resetInternalIntelligenceHandlersForTests();
  });

  it("does not invoke handlers in noop mode (production-style)", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    await emitInternalIntelligenceEvent(
      {
        schema_version: 1,
        emitted_at: new Date().toISOString(),
        source: "hairaudit",
        event_name: "hairaudit.audit.completed",
        delivery_mode: "internal_only",
        privacy_level: "internal_debug",
        payload: {},
      },
      { mode: "noop" }
    );
    assert.equal(calls, 0);
    stop();
  });

  it("invokes handlers in inline_dev_only when explicitly requested", async () => {
    let calls = 0;
    const stop = registerInternalIntelligenceHandler("hairaudit.audit.completed", () => {
      calls += 1;
    });
    await emitInternalIntelligenceEvent(
      {
        schema_version: 1,
        emitted_at: new Date().toISOString(),
        source: "hairaudit",
        event_name: "hairaudit.audit.completed",
        delivery_mode: "internal_only",
        privacy_level: "internal_debug",
        payload: {},
      },
      { mode: "inline_dev_only" }
    );
    assert.equal(calls, 1);
    stop();
  });
});
