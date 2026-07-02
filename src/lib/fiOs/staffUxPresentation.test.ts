import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PatientJourneyState } from "@/src/lib/patientJourney/patientJourneyStateCore";
import {
  deriveReceptionAppointmentPriority,
  humanizeReceptionActionAlert,
  humanizeSurgeryBookingRequirement,
  patientJourneyProgressPercent,
  patientJourneyPipelineIndex,
} from "./staffUxPresentation";

describe("staffUxPresentation", () => {
  it("maps journey states to pipeline progress", () => {
    assert.equal(patientJourneyPipelineIndex("lead"), 0);
    assert.equal(patientJourneyPipelineIndex("deposit_paid"), 2);
    assert.equal(patientJourneyPipelineIndex("procedure_completed"), 4);
    assert.equal(patientJourneyProgressPercent("completed"), 100);
  });

  it("derives reception priority from payment and confirmation", () => {
    assert.equal(
      deriveReceptionAppointmentPriority({
        paymentStatus: "overdue",
        confirmationStatus: "confirmed",
        status: "scheduled",
        appointmentType: "Consultation",
      }),
      "critical"
    );
    assert.equal(
      deriveReceptionAppointmentPriority({
        paymentStatus: "paid",
        confirmationStatus: "confirmed",
        status: "checked_in",
        appointmentType: "Consultation",
      }),
      "ready"
    );
  });

  it("humanizes reception consent alerts", () => {
    const out = humanizeReceptionActionAlert({
      id: "a1",
      kind: "missing_consent",
      title: "Missing consent",
      detail: "Jane Doe · Surgery",
      severity: "critical",
      href: "/calendar",
      priorityScore: 90,
    });
    assert.match(out.title, /consent form missing/i);
  });

  it("humanizes surgery room requirement without changing engine strings", () => {
    assert.match(
      humanizeSurgeryBookingRequirement("Select a procedure room."),
      /assign a surgical room/i
    );
  });

  it("progress percent increases monotonically across pipeline", () => {
    const states: PatientJourneyState[] = [
      "lead",
      "consult_booked",
      "deposit_paid",
      "surgery_booked",
      "procedure_completed",
      "completed",
    ];
    let prev = -1;
    for (const st of states) {
      const p = patientJourneyProgressPercent(st);
      assert.ok(p >= prev);
      prev = p;
    }
  });
});