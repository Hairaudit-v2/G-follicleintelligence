import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildGraftTotalMismatchWarning,
  draftsToZoneInputs,
  emptyRecipientZoneDraft,
  normalizeRecipientZoneInput,
  recipientZoneDraftFromRecord,
  sumZoneGraftCounts,
  validateAndBuildStaffRecord,
} from "./patientVisualSummaryRecordCore";

describe("patientVisualSummaryRecordCore", () => {
  it("accepts valid zone record", () => {
    const result = validateAndBuildStaffRecord({
      zones: [
        {
          zone_id: "zone_1",
          graft_count: 400,
          density_range: "45–50 grafts/cm²",
          graft_type_mix: { singles: 100, doubles: 200, triples: 80, multiHair: 20 },
        },
        { zone_id: "zone_2", graft_count: 300 },
      ],
      surgeryGraftTotal: 800,
    });
    assert.equal(result.ok, true);
    assert.equal(result.record.recipient_zones?.length, 2);
    assert.equal(result.record.recipient_zones?.[0].graft_count, 400);
    assert.equal(result.warnings.length, 0);
  });

  it("allows partial zone record", () => {
    const result = validateAndBuildStaffRecord({
      zones: [{ zone_id: "zone_3", graft_count: 150 }],
    });
    assert.equal(result.ok, true);
    assert.equal(result.record.recipient_zones?.length, 1);
    assert.equal(result.record.recipient_zones?.[0].zone_id, "zone_3");
  });

  it("warns when zone totals exceed surgery graft count", () => {
    const result = validateAndBuildStaffRecord({
      zones: [
        { zone_id: "zone_1", graft_count: 500 },
        { zone_id: "zone_2", graft_count: 400 },
      ],
      surgeryGraftTotal: 700,
    });
    assert.equal(result.ok, true);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /exceeds recorded surgery graft count/);
  });

  it("rejects invalid negative counts", () => {
    const result = validateAndBuildStaffRecord({
      zones: [{ zone_id: "zone_1", graft_count: -5 }],
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => /graft count/i.test(e)));
  });

  it("preserves missing values as absent fields", () => {
    const { zone } = normalizeRecipientZoneInput({ zone_id: "zone_4", graft_count: 50 });
    assert.ok(zone);
    assert.equal(zone.graft_count, 50);
    assert.equal(zone.density_range, undefined);
    assert.equal(zone.notes, undefined);
  });

  it("round-trips drafts from stored record", () => {
    const drafts = recipientZoneDraftFromRecord({
      recipient_zones: [{ zone_id: "zone_1", graft_count: 120, notes: "Temple blend" }],
    });
    assert.equal(drafts[0].graft_count, "120");
    assert.equal(drafts[1].graft_count, "");
    const inputs = draftsToZoneInputs(drafts);
    assert.equal(sumZoneGraftCounts(inputs.map((z) => ({ graft_count: z.graft_count ?? undefined }))), 120);
  });

  it("buildGraftTotalMismatchWarning returns null without surgery total", () => {
    assert.equal(buildGraftTotalMismatchWarning({ zoneTotal: 500, surgeryGraftTotal: null }), null);
  });

  it("empty draft has all zone ids", () => {
    const d = emptyRecipientZoneDraft("zone_2");
    assert.equal(d.zone_id, "zone_2");
    assert.equal(d.graft_count, "");
  });
});