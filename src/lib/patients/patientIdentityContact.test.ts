import test from "node:test";
import assert from "node:assert/strict";

import {
  computeAgeYearsFromDobString,
  derivePatientIdentityContact,
} from "@/src/lib/patients/patientIdentityContact";

test("derivePatientIdentityContact: HubSpot-only person metadata fills name, email, phone", () => {
  const v = derivePatientIdentityContact({
    personMetadata: {
      import_batch_id: "batch-1",
      hubspot: {
        record_id: "hs-99",
        first_name: "Tjania",
        last_name: "Smith",
        email: "tjania@example.com",
        phone_number: "+44 7700 900123",
        lifecycle_stage: "lead",
        lead_status: "NEW",
        stage_of_journey: "Consult scheduled",
      },
    },
    patientMetadata: {},
  });
  assert.equal(v.fullName, "Tjania Smith");
  assert.equal(v.primaryEmail, "tjania@example.com");
  assert.equal(v.primaryPhone, "+44 7700 900123");
  assert.equal(v.hubspotRecordId, "hs-99");
  assert.equal(v.importBatchId, "batch-1");
  assert.equal(v.lifecycleStage, "lead");
  assert.equal(v.leadStatus, "NEW");
  assert.equal(v.stageOfJourney, "Consult scheduled");
  assert.equal(v.hasHubspotSlice, true);
});

test("derivePatientIdentityContact: patient metadata hubspot supplements missing person email", () => {
  const v = derivePatientIdentityContact({
    personMetadata: { display_name: "Legacy Label" },
    patientMetadata: {
      hubspot: {
        email: "only-on-patient@example.com",
        phone_number: "0400 000 000",
      },
    },
  });
  assert.equal(v.fullName, "Legacy Label");
  assert.equal(v.primaryEmail, "only-on-patient@example.com");
  assert.equal(v.primaryPhone, "0400 000 000");
});

test("derivePatientIdentityContact: DOB + age from hubspot.date_of_birth", () => {
  const v = derivePatientIdentityContact({
    personMetadata: {
      hubspot: { date_of_birth: "1990-06-15", first_name: "A", last_name: "B" },
    },
    patientMetadata: {},
  });
  assert.equal(v.dateOfBirth, "1990-06-15");
  assert.equal(v.ageYears, computeAgeYearsFromDobString("1990-06-15"));
  assert.equal(computeAgeYearsFromDobString("1990-06-15", new Date("2026-07-01T00:00:00Z")), 36);
});

test("derivePatientIdentityContact: hubspotSourcePersonId fallback when record_id absent", () => {
  const v = derivePatientIdentityContact({
    personMetadata: { hubspot: { first_name: "X", last_name: "Y" } },
    patientMetadata: {},
    hubspotSourcePersonId: "legacy-hs-id",
  });
  assert.equal(v.hubspotRecordId, "legacy-hs-id");
});

test("computeAgeYearsFromDobString returns null for non-ISO", () => {
  assert.equal(computeAgeYearsFromDobString("nope"), null);
});
