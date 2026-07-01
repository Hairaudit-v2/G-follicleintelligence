import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildSurgeryBookingCreateParams,
  buildSurgeryBookingMetadata,
  listSurgeryBookingMissingRequirements,
  preOpChecklistDisplayItems,
  buildPreOpChecklistFlagsForBookingDraft,
} from "./surgeryBookingEngineCore";
import type { SurgeryBookingConfirmBody } from "./surgeryBookingTypes";

const PATIENT = "22222222-2222-4222-8222-222222222222";
const CASE = "33333333-3333-4333-8333-333333333333";
const CLINIC = "44444444-4444-4444-8444-444444444444";
const ROOM = "55555555-5555-4555-8555-555555555555";
const STAFF = "66666666-6666-4666-8666-666666666666";

function baseBody(): SurgeryBookingConfirmBody {
  return {
    patientId: PATIENT,
    personId: null,
    caseId: CASE,
    leadId: null,
    clinicId: CLINIC,
    consultationId: null,
    crmQuoteId: null,
    procedureType: "FUE hair transplant",
    graftEstimate: "3000",
    plannedZones: [{ key: "hairline", label: "Hairline" }],
    clinicalNotes: "Standard density plan",
    surgeonStaffId: STAFF,
    startAt: "2026-08-01T01:00:00.000Z",
    endAt: "2026-08-01T09:00:00.000Z",
    timezone: "Australia/Perth",
    roomId: ROOM,
    bookingStatus: "scheduled",
    createDepositRequest: false,
    entrySource: "unit_test",
  };
}

describe("surgeryBookingEngineCore", () => {
  it("lists missing requirements per wizard step", () => {
    assert.deepEqual(listSurgeryBookingMissingRequirements({}, 1), [
      "Select a patient.",
      "Select a clinic.",
    ]);
    const partial = { patientId: PATIENT, clinicId: CLINIC };
    assert.ok(listSurgeryBookingMissingRequirements(partial, 2).includes("Enter a procedure type."));
  });

  it("builds tenant-scoped surgery booking create payload", () => {
    const { tenantScoped } = buildSurgeryBookingCreateParams(baseBody());
    assert.equal(tenantScoped.bookingType, "surgery");
    assert.equal(tenantScoped.patientId, PATIENT);
    assert.equal(tenantScoped.caseId, CASE);
    assert.equal(tenantScoped.assignedStaffId, STAFF);
    assert.equal(tenantScoped.metadata.surgery_booking_engine_v1, true);
    assert.ok(Array.isArray(tenantScoped.metadata.pre_op_checklist));
  });

  it("stores procedure metadata without cross-tenant identifiers in display fields", () => {
    const meta = buildSurgeryBookingMetadata(baseBody(), preOpChecklistDisplayItems(
      buildPreOpChecklistFlagsForBookingDraft(baseBody())
    ));
    assert.equal(meta.technique, "FUE hair transplant");
    assert.equal(meta.graft_count_estimate, "3000");
    assert.equal(meta.surgery_booking_engine_v1, true);
  });

  it("generates pre-op checklist items from draft", () => {
    const items = preOpChecklistDisplayItems(buildPreOpChecklistFlagsForBookingDraft(baseBody()));
    assert.ok(items.some((i) => i.key === "surgeonAssigned" && i.complete));
    assert.ok(items.some((i) => i.key === "caseLinked" && i.complete));
  });
});