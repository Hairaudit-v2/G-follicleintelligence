import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  buildShowcaseIdempotencyKeys,
} from "@/src/lib/demo-day";
import { scoreShowcaseFixtureCompleteness } from "@/src/lib/demo-day";
import { totalPlannedGrafts } from "@/src/lib/ihrg-demo/ihrgShowcaseJamesChenModel";
import {
  assertClinicShowcaseJamesSpecConsistent,
  buildClinicShowcaseJamesChenSpec,
  CLINIC_SHOWCASE_JAMES_STAFF_KEYS,
} from "./clinicDemoShowcaseJamesChenModel";

const FIXED_NOW = new Date("2026-08-07T04:00:00.000Z");

describe("clinicDemoShowcaseJamesChenModel", () => {
  it("builds a consistent Package B spec with shared canonical patient key", () => {
    const spec = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    assert.doesNotThrow(() => assertClinicShowcaseJamesSpecConsistent(spec));
    assert.equal(spec.keys.patientKey, SHOWCASE_JAMES_CHEN_PATIENT_KEY);
    assert.equal(spec.packageCode, "B");
    assert.equal(spec.clinicSlug, "follicle-demo-clinic");
    assert.equal(spec.timeZone, "Australia/Sydney");
    assert.equal(spec.identity.ageYears, 42);
    assert.equal(spec.identity.norwoodBaseline, "3V");
    assert.equal(spec.identity.norwoodPlanTarget, "4");
  });

  it("uses clinic- prefixed tenant-isolated keys distinct from Package A", () => {
    const b = buildShowcaseIdempotencyKeys("B");
    const a = buildShowcaseIdempotencyKeys("A");
    assert.equal(b.patientKey, a.patientKey);
    assert.notEqual(b.caseKey, a.caseKey);
    assert.match(b.caseKey, /^clinic-/);
    assert.match(a.caseKey, /^ihrg-/);
    assert.equal(b.bookingKey.includes("demo_day_key"), false);
  });

  it("reconciles graft allocation and finances", () => {
    const spec = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    assert.equal(totalPlannedGrafts(spec.plannedZones), 2800);
    assert.equal(spec.graftTarget, 2800);
    assert.equal(spec.finances.depositCents + spec.finances.balanceCents, spec.finances.quoteCents);
  });

  it("scores the intended fixture excellent at 100", () => {
    const spec = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    const score = scoreShowcaseFixtureCompleteness(spec.intendedFixturePresence);
    assert.equal(score.score, 100);
    assert.equal(score.band, "excellent");
  });

  it("keeps prohibited product brands out of keys and staff ids", () => {
    const corpus = [
      ...Object.values(buildClinicShowcaseJamesChenSpec(FIXED_NOW).keys),
      ...Object.values(CLINIC_SHOWCASE_JAMES_STAFF_KEYS),
    ].join(" ");
    for (const prohibited of ["LeadFlow", "HairIntel", "AuditOS", "AcademyOS"]) {
      assert.equal(corpus.includes(prohibited), false);
    }
  });

  it("places procedure in the past and outcomes in the future", () => {
    const { schedule } = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    assert.equal(schedule.byId.procedure.isPast, true);
    assert.equal(schedule.byId.observed_outcome_3m.isFuture, true);
    assert.equal(schedule.byId.observed_outcome_6m.isFuture, true);
  });

  it("rebuilds identical keys and calendar dates for the same now", () => {
    const first = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    const second = buildClinicShowcaseJamesChenSpec(FIXED_NOW);
    assert.deepEqual(first.keys, second.keys);
    assert.deepEqual(
      first.schedule.milestones.map(({ id, ymd }) => ({ id, ymd })),
      second.schedule.milestones.map(({ id, ymd }) => ({ id, ymd }))
    );
  });
});
