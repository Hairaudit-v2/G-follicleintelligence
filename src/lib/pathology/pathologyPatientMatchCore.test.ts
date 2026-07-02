import assert from "node:assert/strict";
import test from "node:test";

import {
  isHighConfidencePathologyMatch,
  pickBestPathologyPatientMatch,
  scorePathologyPatientMatch,
} from "@/src/lib/pathology/pathologyPatientMatchCore";

test("scorePathologyPatientMatch: exact name + DOB yields high confidence", () => {
  const score = scorePathologyPatientMatch(
    { patientName: "Jane Doe", dob: "1990-05-12" },
    {
      patientId: "patient-a",
      fullName: "Jane Doe",
      dateOfBirth: "1990-05-12",
      primaryEmail: null,
      mrn: null,
    }
  );
  assert.ok(score);
  assert.equal(score.confidence, 0.98);
  assert.deepEqual(score.evidence.matchedOn, ["name", "dob"]);
  assert.equal(isHighConfidencePathologyMatch(score.confidence), true);
});

test("pickBestPathologyPatientMatch: selects highest confidence candidate", () => {
  const best = pickBestPathologyPatientMatch(
    { patientName: "Jane Doe", dob: "1990-05-12" },
    [
      {
        patientId: "patient-b",
        fullName: "Jane Doe",
        dateOfBirth: "1988-01-01",
        primaryEmail: null,
        mrn: null,
      },
      {
        patientId: "patient-a",
        fullName: "Jane Doe",
        dateOfBirth: "1990-05-12",
        primaryEmail: null,
        mrn: null,
      },
    ]
  );
  assert.ok(best);
  assert.equal(best.patientId, "patient-a");
  assert.equal(best.confidence, 0.98);
});

test("scorePathologyPatientMatch: no signal returns null", () => {
  const score = scorePathologyPatientMatch(
    { patientName: "Unknown Person" },
    {
      patientId: "patient-a",
      fullName: "Jane Doe",
      dateOfBirth: "1990-05-12",
      primaryEmail: null,
      mrn: null,
    }
  );
  assert.equal(score, null);
});
