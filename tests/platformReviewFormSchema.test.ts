import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  emptyPlatformReviewFormValues,
  platformReviewDuplicateFingerprint,
  validatePlatformReviewForm,
} from "../lib/marketing/platformReviewFormSchema";

function validValues() {
  return emptyPlatformReviewFormValues({
    firstName: "Alex",
    lastName: "Owner",
    workEmail: "alex@clinic.example",
    phone: "+61 400 000 000",
    role: "Clinic Director",
    organisation: "Example Hair Clinic",
    country: "Australia",
    cityRegion: "Perth",
    locations: "1",
    staffCount: "11–25",
    monthlyEnquiries: "50–150",
    monthlyConsultations: "50–150",
    monthlyProcedures: "Under 50",
    crmSystem: "HubSpot",
    bookingSystem: "Google Calendar",
    patientRecordSystem: "Not sure",
    imagingSystem: "None",
    trainingSystem: "None",
    primaryInterest: "Transition away from HubSpot",
    adoptionStage: "Actively evaluating systems",
    mainProblems: "Follow-up is inconsistent and history is fragmented.",
    priorityWorkflows: "Enquiry pipeline and staged CRM transition.",
    consentContact: true,
    submissionKey: "test-key-1",
  });
}

describe("platformReviewFormSchema", () => {
  it("accepts a complete valid enquiry", () => {
    const result = validatePlatformReviewForm(validValues());
    assert.equal(result.ok, true);
  });

  it("requires consent and core contact fields", () => {
    const result = validatePlatformReviewForm(
      emptyPlatformReviewFormValues({
        firstName: "Alex",
        workEmail: "not-an-email",
        consentContact: false,
      })
    );
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.ok(result.errors.consentContact);
    assert.ok(result.errors.workEmail);
    assert.ok(result.errors.lastName);
  });

  it("rejects honeypot-filled submissions", () => {
    const result = validatePlatformReviewForm({
      ...validValues(),
      companyWebsite: "https://spam.example",
    });
    assert.equal(result.ok, false);
  });

  it("builds a stable duplicate fingerprint", () => {
    const a = validValues();
    const b = { ...validValues(), mainProblems: "Different text" };
    assert.equal(
      platformReviewDuplicateFingerprint(a),
      platformReviewDuplicateFingerprint(b)
    );
  });
});
