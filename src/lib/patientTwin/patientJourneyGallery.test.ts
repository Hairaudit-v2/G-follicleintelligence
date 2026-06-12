import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPatientJourneyGallery, flattenFollowUpGroup } from "./patientJourneyGallery";

describe("patientJourneyGallery", () => {
  it("buckets donor vs hairline and follow-up merge", () => {
    const base = {
      taken_at: null,
      created_at: "2026-01-10T12:00:00.000Z",
      case_id: null,
      procedure_date_ymd: null,
      ai_image_category_confidence: 0.9,
      ai_surgery_stage: "unknown",
      ai_image_review_status: "accepted",
      ai_image_classified_at: "2026-01-10T12:00:00.000Z",
    };
    const donor = { id: "00000000-0000-4000-8000-000000000001", ...base, ai_image_category: "donor" };
    const hairline = { id: "00000000-0000-4000-8000-000000000002", ...base, ai_image_category: "front" };
    const fu = {
      id: "00000000-0000-4000-8000-000000000003",
      ...base,
      ai_image_category: "follow_up",
      ai_surgery_stage: "follow_up",
    };
    const g = buildPatientJourneyGallery([donor, hairline, fu]);
    assert.equal(g.donor.length, 1);
    assert.equal(g.hairline.length, 1);
    assert.equal(g.followUpGeneral.length, 1);
    const flat = flattenFollowUpGroup(g);
    assert.equal(flat.length, 1);
  });
});
