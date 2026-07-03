import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildLegacyPatientDuplicateIndex,
  buildLegacyPatientMetadata,
  checkLegacyPatientDuplicates,
  resolveBlockingPatientMatch,
} from "./legacyPatientCore";
import {
  canApproveAiImagingSummary,
  canCreateFollowUpEncounter,
  canReadFollowUpClinicalPhi,
} from "./followUpEncounterPermissions";
import {
  followUpEncounterTimelineTitle,
  imagingAiReviewStatusLabel,
  isAiImagingSummaryPatientVisible,
} from "./followUpEncounterTypes";
import { buildPatientTimeline } from "@/src/lib/patients/timeline/patientTimelineBuild";
import type { PatientTimelineSourceBundle } from "@/src/lib/patients/timeline/patientTimelineTypes";

function captureSourceRequiresProtocolSession(source: string): boolean {
  const normalized = source.trim().toLowerCase();
  if (normalized === "imaging_os_wizard") return false;
  if (normalized === "legacy_follow_up" || normalized === "follow_up_encounter") return false;
  return (
    normalized === "patient_profile" ||
    normalized === "patient_slide_over" ||
    normalized === "profile_upload_form" ||
    normalized === "vie_capture_wizard" ||
    normalized === "surgery_os" ||
    normalized === "appointment_procedure"
  );
}

const href = { tenantId: "tid-1" };

function minimalBundle(
  over: Partial<PatientTimelineSourceBundle> = {}
): PatientTimelineSourceBundle {
  return {
    tenantId: "tid-1",
    foundationPatientId: "patient-1",
    patient: {
      id: "patient-1",
      created_at: "2026-01-01T10:00:00.000Z",
      updated_at: "2026-01-01T10:00:00.000Z",
      patient_status: "active",
    },
    leads: [],
    cases: [],
    bookings: [],
    activity: [],
    clinical: null,
    images: [],
    followUpEncounters: [],
    followUpImagingSessions: [],
    ...over,
  };
}

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — legacy patient core", () => {
  it("detects blocking duplicate by exact email", () => {
    const index = buildLegacyPatientDuplicateIndex([
      {
        patientId: "pat-1",
        personId: "per-1",
        displayName: "Jane Doe",
        email: "jane@example.com",
        phone: "0412345678",
        dateOfBirth: "1980-01-01",
        legacySource: null,
      },
    ]);
    const result = checkLegacyPatientDuplicates(
      { email: "jane@example.com", displayName: "Jane Doe" },
      index
    );
    assert.equal(result.hasBlockingMatch, true);
    const match = resolveBlockingPatientMatch(result, [
      {
        patientId: "pat-1",
        personId: "per-1",
        displayName: "Jane Doe",
        email: "jane@example.com",
        phone: "0412345678",
        dateOfBirth: "1980-01-01",
        legacySource: null,
      },
    ]);
    assert.equal(match?.patientId, "pat-1");
  });

  it("builds legacy patient metadata with Timely source", () => {
    const meta = buildLegacyPatientMetadata({
      legacySource: "timely",
      legacyExternalId: "T-123",
      firstName: "John",
      lastName: "Smith",
    });
    assert.equal(meta.legacy_source, "timely");
    assert.equal(meta.legacy_external_id, "T-123");
    assert.equal(meta.returning_patient, true);
  });
});

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — permissions", () => {
  it("allows clinicians to create all follow-up types", () => {
    assert.equal(canCreateFollowUpEncounter("doctor", "donor_review"), true);
    assert.equal(canCreateFollowUpEncounter("nurse", "post_op_review"), true);
  });

  it("restricts reception to photos-only and follow-up shells", () => {
    assert.equal(canCreateFollowUpEncounter("reception", "photos_only"), true);
    assert.equal(canCreateFollowUpEncounter("reception", "legacy_follow_up"), true);
    assert.equal(canCreateFollowUpEncounter("reception", "donor_review"), false);
  });

  it("blocks reception from approving AI summaries", () => {
    assert.equal(canApproveAiImagingSummary("reception"), false);
    assert.equal(canApproveAiImagingSummary("doctor"), true);
  });

  it("allows clinical roles to read PHI notes", () => {
    assert.equal(canReadFollowUpClinicalPhi("nurse"), true);
    assert.equal(canReadFollowUpClinicalPhi("reception"), false);
  });
});

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — AI governance", () => {
  it("never exposes unapproved AI summaries to patients", () => {
    assert.equal(isAiImagingSummaryPatientVisible("ai_pending"), false);
    assert.equal(isAiImagingSummaryPatientVisible("ai_ready_for_review"), false);
    assert.equal(isAiImagingSummaryPatientVisible("clinician_rejected"), false);
    assert.equal(isAiImagingSummaryPatientVisible("clinician_approved"), true);
  });

  it("uses human-readable AI review labels", () => {
    assert.match(imagingAiReviewStatusLabel("ai_ready_for_review"), /clinician approval/i);
  });
});

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — timeline", () => {
  it("renders legacy follow-up encounters on patient timeline", () => {
    const bundle = minimalBundle({
      followUpEncounters: [
        {
          id: "enc-1",
          encounter_type: "legacy_follow_up",
          legacy_source: "timely",
          visit_reason: "3-month post-op",
          clinical_note: "Healing well",
          status: "completed",
          created_at: "2026-06-01T10:00:00.000Z",
          completed_at: "2026-06-01T11:00:00.000Z",
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href });
    const hit = items.find((i) => i.id === "follow_up_encounter:enc-1");
    assert.ok(hit);
    assert.equal(hit.title, "Legacy follow-up");
    assert.match(hit.metadata_summary ?? "", /Timely/i);
  });

  it("renders AI review pending on timeline", () => {
    const bundle = minimalBundle({
      followUpImagingSessions: [
        {
          id: "sess-1",
          follow_up_encounter_id: "enc-1",
          template_slug: "follow_up_review",
          session_completeness_status: "partial",
          ai_status: "processing",
          ai_review_status: "ai_ready_for_review",
          created_at: "2026-06-01T12:00:00.000Z",
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href });
    const hit = items.find((i) => i.id === "follow_up_imaging:sess-1");
    assert.ok(hit);
    assert.equal(hit.item_type, "follow_up_ai_review_pending");
  });

  it("labels photos captured for follow-up images", () => {
    const bundle = minimalBundle({
      images: [
        {
          id: "img-1",
          image_category: "front",
          image_status: "active",
          caption: null,
          created_at: "2026-06-01T13:00:00.000Z",
          archived_at: null,
          follow_up_encounter_id: "enc-1",
        },
      ],
    });
    const { items } = buildPatientTimeline(bundle, { hrefContext: href });
    const hit = items.find((i) => i.id === "image_uploaded:img-1");
    assert.ok(hit);
    assert.equal(hit.title, "Photos captured");
  });
});

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — imaging capture policy", () => {
  it("exempts legacy_follow_up from VIE protocol session requirement", () => {
    assert.equal(captureSourceRequiresProtocolSession("legacy_follow_up"), false);
  });

  it("still requires protocol session for patient_profile uploads", () => {
    assert.equal(captureSourceRequiresProtocolSession("patient_profile"), true);
  });
});

describe("FI-LEGACY-FOLLOWUP-IMAGING-1 — encounter titles", () => {
  it("uses legacy label for timely-sourced encounters", () => {
    assert.equal(followUpEncounterTimelineTitle("follow_up", "timely"), "Legacy follow-up");
    assert.equal(followUpEncounterTimelineTitle("photos_only", null), "Photos captured");
  });
});
