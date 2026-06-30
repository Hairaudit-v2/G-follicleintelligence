import assert from "node:assert/strict";
import test from "node:test";

import type { DoctorWorkspaceBundle } from "@/src/lib/doctorOs/doctorWorkspaceLoader.server";
import {
  buildDoctorClinicalTimeline,
  buildDoctorPatientReviewQueue,
  buildDoctorPrescriptionWorkspace,
  buildDoctorPriorities,
  buildDoctorSnapshotCards,
  buildDoctorTreatmentApprovals,
  doctorWorkspaceDiagnosticCounts,
} from "@/src/lib/fiAdmin/doctorWorkspacePresentation";

function emptyBundle(overrides: Partial<DoctorWorkspaceBundle> = {}): DoctorWorkspaceBundle {
  return {
    tenantId: "tenant-1",
    todayPatients: [],
    pendingConsultations: [],
    draftPrescriptionsInProgress: [],
    prescriptionsAwaitingSignature: [],
    pharmacyQueue: [],
    medicationReorders: [],
    followUpTasks: [],
    voiceNotesPendingApproval: [],
    includeCrmTasks: false,
    ...overrides,
  };
}

test("buildDoctorSnapshotCards returns six cards", () => {
  const cards = buildDoctorSnapshotCards("/fi-admin/t", emptyBundle());
  assert.equal(cards.length, 6);
  assert.equal(cards[0].label, "Patients awaiting doctor review");
});

test("buildDoctorPriorities ranks prescription sign-off highest", () => {
  const bundle = emptyBundle({
    prescriptionsAwaitingSignature: [
      {
        id: "rx-1",
        patientId: "p-1",
        patientLabel: "Jane Doe",
        updatedAt: "2026-06-23T09:00:00.000Z",
        statusLabel: "Draft",
      },
    ],
    pendingConsultations: [
      {
        id: "c-1",
        subject_line: "Consult",
        consultation_type_label: "Initial",
        status: "draft",
        updated_at: "2026-06-23T08:00:00.000Z",
        patient_id: "p-2",
      } as DoctorWorkspaceBundle["pendingConsultations"][number],
    ],
  });
  const items = buildDoctorPriorities("/fi-admin/t", bundle, 3);
  assert.equal(items.length, 2);
  assert.equal(items[0].id, "prescription_sign");
});

test("buildDoctorPatientReviewQueue deduplicates by patient name", () => {
  const bundle = emptyBundle({
    prescriptionsAwaitingSignature: [
      {
        id: "rx-1",
        patientId: "p-1",
        patientLabel: "Jane Doe",
        updatedAt: "2026-06-23T09:00:00.000Z",
        statusLabel: "Draft",
      },
      {
        id: "rx-2",
        patientId: "p-1",
        patientLabel: "Jane Doe",
        updatedAt: "2026-06-23T10:00:00.000Z",
        statusLabel: "Draft",
      },
    ],
  });
  const queue = buildDoctorPatientReviewQueue("/fi-admin/t", bundle);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].patientName, "Jane Doe");
});

test("buildDoctorPrescriptionWorkspace detects no actions when empty", () => {
  const model = buildDoctorPrescriptionWorkspace("/fi-admin/t", emptyBundle(), [], new Map());
  assert.equal(model.hasAnyActions, false);
  assert.equal(model.awaitingApproval.length, 0);
});

test("buildDoctorTreatmentApprovals filters zero counts", () => {
  const items = buildDoctorTreatmentApprovals("/fi-admin/t", emptyBundle());
  assert.equal(items.length, 0);
});

test("buildDoctorClinicalTimeline sorts by recency", () => {
  const bundle = emptyBundle({
    pendingConsultations: [
      {
        id: "c-old",
        subject_line: "Old",
        consultation_type_label: "Follow-up",
        status: "draft",
        updated_at: "2026-06-23T08:00:00.000Z",
        patient_id: "p-1",
      } as DoctorWorkspaceBundle["pendingConsultations"][number],
      {
        id: "c-new",
        subject_line: "New",
        consultation_type_label: "Initial",
        status: "in_progress",
        updated_at: "2026-06-23T11:00:00.000Z",
        patient_id: "p-2",
      } as DoctorWorkspaceBundle["pendingConsultations"][number],
    ],
  });
  const timeline = buildDoctorClinicalTimeline("/fi-admin/t", bundle, [], new Map());
  assert.ok(timeline.length >= 2);
  assert.equal(timeline[0].id, "tl-consult-c-new");
});

test("doctorWorkspaceDiagnosticCounts aggregates bundle lengths", () => {
  const counts = doctorWorkspaceDiagnosticCounts(
    emptyBundle({
      todayPatients: [
        {
          patientId: "p",
          patientLabel: "P",
          nextStartAt: "",
          bookingId: "b",
          bookingTitle: null,
          bookingType: "consultation",
        },
      ],
    })
  );
  assert.equal(counts.todayPatients, 1);
});
