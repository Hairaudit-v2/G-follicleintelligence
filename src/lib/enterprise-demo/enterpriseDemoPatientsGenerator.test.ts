import assert from "node:assert/strict";
import test from "node:test";

import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoPatientConsultationSpecs,
  buildEnterpriseDemoPatientEmail,
  ENTERPRISE_DEMO_PATIENTS_PER_CLINIC,
  validateEnterpriseDemoPatientConsultationSpecs,
} from "./enterpriseDemoPatientsGenerator";

test("buildEnterpriseDemoPatientConsultationSpecs produces 240 records (30 per clinic)", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  assert.equal(specs.length, ENTERPRISE_DEMO_CLINICS.length * ENTERPRISE_DEMO_PATIENTS_PER_CLINIC);
});

test("validateEnterpriseDemoPatientConsultationSpecs accepts generated specs", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  const result = validateEnterpriseDemoPatientConsultationSpecs(specs);
  assert.equal(result.ok, true);
});

test("each clinic has 30 unique demo patient keys", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const keys = specs.filter((s) => s.clinicSlug === clinic.slug).map((s) => s.demoPatientKey);
    assert.equal(keys.length, ENTERPRISE_DEMO_PATIENTS_PER_CLINIC);
    assert.equal(new Set(keys).size, ENTERPRISE_DEMO_PATIENTS_PER_CLINIC);
  }
});

test("female patients carry Ludwig or Savin metadata, males carry Norwood", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  for (const spec of specs) {
    if (spec.gender === "female") {
      assert.ok(spec.ludwigScale);
      assert.ok(spec.savinScale);
      assert.equal(spec.norwoodScale, null);
    } else {
      assert.ok(spec.norwoodScale);
      assert.equal(spec.ludwigScale, null);
      assert.equal(spec.savinScale, null);
    }
  }
});

test("quoted consultations include treatment and value", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  const quoted = specs.filter((s) => s.consultationStatus === "quoted");
  assert.ok(quoted.length > 0);
  for (const spec of quoted) {
    assert.ok(spec.quotedTreatment);
    assert.ok(spec.quotedValue != null && spec.quotedValue > 0);
  }
});

test("buildEnterpriseDemoPatientEmail is stable per demo patient key", () => {
  const specs = buildEnterpriseDemoPatientConsultationSpecs();
  const emails = new Set(specs.map((s) => buildEnterpriseDemoPatientEmail(s.demoPatientKey)));
  assert.equal(emails.size, specs.length);
  assert.match(buildEnterpriseDemoPatientEmail("london-central-institute-patient-01"), /^titan\.patient\./);
});
