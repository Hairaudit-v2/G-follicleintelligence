import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { patientClinicalDetailsPatchBodySchema } from "./clinicalDetailsApiSchemas";
import { clinicalDetailsChangedKeys } from "./clinicalDetailsChangedFields";
import {
  assertClinicalTextWithinBounds,
  assertJsonObjectField,
  canCreateEmptyClinicalDetailsRow,
  clinicalDetailsPatientRowMatchesTenant,
  CLINICAL_DETAILS_TEXT_MAX,
  normalizeEditableClinicalDetailsPayload,
} from "./clinicalDetailsPolicy";
import { mergeClinicalDetailsPatch } from "./clinicalDetailsMerge";

describe("Stage 4B — patient clinical details foundation (pure)", () => {
  it("text field max length enforcement", () => {
    assert.doesNotThrow(() =>
      assertClinicalTextWithinBounds("primary_hair_concern", "x".repeat(CLINICAL_DETAILS_TEXT_MAX.primary_hair_concern))
    );
    assert.throws(() =>
      assertClinicalTextWithinBounds(
        "primary_hair_concern",
        "x".repeat(CLINICAL_DETAILS_TEXT_MAX.primary_hair_concern + 1)
      )
    );
  });

  it("metadata and clinical_flags must be JSON objects", () => {
    assert.deepEqual(assertJsonObjectField("m", {}), {});
    assert.throws(() => assertJsonObjectField("m", []));
    assert.throws(() => assertJsonObjectField("m", "x"));
  });

  it("normalizeEditableClinicalDetailsPayload strips unknown keys and validates", () => {
    const n = normalizeEditableClinicalDetailsPayload({
      primary_hair_concern: "  hi  ",
      bogus: "ignored",
      clinical_flags: { a: 1 },
      metadata: {},
    });
    assert.equal(n.primary_hair_concern, "hi");
    assert.deepEqual(n.clinical_flags, { a: 1 });
    assert.deepEqual(n.metadata, {});
    assert.equal((n as Record<string, unknown>).bogus, undefined);
  });

  it("normalizeEditableClinicalDetailsPayload rejects invalid norwood_scale", () => {
    assert.throws(() =>
      normalizeEditableClinicalDetailsPayload({
        norwood_scale: "bogus",
      })
    );
  });

  it("patientClinicalDetailsPatchBodySchema accepts scale patch", () => {
    const ok = patientClinicalDetailsPatchBodySchema.safeParse({
      norwood_scale: "IV",
      ludwig_scale: null,
      hairline_pattern: "receding",
    });
    assert.equal(ok.success, true);
  });

  it("clinicalDetailsChangedKeys lists only changed keys", () => {
    const a = normalizeEditableClinicalDetailsPayload({});
    const b = normalizeEditableClinicalDetailsPayload({
      primary_hair_concern: "x",
      clinical_flags: { k: true },
    });
    assert.deepEqual(clinicalDetailsChangedKeys(a, b), ["primary_hair_concern", "clinical_flags"]);
  });

  it("patientClinicalDetailsPatchBodySchema rejects empty patch", () => {
    const bad = patientClinicalDetailsPatchBodySchema.safeParse({ adminKey: "x" });
    assert.equal(bad.success, false);
    const ok = patientClinicalDetailsPatchBodySchema.safeParse({ primary_hair_concern: "c" });
    assert.equal(ok.success, true);
  });

  it("patientClinicalDetailsPatchBodySchema strict rejects unknown keys", () => {
    const bad = patientClinicalDetailsPatchBodySchema.safeParse({ primary_hair_concern: "a", extra: 1 });
    assert.equal(bad.success, false);
  });

  it("empty row creation policy allows all-empty payload", () => {
    const empty = normalizeEditableClinicalDetailsPayload({});
    assert.equal(canCreateEmptyClinicalDetailsRow(empty), true);
    const withText = normalizeEditableClinicalDetailsPayload({ allergies: "nuts" });
    assert.equal(canCreateEmptyClinicalDetailsRow(withText), false);
  });

  it("clinicalDetailsPatientRowMatchesTenant", () => {
    assert.equal(
      clinicalDetailsPatientRowMatchesTenant("t1", "p1", { tenant_id: "t1", id: "p1" }),
      true
    );
    assert.equal(
      clinicalDetailsPatientRowMatchesTenant("t1", "p1", { tenant_id: "t2", id: "p1" }),
      false
    );
  });

  it("mergeClinicalDetailsPatch does not overwrite with undefined (sparse patch)", () => {
    const base = normalizeEditableClinicalDetailsPayload({
      primary_hair_concern: "keep",
      allergies: "x",
    });
    const patch = patientClinicalDetailsPatchBodySchema.parse({
      allergies: null,
    });
    const merged = mergeClinicalDetailsPatch(base, patch);
    assert.equal(merged.primary_hair_concern, "keep");
    assert.equal(merged.allergies, null);
  });
});
