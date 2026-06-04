import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertDefaultPipelineStageOrderingInvariant,
  buildDefaultPipelineStageInsertRows,
  defaultHairRestorationPipelineDefinitions,
  sortPipelineStagesByOrder,
} from "./pipelineSeedPayload";
import { stageRowMatchesOrgClinicScope } from "./scope";
import {
  assertNonEmptyUuid,
  truncateCrmBodyPreview,
  validateCrmMessagePreviewInput,
} from "./validation";

describe("CRM pipeline defaults", () => {
  it("has strictly increasing sort_order and one entry stage", () => {
    assertDefaultPipelineStageOrderingInvariant();
    const defs = defaultHairRestorationPipelineDefinitions();
    assert.equal(defs.filter((d) => d.is_entry).length, 1);
    assert.equal(defs.find((d) => d.is_entry)?.slug, "new");
  });

  it("buildDefaultPipelineStageInsertRows preserves order and scope", () => {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const orgId = "22222222-2222-4222-8222-222222222222";
    const rows = buildDefaultPipelineStageInsertRows({
      tenantId,
      organisationId: orgId,
      clinicId: null,
    });
    assert.equal(rows.length, defaultHairRestorationPipelineDefinitions().length);
    assert.ok(rows.every((r) => r.tenant_id === tenantId && r.organisation_id === orgId && r.clinic_id === null));
    const sorted = sortPipelineStagesByOrder(rows);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(sorted[i].sort_order > sorted[i - 1].sort_order);
    }
  });
});

describe("CRM validation", () => {
  it("assertNonEmptyUuid accepts RFC-like lowercase UUID", () => {
    const id = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    assert.equal(assertNonEmptyUuid(id, "x"), id);
  });

  it("assertNonEmptyUuid rejects garbage", () => {
    assert.throws(() => assertNonEmptyUuid("not-a-uuid", "id"), /UUID/);
  });

  it("validateCrmMessagePreviewInput rejects full-body keys", () => {
    assert.throws(
      () =>
        validateCrmMessagePreviewInput({
          channel: "email",
          direction: "inbound",
          body: "secret full text",
        }),
      /full-body/
    );
  });

  it("validateCrmMessagePreviewInput accepts preview", () => {
    const v = validateCrmMessagePreviewInput({
      channel: "email",
      direction: "outbound",
      body_preview: "Hello…",
    });
    assert.equal(v.channel, "email");
    assert.equal(v.direction, "outbound");
  });

  it("truncateCrmBodyPreview caps length", () => {
    const long = "x".repeat(600);
    assert.equal(truncateCrmBodyPreview(long, 512).length, 512);
  });
});

describe("CRM scope matching", () => {
  it("stageRowMatchesOrgClinicScope uses IS NOT DISTINCT FROM semantics", () => {
    assert.equal(
      stageRowMatchesOrgClinicScope(
        { organisation_id: null, clinic_id: null },
        { organisationId: null, clinicId: null }
      ),
      true
    );
    assert.equal(
      stageRowMatchesOrgClinicScope(
        { organisation_id: "a", clinic_id: null },
        { organisationId: null, clinicId: null }
      ),
      false
    );
  });
});
