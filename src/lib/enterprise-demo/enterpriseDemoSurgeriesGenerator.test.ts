import assert from "node:assert/strict";
import test from "node:test";

import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoPatientConsultationSpecs,
} from "./enterpriseDemoPatientsGenerator";
import {
  buildEnterpriseDemoSurgerySpecs,
  ENTERPRISE_DEMO_SURGERIES_PER_CLINIC,
  ENTERPRISE_DEMO_TOTAL_SURGERIES,
  validateEnterpriseDemoSurgerySpecs,
} from "./enterpriseDemoSurgeriesGenerator";

test("buildEnterpriseDemoSurgerySpecs produces 96 surgeries (12 per clinic)", () => {
  const specs = buildEnterpriseDemoSurgerySpecs();
  assert.equal(specs.length, ENTERPRISE_DEMO_TOTAL_SURGERIES);
  assert.equal(specs.length, ENTERPRISE_DEMO_CLINICS.length * ENTERPRISE_DEMO_SURGERIES_PER_CLINIC);
});

test("validateEnterpriseDemoSurgerySpecs accepts generated specs", () => {
  const specs = buildEnterpriseDemoSurgerySpecs();
  const result = validateEnterpriseDemoSurgerySpecs(specs);
  assert.equal(result.ok, true);
});

test("surgery specs use unique demo keys", () => {
  const specs = buildEnterpriseDemoSurgerySpecs();
  const surgeryKeys = new Set(specs.map((s) => s.demoSurgeryKey));
  const caseKeys = new Set(specs.map((s) => s.demoCaseKey));
  const bookingKeys = new Set(specs.map((s) => s.demoBookingKey));
  assert.equal(surgeryKeys.size, specs.length);
  assert.equal(caseKeys.size, specs.length);
  assert.equal(bookingKeys.size, specs.length);
});

test("each clinic surgery maps to quoted, accepted, or converted consultation patients", () => {
  const patientSpecs = buildEnterpriseDemoPatientConsultationSpecs();
  const surgerySpecs = buildEnterpriseDemoSurgerySpecs(patientSpecs);

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const clinicSurgeries = surgerySpecs.filter((s) => s.clinicSlug === clinic.slug);
    assert.equal(clinicSurgeries.length, ENTERPRISE_DEMO_SURGERIES_PER_CLINIC);

    for (const surgery of clinicSurgeries) {
      const patient = patientSpecs.find((p) => p.demoPatientKey === surgery.demoPatientKey);
      assert.ok(patient, `missing patient for ${surgery.demoPatientKey}`);
      assert.ok(
        ["quoted", "accepted", "converted_to_case"].includes(patient.consultationStatus),
        `unexpected consultation status ${patient.consultationStatus}`
      );
      assert.ok(patient.patientIndex >= clinicSurgeries.length, `expected late-funnel patient index for ${surgery.demoPatientKey}`);
      assert.equal(surgery.leadSurgeonStaffKey, `${clinic.slug}-lead-surgeon`);
      assert.equal(surgery.team.length, 3);
    }
  }
});

test("anomaly clinics carry expected performance profiles", () => {
  const specs = buildEnterpriseDemoSurgerySpecs();
  const london = specs.filter((s) => s.clinicSlug === "london-central-institute");
  const bangkok = specs.filter((s) => s.clinicSlug === "bangkok-restoration-centre");
  const dubai = specs.filter((s) => s.clinicSlug === "dubai-hair-institute");
  const sydney = specs.filter((s) => s.clinicSlug === "sydney-hair-institute");

  assert.ok(london.every((s) => s.performanceProfile === "elevated_transection"));
  assert.ok(london.some((s) => s.transectionRatePercent != null && s.transectionRatePercent >= 12));

  assert.ok(bangkok.some((s) => s.graftSession?.skipReconciliationEvent));
  assert.ok(bangkok.some((s) => s.graftSession?.reconciliationStatus === "pending" || s.graftSession?.reconciliationStatus === "mismatch"));

  assert.ok(dubai.every((s) => s.performanceProfile === "graft_count_vs_quote"));
  assert.ok(dubai.some((s) => s.invoiceGraftPlaceholder != null));

  assert.ok(sydney.every((s) => s.performanceProfile === "benchmark"));
  assert.ok(sydney.every((s) => !s.graftSession?.skipReconciliationEvent || s.graftSession == null));
});

test("graft sessions include count, tray, and reconciliation events when active", () => {
  const specs = buildEnterpriseDemoSurgerySpecs();
  const withGraft = specs.filter((s) => s.graftSession != null);
  assert.ok(withGraft.length > 0);

  for (const spec of withGraft) {
    const session = spec.graftSession!;
    assert.ok(session.events.some((e) => e.eventType === "count_update"));
    assert.ok(session.events.some((e) => e.eventType === "tray_count"));
    assert.ok(session.events.some((e) => e.eventType === "tray_confirmed"));
    if (!session.skipReconciliationEvent && spec.surgeryStatus === "completed") {
      assert.ok(session.events.some((e) => e.eventType === "graft_reconciliation"));
    }
  }
});
