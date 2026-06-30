import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { crmCreateLeadBodySchema } from "./crmApiSchemas";
import {
  leadSourceDuplicateErrorMessage,
  leadSourceInsertRaceErrorMessage,
  normaliseOptionalLeadSource,
} from "./leadSourceMappingPolicy";

const SAMPLE_PERSON = "11111111-1111-4111-8111-111111111111";

describe("Stage 2G — lead source mapping policy (pure)", () => {
  it("normaliseOptionalLeadSource returns null when both blank", () => {
    assert.equal(normaliseOptionalLeadSource(null, undefined), null);
    assert.equal(normaliseOptionalLeadSource("  ", " \t"), null);
  });

  it("normaliseOptionalLeadSource throws when only one side is set", () => {
    assert.throws(() => normaliseOptionalLeadSource("hubspot", ""), /both/);
    assert.throws(() => normaliseOptionalLeadSource("", "123"), /both/);
  });

  it("normaliseOptionalLeadSource returns trimmed pair", () => {
    const r = normaliseOptionalLeadSource("  hubspot ", "  deal-1 ");
    assert.deepEqual(r, { source_system: "hubspot", source_lead_id: "deal-1" });
  });

  it("duplicate and race messages are readable", () => {
    const ref = { source_system: "x", source_lead_id: "y" };
    assert.match(
      leadSourceDuplicateErrorMessage(ref, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"),
      /aaaaaaaa/
    );
    assert.match(leadSourceInsertRaceErrorMessage(ref), /another lead/i);
  });
});

describe("Stage 2G — create lead Zod schema", () => {
  it("requires summary / title", () => {
    const bad = crmCreateLeadBodySchema.safeParse({
      personId: SAMPLE_PERSON,
    });
    assert.equal(bad.success, false);
    const ok = crmCreateLeadBodySchema.safeParse({
      summary: "New consult",
      personId: SAMPLE_PERSON,
    });
    assert.ok(ok.success);
  });

  it("accepts person_id path with summary", () => {
    const ok = crmCreateLeadBodySchema.safeParse({
      summary: "x",
      personId: SAMPLE_PERSON,
      sourceSystem: null,
      sourceLeadId: null,
    });
    assert.ok(ok.success);
  });

  it("accepts create/resolve person path with summary", () => {
    const ok = crmCreateLeadBodySchema.safeParse({
      summary: "Inbound call",
      person: { email: "a@b.co", display_name: "Alex" },
    });
    assert.ok(ok.success);
  });

  it("rejects partial external source lead pair", () => {
    const bad = crmCreateLeadBodySchema.safeParse({
      summary: "x",
      personId: SAMPLE_PERSON,
      sourceSystem: "hubspot",
    });
    assert.equal(bad.success, false);
  });

  it("accepts paired external source ids with person path", () => {
    const ok = crmCreateLeadBodySchema.safeParse({
      summary: "x",
      personId: SAMPLE_PERSON,
      sourceSystem: "hubspot",
      sourceLeadId: "deal-1",
    });
    assert.ok(ok.success);
  });
});
