import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  buildJourneyPhotos,
  buildJourneyScaleSeries,
  buildPatientJourneyView,
  computeScaleTrend,
  mapImageCategoryToJourneyLabel,
} from "../src/lib/patients/journey/patientJourneyCore";
import { PATIENT_JOURNEY_DISCLAIMER } from "../src/lib/patients/journey/patientJourneyTypes";
import { getGuidedAssistQuickActionByCode } from "../src/lib/onboarding-os/guidedAssistCatalog";

describe("Patient visual journey", () => {
  it("maps image categories to journey labels", () => {
    assert.equal(mapImageCategoryToJourneyLabel("before").label, "baseline");
    assert.equal(mapImageCategoryToJourneyLabel("progress").label, "progress");
    assert.equal(mapImageCategoryToJourneyLabel("post_op").label, "post_op");
  });

  it("builds photo timeline items with imaging href", () => {
    const photos = buildJourneyPhotos({
      tenantId: "22222222-2222-4222-8222-222222222222",
      patientId: "11111111-1111-4111-8111-111111111111",
      images: [
        {
          id: "img1",
          image_category: "progress",
          caption: null,
          taken_at: "2026-06-01T00:00:00Z",
          created_at: "2026-06-01T00:00:00Z",
          thumbUrl: "https://example.com/a.jpg",
        },
      ],
    });
    assert.equal(photos.length, 1);
    assert.equal(photos[0]!.label, "progress");
    assert.ok(photos[0]!.href.includes("/imaging"));
  });

  it("builds scale series and trends from recorded values", () => {
    const series = buildJourneyScaleSeries({
      norwood_scale: "IV",
      ludwig_scale: null,
      hairline_pattern: "receding",
      metadata: {
        norwood_history: [
          { value: "III", at: "2025-01-01" },
          { value: "IV", at: "2026-01-01" },
        ],
      },
      updatedAtIso: "2026-06-01",
    });
    const nw = series.find((s) => s.kind === "norwood");
    assert.ok(nw);
    assert.ok(nw!.points.length >= 2);
    assert.equal(computeScaleTrend(nw!.points), "up");
  });

  it("builds full journey view with disclaimer and quick actions", () => {
    const tid = "22222222-2222-4222-8222-222222222222";
    const pid = "11111111-1111-4111-8111-111111111111";
    const journey = buildPatientJourneyView({
      tenantId: tid,
      patientId: pid,
      displayName: "Alex Example",
      images: [],
      clinical: { norwood_scale: "III", updated_at: "2026-01-01" },
      timelineItems: [
        {
          id: "t1",
          occurred_at: "2026-05-01T10:00:00Z",
          item_type: "booking_completed",
          title: "Consult completed",
          subtitle: null,
          href: null,
        },
      ],
      upcomingBookingCount: 1,
    });
    assert.equal(journey.disclaimer, PATIENT_JOURNEY_DISCLAIMER);
    assert.equal(journey.stats.upcomingBookings, 1);
    assert.ok(journey.milestones.length >= 1);
    assert.ok(journey.quickActions.some((a) => a.code === "qa_patient_journey" || a.href.includes("imaging")));
    assert.ok(journey.scaleSeries.some((s) => s.kind === "norwood"));
  });

  it("catalog includes visual journey quick action", () => {
    const qa = getGuidedAssistQuickActionByCode("qa_patient_journey");
    assert.ok(qa);
    assert.ok(qa!.hrefSuffix.includes("timeline"));
    assert.ok(!/diagnos|prescri/i.test(qa!.description));
  });
});
