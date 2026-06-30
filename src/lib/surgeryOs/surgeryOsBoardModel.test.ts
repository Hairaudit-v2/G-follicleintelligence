import assert from "node:assert/strict";
import test from "node:test";

import {
  computeReadinessPercent,
  computeReadinessRiskLevel,
  deriveSurgeryAlerts,
  visibleWidgetsForSurgeryOsRole,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";

test("computeReadinessPercent counts completed checklist items", () => {
  assert.equal(computeReadinessPercent({ deposit_paid: true, consent_signed: true }), 22);
  assert.equal(
    computeReadinessPercent({
      deposit_paid: true,
      consent_signed: true,
      photography_complete: true,
      bloods_complete: true,
      medication_prepared: true,
      prp_prepared: true,
      exosomes_prepared: true,
      staff_assigned: true,
      consumables_ready: true,
    }),
    100
  );
});

test("computeReadinessRiskLevel blocks when consent or deposit missing", () => {
  assert.equal(
    computeReadinessRiskLevel({ consent_signed: false, deposit_paid: true }, 80),
    "blocked"
  );
  assert.equal(computeReadinessRiskLevel({ consent_signed: true, deposit_paid: true }, 95), "low");
});

test("deriveSurgeryAlerts surfaces missing consent as blocked", () => {
  const alerts = deriveSurgeryAlerts({
    surgeryId: "00000000-0000-4000-8000-000000000001",
    patientLabel: "Test Patient",
    checklist: { consent_signed: false, deposit_paid: true },
    readinessRiskLevel: "blocked",
    liveStatus: "waiting",
    scheduledStartAt: null,
    nowMs: Date.now(),
    teamUnavailableCount: 0,
    hrefs: { patient: null, case: null, surgery: null },
  });
  assert.ok(alerts.some((a) => a.kind === "missing_consent" && a.severity === "blocked"));
});

test("visibleWidgetsForSurgeryOsRole returns persona defaults", () => {
  assert.ok(visibleWidgetsForSurgeryOsRole("surgeon").includes("live_procedure_timeline"));
  assert.ok(visibleWidgetsForSurgeryOsRole("surgeon").includes("live_graft_intelligence"));
  assert.ok(visibleWidgetsForSurgeryOsRole("admin").includes("surgical_notes_events"));
});
