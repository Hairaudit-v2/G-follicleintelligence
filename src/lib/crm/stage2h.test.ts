import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crmUpdateLeadDetailsBodySchema } from "./crmApiSchemas";
import {
  collectChangedLeadDetailKeys,
  leadDetailSnapshotsEqual,
  parseCrmLeadMetadataJsonInput,
  type LeadDetailComparableSnapshot,
} from "./crmLeadDetailsPolicy";

const SAMPLE_UUID = "11111111-1111-4111-8111-111111111111";

function snap(p: Partial<LeadDetailComparableSnapshot>): LeadDetailComparableSnapshot {
  return {
    summary: "",
    status: "open",
    priority: null,
    primary_owner_user_id: null,
    organisation_id: null,
    clinic_id: null,
    metadata: {},
    ...p,
  };
}

describe("Stage 2H — lead details policy (pure)", () => {
  it("parseCrmLeadMetadataJsonInput rejects invalid JSON", () => {
    assert.throws(() => parseCrmLeadMetadataJsonInput("{"), /valid JSON/);
  });

  it("parseCrmLeadMetadataJsonInput rejects non-object", () => {
    assert.throws(() => parseCrmLeadMetadataJsonInput("[]"), /object/);
    assert.throws(() => parseCrmLeadMetadataJsonInput('"x"'), /object/);
  });

  it("parseCrmLeadMetadataJsonInput accepts empty as {}", () => {
    assert.deepEqual(parseCrmLeadMetadataJsonInput("   "), {});
  });

  it("collectChangedLeadDetailKeys lists only changed snake_case fields", () => {
    const before = snap({ summary: "A", status: "open", metadata: { a: 1 } });
    const after = snap({ summary: "B", status: "open", metadata: { a: 1 } });
    assert.deepEqual(collectChangedLeadDetailKeys(before, after), ["summary"]);
  });

  it("collectChangedLeadDetailKeys detects metadata key reorder as unchanged", () => {
    const before = snap({ metadata: { b: 2, a: 1 } });
    const after = snap({ metadata: { a: 1, b: 2 } });
    assert.deepEqual(collectChangedLeadDetailKeys(before, after), []);
    assert.equal(leadDetailSnapshotsEqual(before, after), true);
  });

  it("collectChangedLeadDetailKeys detects metadata value change", () => {
    const before = snap({ metadata: { a: 1 } });
    const after = snap({ metadata: { a: 2 } });
    assert.deepEqual(collectChangedLeadDetailKeys(before, after), ["metadata"]);
  });
});

describe("Stage 2H — update lead details Zod schema", () => {
  const minimal = {
    summary: "Title",
    status: "open",
    priority: null,
    primaryOwnerUserId: null,
    organisationId: null,
    clinicId: null,
  };

  it("requires summary", () => {
    const bad = crmUpdateLeadDetailsBodySchema.safeParse({ ...minimal, summary: "" });
    assert.equal(bad.success, false);
  });

  it("rejects stage fields (strict)", () => {
    const bad = crmUpdateLeadDetailsBodySchema.safeParse({
      ...minimal,
      currentStageId: SAMPLE_UUID,
    });
    assert.equal(bad.success, false);
  });

  it("rejects current_stage_id snake_case", () => {
    const bad = crmUpdateLeadDetailsBodySchema.safeParse({
      ...minimal,
      current_stage_id: SAMPLE_UUID,
    });
    assert.equal(bad.success, false);
  });

  it("accepts valid body", () => {
    const ok = crmUpdateLeadDetailsBodySchema.safeParse({
      ...minimal,
      metadata: { x: 1 },
    });
    assert.ok(ok.success);
  });
});
