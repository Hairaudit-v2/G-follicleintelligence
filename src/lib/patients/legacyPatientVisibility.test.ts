import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applySavedViewToLegacyQueryFields,
  patientDirectoryHasLegacyFilters,
  PATIENT_OS_LEGACY_SAVED_VIEWS,
} from "./patientDirectoryFilters";
import {
  deriveLegacyPatientBadges,
  deriveLegacyPatientDisplayPolicy,
  deriveLegacyPatientProfileBanners,
  deriveLegacyPatientVisibilitySummary,
  deriveMergeReadinessStatus,
  matchesLegacyPatientDirectoryFilters,
  toPermissionSafeLegacyRowView,
  type LegacyPatientVisibilityInput,
} from "./legacyPatientVisibilityCore";
import { parsePatientDirectoryQuery, patientDirectoryQueryToHrefQuery } from "./patientDirectoryQuery";
import { isAiImagingSummaryPatientVisible } from "@/src/lib/followUpEncounters/followUpEncounterTypes";

function baseInput(over: Partial<LegacyPatientVisibilityInput> = {}): LegacyPatientVisibilityInput {
  return {
    patientId: "patient-1",
    patientMetadata: {},
    sourceMappings: [],
    encounters: [],
    imagingSessions: [],
    followUpImageCount: 0,
    ...over,
  };
}

