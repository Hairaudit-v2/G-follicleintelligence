import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";

import {
  buildModuleCoverage,
  deriveAnalyticsConfidence,
  MODULE_COVERAGE_ACTIVE_THRESHOLD,
  resolveModuleCoverageStatus,
} from "@/src/lib/analytics-os/analyticsExecutiveEngine";
import {
  calculateDataCompletenessScore,
  calculatePatientJourneyScore,
  type ExecutiveScoringInput,
} from "@/src/lib/analytics-os/analyticsExecutiveScoring";
import { ANALYTICS_PIPELINE_MODULES } from "@/src/lib/analytics-os/analyticsExecutiveTypes";
import {
  publishAnalyticsEvent,
  validateAnalyticsEventInput,
  AnalyticsEventValidationError,
} from "@/src/lib/analytics-os/analyticsEventCore";
import type { FiAnalyticsEventRow } from "@/src/lib/analytics-os/analyticsEventCore";
import {
  publishAuditEvent,
  publishImagingEvent,
  publishLeadFlowEvent,
  publishPatientEvent,
} from "@/src/lib/analytics-os/analyticsModulePublishers";
import {
  AUDIT_EVENTS,
  IMAGING_EVENTS,
  isEventTypeAllowedForModule,
  LEADFLOW_EVENTS,
  MODULE_EVENT_TYPES,
  PATIENT_EVENTS,
} from "@/src/lib/analytics-os/analyticsEventTypes";

const TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function event(
  partial: Partial<FiAnalyticsEventRow> & Pick<FiAnalyticsEventRow, "module_name" | "event_type">
): FiAnalyticsEventRow {
  return {
    id: randomUUID(),
    tenant_id: TENANT,
    clinic_id: null,
    entity_id: randomUUID(),
    entity_type: "lead",
    event_value: null,
    event_metadata: {},
    occurred_at: "2026-06-15T10:00:00.000Z",
    created_at: "2026-06-15T10:00:00.000Z",
    ...partial,
  };
}

function createStoreMock() {
  const store: Record<string, unknown>[] = [];
  const client = {
    from(table: string) {
      assert.equal(table, "fi_analytics_events");
      return {
        insert(row: Record<string, unknown>) {
          const full = { ...row, id: randomUUID(), created_at: new Date().toISOString() };
          store.push(full);
          return {
            select() {
              return { single: async () => ({ data: full, error: null }) };
            },
          };
        },
      };
    },
  };
  return { client, store };
}

describe("analyticsPublisherPhaseC event contracts", () => {
  it("validates expanded LeadFlow, Patient, Imaging, and Audit event types", () => {
    assert.ok(LEADFLOW_EVENTS.includes("lead_stage_changed"));
    assert.ok(PATIENT_EVENTS.includes("patient_onboarding_started"));
    assert.ok(IMAGING_EVENTS.includes("imaging_session_created"));
    assert.ok(AUDIT_EVENTS.includes("graft_integrity_scored"));

    assert.doesNotThrow(() =>
      validateAnalyticsEventInput({
        tenantId: TENANT,
        moduleName: "leadflow",
        eventType: "lead_qualified",
      })
    );

    assert.throws(
      () =>
        validateAnalyticsEventInput({
          tenantId: TENANT,
          moduleName: "imaging_os",
          eventType: "lead_created",
        }),
      AnalyticsEventValidationError
    );

    assert.equal(isEventTypeAllowedForModule("audit_os", "audit_started"), true);
    assert.equal(MODULE_EVENT_TYPES.imaging_os.length, IMAGING_EVENTS.length);
  });

  it("keeps legacy PatientOS event aliases valid", () => {
    assert.ok(PATIENT_EVENTS.includes("patient_uploaded_images"));
    assert.ok(PATIENT_EVENTS.includes("followup_completed"));
    assert.doesNotThrow(() =>
      validateAnalyticsEventInput({
        tenantId: TENANT,
        moduleName: "patient_os",
        eventType: "followup_completed",
      })
    );
  });
});

describe("analyticsPublisherPhaseC module publishers", () => {
  it("delegates LeadFlow publisher to leadflow module", async () => {
    const { client, store } = createStoreMock();
    await publishLeadFlowEvent(
      {
        tenantId: TENANT,
        eventType: "lead_created",
        entityId: randomUUID(),
        entityType: "lead",
        eventMetadata: { source: "google_ads", score: 87 },
      },
      { supabaseClientForTests: client as never }
    );
    assert.equal(store.length, 1);
    assert.equal(store[0]?.module_name, "leadflow");
    assert.equal(store[0]?.event_type, "lead_created");
  });

  it("delegates PatientOS publisher to patient_os module", async () => {
    const { client, store } = createStoreMock();
    await publishPatientEvent(
      {
        tenantId: TENANT,
        eventType: "patient_images_uploaded",
        entityId: randomUUID(),
        entityType: "image",
        eventMetadata: { upload_count: 5 },
      },
      { supabaseClientForTests: client as never }
    );
    assert.equal(store[0]?.module_name, "patient_os");
    assert.equal(store[0]?.event_type, "patient_images_uploaded");
  });

  it("delegates ImagingOS publisher to imaging_os module", async () => {
    const { client, store } = createStoreMock();
    await publishImagingEvent(
      {
        tenantId: TENANT,
        eventType: "ai_imaging_completed",
        entityId: randomUUID(),
        entityType: "image",
        eventMetadata: { mode: "dry_run" },
      },
      { supabaseClientForTests: client as never }
    );
    assert.equal(store[0]?.module_name, "imaging_os");
    assert.equal(store[0]?.event_type, "ai_imaging_completed");
  });

  it("delegates AuditOS publisher to audit_os module", async () => {
    const { client, store } = createStoreMock();
    await publishAuditEvent(
      {
        tenantId: TENANT,
        eventType: "graft_integrity_scored",
        entityId: randomUUID(),
        entityType: "case",
        eventValue: 91,
        eventMetadata: { graft_integrity_score: 91, concern_band: "moderate" },
      },
      { supabaseClientForTests: client as never }
    );
    assert.equal(store[0]?.module_name, "audit_os");
    assert.equal(store[0]?.event_type, "graft_integrity_scored");
  });

  it("publishAnalyticsEvent swallows publisher failures without throwing", async () => {
    const result = await publishAnalyticsEvent({
      tenantId: TENANT,
      moduleName: "imaging_os",
      eventType: "invalid_event_type",
    });
    assert.equal(result, null);
  });
});

