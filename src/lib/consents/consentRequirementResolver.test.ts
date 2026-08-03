import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  computePatientConsentStatusSummary,
  planOutstandingConsentCreates,
  resolveRequiredConsentFormKeys,
  treatmentFormKeysFromBooking,
} from "./consentRequirementResolver";

describe("consentRequirementResolver", () => {
  it("surgery booking → surgery_procedure", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "active",
      bookings: [{ booking_type: "surgery", booking_status: "scheduled", title: "FUE day" }],
    });
    assert.ok(r.requiredFormKeys.includes("surgery_procedure"));
    assert.ok(r.requiredFormKeys.includes("privacy_treatment"));
    assert.ok(r.requiredFormKeys.includes("photo_clinical"));
    assert.ok((r.reasons.surgery_procedure ?? []).length > 0);
  });

  it("prp booking → prp_treatment", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "active",
      bookings: [{ booking_type: "prp", booking_status: "confirmed", title: null }],
    });
    assert.ok(r.requiredFormKeys.includes("prp_treatment"));
    assert.ok(!r.requiredFormKeys.includes("surgery_procedure"));
    assert.ok(!r.requiredFormKeys.includes("exosome_treatment"));
  });

  it("exosomes booking → exosome_treatment", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "active",
      bookings: [{ booking_type: "exosomes", booking_status: "scheduled", title: "Exosome session" }],
    });
    assert.ok(r.requiredFormKeys.includes("exosome_treatment"));
    assert.ok(!r.requiredFormKeys.includes("surgery_procedure"));
    assert.ok(!r.requiredFormKeys.includes("prp_treatment"));
  });

  it("title-only surgery signal maps without false PRP/exosome keys", () => {
    const keys = treatmentFormKeysFromBooking({
      booking_type: "other",
      title: "Hair transplant surgery planning",
      booking_status: "scheduled",
    });
    assert.deepEqual(keys, ["surgery_procedure"]);
  });

  it("consultation booking does not invent treatment keys", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "active",
      bookings: [{ booking_type: "consultation", booking_status: "scheduled", title: "Initial consult" }],
    });
    assert.ok(r.requiredFormKeys.includes("privacy_treatment"));
    assert.ok(r.requiredFormKeys.includes("photo_clinical"));
    assert.ok(!r.requiredFormKeys.includes("surgery_procedure"));
    assert.ok(!r.requiredFormKeys.includes("prp_treatment"));
    assert.ok(!r.requiredFormKeys.includes("exosome_treatment"));
  });

  it("cancelled surgery booking does not require surgery_procedure", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "active",
      bookings: [{ booking_type: "surgery", booking_status: "cancelled", title: "FUE" }],
    });
    assert.ok(!r.requiredFormKeys.includes("surgery_procedure"));
  });

  it("inactive patient with no bookings requires no baseline keys", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "inactive",
      bookings: [],
    });
    assert.deepEqual(r.requiredFormKeys, []);
  });

  it("hasImaging forces photo_clinical even when inactive", () => {
    const r = resolveRequiredConsentFormKeys({
      patientStatus: "inactive",
      bookings: [],
      hasImaging: true,
    });
    assert.deepEqual(r.requiredFormKeys, ["photo_clinical"]);
  });
});

describe("planOutstandingConsentCreates (ensureOutstanding pure)", () => {
  const templates = {
    privacy_treatment: {
      version: "2026-08-03",
      templateId: "11111111-1111-4111-8111-111111111111",
    },
    photo_clinical: {
      version: "2026-08-03",
      templateId: "22222222-2222-4222-8222-222222222222",
    },
    surgery_procedure: {
      version: "2026-08-03",
      templateId: "33333333-3333-4333-8333-333333333333",
    },
  } as const;

  it("creates outstanding for missing keys", () => {
    const plan = planOutstandingConsentCreates({
      requiredFormKeys: ["privacy_treatment", "photo_clinical", "surgery_procedure"],
      activeTemplatesByKey: templates,
      existingInstances: [],
    });
    assert.equal(plan.length, 3);
    assert.ok(plan.every((p) => p.formVersion === "2026-08-03"));
  });

  it("is idempotent when outstanding already exists", () => {
    const plan = planOutstandingConsentCreates({
      requiredFormKeys: ["privacy_treatment", "photo_clinical"],
      activeTemplatesByKey: templates,
      existingInstances: [
        {
          form_key: "privacy_treatment",
          form_version: "2026-08-03",
          status: "outstanding",
        },
        {
          form_key: "photo_clinical",
          form_version: "2026-08-03",
          status: "outstanding",
        },
      ],
    });
    assert.deepEqual(plan, []);
  });

  it("does not recreate when signed for current version", () => {
    const plan = planOutstandingConsentCreates({
      requiredFormKeys: ["surgery_procedure"],
      activeTemplatesByKey: templates,
      existingInstances: [
        {
          form_key: "surgery_procedure",
          form_version: "2026-08-03",
          status: "signed",
        },
      ],
    });
    assert.deepEqual(plan, []);
  });

  it("does not void or replace signed instances when re-planned", () => {
    const plan = planOutstandingConsentCreates({
      requiredFormKeys: ["privacy_treatment", "surgery_procedure"],
      activeTemplatesByKey: templates,
      existingInstances: [
        {
          form_key: "privacy_treatment",
          form_version: "2026-08-03",
          status: "signed",
        },
      ],
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.formKey, "surgery_procedure");
  });
});

describe("computePatientConsentStatusSummary", () => {
  it("allRequiredSigned true only when all required signed", () => {
    const partial = computePatientConsentStatusSummary({
      requiredFormKeys: ["privacy_treatment", "photo_clinical"],
      instances: [
        { form_key: "privacy_treatment", status: "signed" },
        { form_key: "photo_clinical", status: "outstanding" },
      ],
    });
    assert.equal(partial.allRequiredSigned, false);
    assert.deepEqual(partial.signed, ["privacy_treatment"]);
    assert.deepEqual(partial.outstanding, ["photo_clinical"]);

    const full = computePatientConsentStatusSummary({
      requiredFormKeys: ["privacy_treatment", "photo_clinical"],
      instances: [
        { form_key: "privacy_treatment", status: "signed" },
        { form_key: "photo_clinical", status: "signed" },
      ],
    });
    assert.equal(full.allRequiredSigned, true);
    assert.deepEqual(full.outstanding, []);
  });

  it("allRequiredSigned true when nothing required", () => {
    const empty = computePatientConsentStatusSummary({
      requiredFormKeys: [],
      instances: [],
    });
    assert.equal(empty.allRequiredSigned, true);
  });
});