describe("FI-LEGACY-PATIENTOS-FILTER-1 — legacy patient visibility", () => {
  it("filters returning Timely patients", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        patientMetadata: { legacy_source: "timely", returning_patient: true },
        sourceMappings: [{ source_system: "timely", source_patient_id: "T-100" }],
      })
    );
    assert.equal(summary.returning_from_timely, true);
    assert.equal(
      matchesLegacyPatientDirectoryFilters(summary, { returningFromTimely: true }),
      true
    );
    assert.equal(
      matchesLegacyPatientDirectoryFilters(summary, { returningFromTimely: true, hasLegacySource: true }),
      true
    );
  });

  it("filters any legacy source", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        patientMetadata: { returning_patient: true, legacy_source: "timely" },
      })
    );
    assert.equal(summary.has_legacy_source, true);
    assert.equal(matchesLegacyPatientDirectoryFilters(summary, { hasLegacySource: true }), true);
  });

  it("filters follow-up encounter and this-week saved view", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        encounters: [
          {
            id: "enc-1",
            encounter_type: "legacy_follow_up",
            legacy_source: "timely",
            status: "completed",
            created_at: "2026-07-02T10:00:00.000Z",
            completed_at: "2026-07-02T11:00:00.000Z",
          },
        ],
      })
    );
    assert.equal(summary.has_follow_up_encounter, true);
    assert.equal(summary.follow_up_encounter_count, 1);
    assert.equal(matchesLegacyPatientDirectoryFilters(summary, { hasFollowUpEncounter: true }), true);
    assert.equal(
      matchesLegacyPatientDirectoryFilters(summary, {
        hasFollowUpEncounter: true,
        followUpSince: "2026-07-01T00:00:00.000Z",
      }, { followUpEncounterDates: ["2026-07-02T10:00:00.000Z"] }),
      true
    );
  });

  it("filters photos captured and photos without AI approval", () => {
    const withPhotos = deriveLegacyPatientVisibilitySummary(
      baseInput({
        imagingSessions: [
          {
            id: "sess-1",
            follow_up_encounter_id: "enc-1",
            session_completeness_status: "partial",
            ai_status: "completed",
            ai_review_status: "ai_pending",
            created_at: "2026-07-02T12:00:00.000Z",
          },
        ],
      })
    );
    assert.equal(withPhotos.has_photos_captured, true);
    assert.equal(withPhotos.has_photos_without_ai_approval, true);
    assert.equal(matchesLegacyPatientDirectoryFilters(withPhotos, { hasPhotosCaptured: true }), true);
    assert.equal(matchesLegacyPatientDirectoryFilters(withPhotos, { photosNoAiApproval: true }), true);

    const approved = deriveLegacyPatientVisibilitySummary(
      baseInput({
        imagingSessions: [
          {
            id: "sess-2",
            follow_up_encounter_id: "enc-2",
            session_completeness_status: "complete",
            ai_status: "completed",
            ai_review_status: "clinician_approved",
            created_at: "2026-07-03T12:00:00.000Z",
          },
        ],
      })
    );
    assert.equal(approved.has_clinician_approved_ai_review, true);
    assert.equal(approved.has_photos_without_ai_approval, false);
    assert.equal(matchesLegacyPatientDirectoryFilters(approved, { clinicianApprovedAi: true }), true);
  });

  it("filters AI review pending", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        imagingSessions: [
          {
            id: "sess-3",
            follow_up_encounter_id: "enc-3",
            session_completeness_status: "complete",
            ai_status: "completed",
            ai_review_status: "ai_ready_for_review",
            created_at: "2026-07-03T09:00:00.000Z",
          },
        ],
      })
    );
    assert.equal(summary.has_ai_review_pending, true);
    assert.equal(matchesLegacyPatientDirectoryFilters(summary, { aiReviewPending: true }), true);
  });

  it("derives badges for operational states", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        patientMetadata: {
          returning_patient: true,
          legacy_source: "timely",
          historical_record_note: "Historical record not fully imported yet",
          needs_merge_review: true,
        },
        encounters: [
          {
            id: "enc-4",
            encounter_type: "legacy_follow_up",
            legacy_source: "timely",
            status: "draft",
            created_at: "2026-07-01T09:00:00.000Z",
            completed_at: null,
          },
        ],
        imagingSessions: [
          {
            id: "sess-4",
            follow_up_encounter_id: "enc-4",
            session_completeness_status: "partial",
            ai_status: "pending",
            ai_review_status: "ai_pending",
            created_at: "2026-07-01T10:00:00.000Z",
          },
        ],
      })
    );
    const badges = deriveLegacyPatientBadges(summary);
    const kinds = badges.map((b) => b.kind);
    assert.ok(kinds.includes("timely"));
    assert.ok(kinds.includes("follow_up_active"));
    assert.ok(kinds.includes("record_incomplete"));
    assert.ok(kinds.includes("merge_review"));
    assert.ok(kinds.includes("photos_captured"));
    assert.ok(kinds.includes("ai_review_pending"));
  });

  it("derives profile banners with follow-up and capture links", () => {
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        patientMetadata: { returning_patient: true, legacy_source: "timely" },
        encounters: [
          {
            id: "enc-5",
            encounter_type: "legacy_follow_up",
            legacy_source: "timely",
            status: "draft",
            created_at: "2026-07-02T08:00:00.000Z",
            completed_at: null,
          },
        ],
        imagingSessions: [
          {
            id: "sess-5",
            follow_up_encounter_id: "enc-5",
            session_completeness_status: "incomplete",
            ai_status: "pending",
            ai_review_status: "ai_pending",
            created_at: "2026-07-02T08:30:00.000Z",
          },
        ],
      })
    );
    const banners = deriveLegacyPatientProfileBanners(summary, "tenant-1");
    assert.ok(banners.some((b) => b.title === "Returning patient from Timely"));
    assert.ok(banners.some((b) => b.hrefLabel === "Add today's follow-up"));
    assert.ok(banners.some((b) => b.secondaryHrefLabel === "Capture photos"));
  });

  it("derives merge readiness labels without automatic merge behaviour", () => {
    assert.equal(
      deriveMergeReadinessStatus({
        metadata: { possible_duplicate_suspected: true },
        legacySource: "timely",
        hasTimelyMapping: true,
      }),
      "possible_duplicate"
    );
    assert.equal(
      deriveMergeReadinessStatus({
        metadata: { needs_merge_review: true },
        legacySource: "timely",
        hasTimelyMapping: true,
      }),
      "needs_manual_merge_review"
    );
    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        patientMetadata: {
          returning_patient: true,
          historical_record_note: "Historical record not fully imported yet",
        },
      })
    );
    assert.equal(summary.merge_readiness, "historical_import_pending");
    assert.equal(summary.needs_merge_review, false);
  });

  it("permission-safe display model hides AI summary text for reception", () => {
    const receptionPolicy = deriveLegacyPatientDisplayPolicy("reception");
    const clinicalPolicy = deriveLegacyPatientDisplayPolicy("doctor");
    assert.equal(receptionPolicy.showAiSummaryText, false);
    assert.equal(clinicalPolicy.showAiSummaryText, true);

    const summary = deriveLegacyPatientVisibilitySummary(
      baseInput({
        imagingSessions: [
          {
            id: "sess-6",
            follow_up_encounter_id: "enc-6",
            session_completeness_status: "complete",
            ai_status: "completed",
            ai_review_status: "ai_pending",
            created_at: "2026-07-02T10:00:00.000Z",
          },
        ],
      })
    );
    const safe = toPermissionSafeLegacyRowView(summary, "reception");
    assert.equal(safe.aiSummaryText, null);
    assert.equal(isAiImagingSummaryPatientVisible(summary.latest_ai_review_status as never), false);
    assert.equal(summary.has_unapproved_ai_summary, true);
  });

  it("saved views reuse the shared filter model", () => {
    assert.equal(PATIENT_OS_LEGACY_SAVED_VIEWS.length, 6);
    const applied = applySavedViewToLegacyQueryFields(
      {
        returningFromTimely: null,
        hasLegacySource: null,
        historicalIncomplete: null,
        hasFollowUpEncounter: null,
        hasPhotosCaptured: null,
        aiReviewPending: null,
        clinicianApprovedAi: null,
        needsMergeReview: null,
        photosNoAiApproval: null,
        followUpSince: null,
        savedView: null,
      },
      "imaging_ai_review_pending"
    );
    assert.equal(applied.aiReviewPending, true);
    assert.equal(applied.savedView, "imaging_ai_review_pending");
    assert.equal(patientDirectoryHasLegacyFilters(applied), true);
  });

  it("directory query round-trips legacy filter params", () => {
    const q = parsePatientDirectoryQuery({
      returningFromTimely: "true",
      hasFollowUpEncounter: "true",
      savedView: "returning_timely",
      view: "list",
    });
    assert.equal(q.returningFromTimely, true);
    assert.equal(q.hasFollowUpEncounter, true);
    assert.equal(q.savedView, "returning_timely");
    const href = patientDirectoryQueryToHrefQuery(q);
    assert.equal(href.returningFromTimely, "true");
    assert.equal(href.hasFollowUpEncounter, "true");
    assert.equal(href.savedView, "returning_timely");
  });
});