describe("analyticsPublisherPhaseC coverage engine", () => {
  it("applies active/limited/waiting thresholds", () => {
    assert.equal(resolveModuleCoverageStatus(0), "waiting");
    assert.equal(resolveModuleCoverageStatus(8), "limited");
    assert.equal(resolveModuleCoverageStatus(MODULE_COVERAGE_ACTIVE_THRESHOLD), "limited");
    assert.equal(resolveModuleCoverageStatus(MODULE_COVERAGE_ACTIVE_THRESHOLD + 1), "active");
  });

  it("builds module coverage rows with event counts", () => {
    const events = [
      ...Array.from({ length: 25 }, () =>
        event({ module_name: "leadflow", event_type: "lead_created" })
      ),
      ...Array.from({ length: 8 }, () =>
        event({ module_name: "patient_os", event_type: "patient_images_uploaded" })
      ),
    ];

    const coverage = buildModuleCoverage(events);
    const leadflow = coverage.find((row) => row.moduleName === "leadflow");
    const patient = coverage.find((row) => row.moduleName === "patient_os");
    const imaging = coverage.find((row) => row.moduleName === "imaging_os");

    assert.equal(leadflow?.status, "active");
    assert.equal(leadflow?.eventCount, 25);
    assert.equal(patient?.status, "limited");
    assert.equal(patient?.eventCount, 8);
    assert.equal(imaging?.status, "waiting");
    assert.equal(imaging?.eventCount, 0);
  });

  it("derives analytics confidence from coverage tiers", () => {
    const high = buildModuleCoverage(
      ANALYTICS_PIPELINE_MODULES.flatMap((moduleName) =>
        Array.from({ length: 25 }, () => event({ module_name: moduleName, event_type: "payment_received" }))
      )
    );
    assert.equal(deriveAnalyticsConfidence(high), "high");

    const low = buildModuleCoverage([]);
    assert.equal(deriveAnalyticsConfidence(low), "low");
  });
});

describe("analyticsPublisherPhaseC executive scoring", () => {
  it("scores patient journey from expanded PatientOS events", () => {
    const input: ExecutiveScoringInput = {
      current: {
        eventCount: 4,
        eventValueSum: 0,
        byEventType: new Map([
          ["patient_onboarding_started", { count: 1, valueSum: 0 }],
          ["patient_images_uploaded", { count: 2, valueSum: 0 }],
          ["patient_followup_completed", { count: 1, valueSum: 0 }],
        ]),
        byModule: new Map([["patient_os", { count: 4, valueSum: 0 }]]),
        distinctEntityIds: new Set(["a", "b", "c"]),
      },
      comparison: null,
      activeModuleNames: ["patient_os"],
      expectedModuleCount: 9,
      moduleCoverage: buildModuleCoverage([
        event({ module_name: "patient_os", event_type: "patient_onboarding_started" }),
        event({ module_name: "patient_os", event_type: "patient_images_uploaded" }),
        event({ module_name: "patient_os", event_type: "patient_images_uploaded" }),
        event({ module_name: "patient_os", event_type: "patient_followup_completed" }),
      ]),
    };

    const score = calculatePatientJourneyScore(input);
    assert.ok(score.score >= 55);
    assert.equal(score.limitedSignal, false);
  });

  it("raises data completeness when most modules are actively publishing", () => {
    const sparseCoverage = buildModuleCoverage([
      event({ module_name: "financial_os", event_type: "payment_received" }),
    ]);
    const richEvents = ANALYTICS_PIPELINE_MODULES.filter((m) => m !== "clinic_os").flatMap((moduleName) =>
      Array.from({ length: 25 }, (_, i) =>
        event({
          module_name: moduleName,
          event_type: "payment_received",
          entity_id: `${moduleName}-${i}`,
        })
      )
    );
    const richCoverage = buildModuleCoverage(richEvents);

    const sparse = calculateDataCompletenessScore({
      current: {
        eventCount: 1,
        eventValueSum: 0,
        byEventType: new Map(),
        byModule: new Map(),
        distinctEntityIds: new Set(["x"]),
      },
      comparison: null,
      activeModuleNames: [],
      expectedModuleCount: 9,
      moduleCoverage: sparseCoverage,
    });

    const rich = calculateDataCompletenessScore({
      current: {
        eventCount: richEvents.length,
        eventValueSum: 0,
        byEventType: new Map(),
        byModule: new Map(),
        distinctEntityIds: new Set(richEvents.map((e) => e.entity_id!)),
      },
      comparison: null,
      activeModuleNames: ANALYTICS_PIPELINE_MODULES.filter((m) => m !== "clinic_os"),
      expectedModuleCount: 9,
      moduleCoverage: richCoverage,
    });

    assert.ok(sparse.score <= 45);
    assert.ok(rich.score >= 88);
    assert.equal(sparse.limitedSignal, true);
    assert.equal(rich.limitedSignal, false);
  });
});
