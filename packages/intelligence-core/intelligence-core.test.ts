import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  AUDIT_SCORE_SNAPSHOT_V1_VERSION,
  CLINIC_READINESS_SIGNAL_V1_VERSION,
  COMPETENCY_EVIDENCE_V1_VERSION,
  EVIDENCE_MANIFEST_V1_VERSION,
  HLI_LONGEVITY_SIGNAL_V1_VERSION,
  OUTCOME_SIGNAL_V1_VERSION,
  PROFESSIONAL_GRAPH_SNAPSHOT_V1_VERSION,
} from "./contracts/index";
import { parseIntelligenceEventEnvelope } from "./events/types";
import { buildPseudonymousSubjectId, validatePseudonymousSubjectId } from "./identity/types";
import { defaultIntelligenceExportPolicy } from "./policy/types";

describe("intelligence-core events", () => {
  it("parses a valid envelope", () => {
    const r = parseIntelligenceEventEnvelope({
      schema_version: 1,
      emitted_at: new Date().toISOString(),
      source: "hairaudit",
      event_name: "hairaudit.audit.completed",
      delivery_mode: "async_queue",
      privacy_level: "pseudonymous_analytics",
      payload: { ok: true },
    });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.envelope.event_name, "hairaudit.audit.completed");
    }
  });

  it("parses HLI source", () => {
    const r = parseIntelligenceEventEnvelope({
      schema_version: 1,
      emitted_at: new Date().toISOString(),
      source: "hli",
      event_name: "hli.intake.submitted",
      delivery_mode: "internal_only",
      privacy_level: "operational_clinical",
      payload: {},
    });
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.envelope.source, "hli");
  });

  it("rejects invalid envelope", () => {
    const r = parseIntelligenceEventEnvelope({
      schema_version: 0,
      emitted_at: "not-a-date",
      source: "unknown",
      event_name: "nope",
      delivery_mode: "async_queue",
      privacy_level: "pseudonymous_analytics",
      payload: {},
    });
    assert.equal(r.ok, false);
  });
});

describe("intelligence-core identity", () => {
  it("buildPseudonymousSubjectId produces validatePseudonymousSubjectId shape", () => {
    const id = buildPseudonymousSubjectId("org_evolved", "staff:42");
    assert.ok(validatePseudonymousSubjectId(id));
  });
});

describe("intelligence-core policy", () => {
  it("defaultIntelligenceExportPolicy is disabled", () => {
    const p = defaultIntelligenceExportPolicy();
    assert.equal(p.exportMode, "disabled");
    assert.equal(p.canExportCompetencyData, false);
    assert.equal(p.canExportAuditData, false);
  });
});

describe("intelligence-core contracts", () => {
  it("exposes V1 version constants", () => {
    assert.equal(COMPETENCY_EVIDENCE_V1_VERSION, 1);
    assert.equal(PROFESSIONAL_GRAPH_SNAPSHOT_V1_VERSION, 1);
    assert.equal(AUDIT_SCORE_SNAPSHOT_V1_VERSION, 1);
    assert.equal(EVIDENCE_MANIFEST_V1_VERSION, 1);
    assert.equal(CLINIC_READINESS_SIGNAL_V1_VERSION, 1);
    assert.equal(OUTCOME_SIGNAL_V1_VERSION, 1);
    assert.equal(HLI_LONGEVITY_SIGNAL_V1_VERSION, 1);
  });
});
