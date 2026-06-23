import assert from "node:assert/strict";
import test from "node:test";

import type { PatientDirectorySummary } from "@/src/lib/patients/patientDirectoryLoader";
import type { PatientOsOverviewModel } from "@/src/lib/patients/patientOsDashboardLoader.server";
import {
  buildPatientAttentionPriorities,
  buildPatientJourneyHealthCards,
  buildActivePatientJourneyItems,
  hasUrgentPatientAttention,
} from "@/src/lib/fiAdmin/patientPresentation";

const base = "/fi-admin/t-1";

function summary(overrides: Partial<PatientDirectorySummary> = {}): PatientDirectorySummary {
  return {
    totalPatients: 10,
    activePatients: 8,
    withActiveCase: 3,
    withFutureBooking: 2,
    ...overrides,
  };
}

function overview(overrides: Partial<PatientOsOverviewModel> = {}): PatientOsOverviewModel {
  return {
    kpis: {
      totalPatients: 10,
      recentlyAddedPatients: 2,
      patientsWithActiveCases: 3,
      patientsWithUpcomingBookings: 2,
      patientsNeedingFollowUp: 0,
    },
    recentPatients: [],
    activeJourneys: [],
    upcomingBookings: [],
    timelineHighlights: [],
    ...overrides,
  };
}

test("buildPatientJourneyHealthCards returns six clinic-facing cards", () => {
  const cards = buildPatientJourneyHealthCards(base, overview(), summary());
  assert.equal(cards.length, 6);
  assert.ok(cards.some((c) => c.id === "active"));
  assert.ok(cards.some((c) => c.id === "followups"));
});

test("buildPatientAttentionPriorities is calm when no signals", () => {
  const items = buildPatientAttentionPriorities(
    base,
    overview(),
    summary({ withActiveCase: 2, withFutureBooking: 2 })
  );
  assert.equal(items.length, 0);
  assert.equal(hasUrgentPatientAttention(items), false);
});

test("buildPatientAttentionPriorities ranks follow-ups highest", () => {
  const items = buildPatientAttentionPriorities(
    base,
    overview({
      kpis: {
        totalPatients: 10,
        recentlyAddedPatients: 0,
        patientsWithActiveCases: 3,
        patientsWithUpcomingBookings: 2,
        patientsNeedingFollowUp: 4,
      },
    }),
    summary()
  );
  assert.ok(items.length > 0);
  assert.equal(items[0]?.id, "followups_due");
  assert.equal(hasUrgentPatientAttention(items), true);
});

test("buildActivePatientJourneyItems maps surgery pathway patients", () => {
  const items = buildActivePatientJourneyItems(
    base,
    overview({
      activeJourneys: [
        {
          patientId: "p-1",
          caseId: "c-1",
          displayName: "Jane Doe",
          caseStatus: "submitted",
          caseStatusLabel: "submitted",
          updatedAt: "2026-06-23T10:00:00.000Z",
        },
      ],
      upcomingBookings: [
        {
          bookingId: "b-1",
          patientId: "p-1",
          startAt: "2026-06-24T09:00:00.000Z",
          title: "Pre-op review",
          bookingStatus: "confirmed",
          displayName: "Jane Doe",
        },
      ],
    })
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.journeyStage, "surgery_preparation");
  assert.match(items[0]?.nextStepLabel ?? "", /Next visit/);
});
