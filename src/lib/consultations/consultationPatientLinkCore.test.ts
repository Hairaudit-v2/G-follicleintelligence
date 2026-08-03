import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isConsultationEditableStatus,
  isConsultationPatientLinkableStatus,
  isPatientLinkOnlyConsultationPatch,
  resolveConsultationPatientId,
} from "./consultationPatientLinkCore";

describe("F-PILOT-08 consultation patient link core", () => {
  it("prefers consultation patient_id over lead", () => {
    assert.equal(
      resolveConsultationPatientId({
        consultationPatientId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        leadPatientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
    );
  });

  it("falls back to lead patient_id when consultation patient is null", () => {
    assert.equal(
      resolveConsultationPatientId({
        consultationPatientId: null,
        leadPatientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );
    assert.equal(
      resolveConsultationPatientId({
        consultationPatientId: "  ",
        leadPatientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
    );
  });

  it("returns null when neither side has a patient", () => {
    assert.equal(
      resolveConsultationPatientId({
        consultationPatientId: null,
        leadPatientId: null,
      }),
      null
    );
  });

  it("completed is linkable but not fully editable", () => {
    assert.equal(isConsultationEditableStatus("completed"), false);
    assert.equal(isConsultationPatientLinkableStatus("completed"), true);
    assert.equal(isConsultationEditableStatus("draft"), true);
    assert.equal(isConsultationPatientLinkableStatus("archived"), false);
  });

  it("detects patient-link-only patches", () => {
    assert.equal(
      isPatientLinkOnlyConsultationPatch({
        patient_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        person_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
      true
    );
    assert.equal(
      isPatientLinkOnlyConsultationPatch({
        patient_id: null,
        adminKey: "x",
      }),
      true
    );
    assert.equal(
      isPatientLinkOnlyConsultationPatch({
        patient_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        status: "completed",
      }),
      false
    );
  });
});
