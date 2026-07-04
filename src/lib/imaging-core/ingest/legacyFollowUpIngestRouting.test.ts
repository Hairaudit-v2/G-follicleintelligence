import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildFollowUpOutcomeImageIngestionRequest } from "@/src/lib/imaging-os/adapters/followUpOutcomeImageAdapter";
import { buildPatientImageIngestionRequest } from "./buildPatientImageIngestionRequest";
import {
  extractFollowUpEncounterId,
  isLegacyFollowUpIngestContext,
  resolveLegacyFollowUpMetadataCaptureSource,
  validateLegacyFollowUpIngestContext,
} from "./legacyFollowUpIngestCore";
import type { LegacyFollowUpIngestContext } from "./patientImageIngestContextTypes";
import { parsePatientImageIngestionContext } from "./parsePatientImageIngestionContext";
import { runUnifiedPatientImageIngest } from "./runUnifiedPatientImageIngest";
import { buildImagingSessionTaxonomy } from "./sessionTaxonomy";

const TENANT = "11111111-1111-4111-8111-111111111111";
const PATIENT = "33333333-3333-4333-8333-333333333333";
const IMAGE = "55555555-5555-4555-8555-555555555555";
const CONSULTATION = "66666666-6666-4666-8666-666666666666";
const ENCOUNTER = "88888888-8888-4888-8888-888888888888";
const STORAGE_PATH = `tenants/${TENANT}/patients/${PATIENT}/images/${IMAGE}/fu_front.jpg`;

const baseFlat = {
  tenant_id: TENANT,
  patient_id: PATIENT,
  image_id: IMAGE,
  storage_bucket: "patient-images",
  storage_path: STORAGE_PATH,
};

describe("legacy follow-up ingest routing", () => {
  it("detects legacy follow-up capture sources", () => {
    assert.equal(isLegacyFollowUpIngestContext({ capture_source: "legacy_follow_up" }), true);
    assert.equal(isLegacyFollowUpIngestContext({ capture_source: "follow_up_encounter" }), true);
    assert.equal(isLegacyFollowUpIngestContext({ capture_source: "follow_up_outcome" }), true);
    assert.equal(
      isLegacyFollowUpIngestContext({
        capture_source: "imaging_os_wizard",
        protocol_template_slug: "follow_up_review",
      }),
      true
    );
    assert.equal(isLegacyFollowUpIngestContext({ capture_source: "consultation_os" }), false);
  });

  it("routes follow_up_outcome ahead of consultation_id fallback", () => {
    const ctx = parsePatientImageIngestionContext({
      ...baseFlat,
      capture_source: "follow_up_outcome",
      consultation_id: CONSULTATION,
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
    });
    assert.equal(ctx.kind, "legacy_follow_up");
    const request = buildPatientImageIngestionRequest(ctx);
    assert.equal(request.upload_surface, "fi_guided_protocol");
    assert.equal(request.metadata?.capture_source, "follow_up_outcome");
    assert.equal(request.consultation_id, undefined);
  });

  it("routes legacy_follow_up ahead of consultation_id fallback", () => {
    const ctx = parsePatientImageIngestionContext({
      ...baseFlat,
      capture_source: "legacy_follow_up",
      consultation_id: CONSULTATION,
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      metadata: { follow_up_encounter_id: ENCOUNTER },
    });
    assert.equal(ctx.kind, "legacy_follow_up");
    assert.equal(ctx.follow_up_encounter_id, ENCOUNTER);
    const request = buildPatientImageIngestionRequest(ctx);
    assert.equal(request.metadata?.capture_source, "legacy_follow_up");
    assert.equal(request.metadata?.follow_up_encounter_id, ENCOUNTER);
    assert.equal(request.consultation_id, undefined);
  });

  it("routes follow_up_encounter and preserves encounter metadata", () => {
    const ctx = parsePatientImageIngestionContext({
      ...baseFlat,
      capture_source: "follow_up_encounter",
      metadata: { follow_up_encounter_id: ENCOUNTER },
      protocol_template_slug: "follow_up_review",
    });
    assert.equal(ctx.kind, "legacy_follow_up");
    const request = buildPatientImageIngestionRequest(ctx);
    assert.equal(request.metadata?.capture_source, "follow_up_encounter");
    assert.equal(request.metadata?.follow_up_encounter_id, ENCOUNTER);
  });

  it("classifies legacy follow-up session taxonomy without consultation dependency", () => {
    const result = runUnifiedPatientImageIngest({
      ...baseFlat,
      capture_source: "legacy_follow_up",
      protocol_template_slug: "follow_up_review",
      protocol_slot_slug: "fu_front",
      follow_up_interval: "6_month",
      metadata: { follow_up_encounter_id: ENCOUNTER },
    });
    assert.equal(result.imaging_session.session_type, "follow_up");
    assert.equal(result.imaging_session.protocol_version, "follow_up_review");
    assert.equal(result.imaging_session.interval, "6_month");
    assert.equal(result.imaging_os_ingest.source_system, "fi_os");
    assert.equal(result.imaging_os_ingest.upload_surface, "fi_guided_protocol");
  });

  it("classifies legacy_follow_up capture in session taxonomy without template slug", () => {
    const taxonomy = buildImagingSessionTaxonomy({
      capture_source: "legacy_follow_up",
      protocol_slot_slug: "fu_front",
    });
    assert.equal(taxonomy.session_type, "follow_up");
    assert.equal(taxonomy.capture_source, "legacy_follow_up");
  });

  it("extracts follow_up_encounter_id from nested metadata", () => {
    assert.equal(
      extractFollowUpEncounterId({
        progress: { follow_up_encounter_id: ENCOUNTER },
      }),
      ENCOUNTER
    );
  });

  it("validates legacy follow-up encounter linkage for explicit legacy sources", () => {
    const withEncounter = parsePatientImageIngestionContext({
      ...baseFlat,
      capture_source: "legacy_follow_up",
      metadata: { follow_up_encounter_id: ENCOUNTER },
    }) as LegacyFollowUpIngestContext;
    assert.equal(validateLegacyFollowUpIngestContext(withEncounter).valid, true);

    const missingEncounter = parsePatientImageIngestionContext({
      ...baseFlat,
      capture_source: "legacy_follow_up",
    }) as LegacyFollowUpIngestContext;
    assert.equal(validateLegacyFollowUpIngestContext(missingEncounter).valid, false);
  });

  it("adapter preserves explicit legacy capture source", () => {
    const request = buildFollowUpOutcomeImageIngestionRequest({
      tenant_id: TENANT,
      patient_id: PATIENT,
      image_id: IMAGE,
      storage_bucket: "patient-images",
      storage_path: STORAGE_PATH,
      capture_source: "legacy_follow_up",
      follow_up_encounter_id: ENCOUNTER,
    });
    assert.equal(request.metadata?.capture_source, "legacy_follow_up");
    assert.equal(request.metadata?.follow_up_encounter_id, ENCOUNTER);
    assert.equal(
      resolveLegacyFollowUpMetadataCaptureSource("legacy_follow_up"),
      "legacy_follow_up"
    );
  });
});