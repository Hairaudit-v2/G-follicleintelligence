import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { scoreShowcaseFixtureCompleteness } from "@/src/lib/demo-day";
import {
  assertIhrgShowcaseJamesSpecConsistent,
  buildIhrgShowcaseJamesChenSpec,
  totalPlannedGrafts,
} from "./ihrgShowcaseJamesChenModel";

const FIXED_NOW = new Date("2026-08-07T04:00:00.000Z");

describe("ihrgShowcaseJamesChenModel", () => {
  it("builds a consistent Package A spec", () => {
    const spec = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    assert.doesNotThrow(() => assertIhrgShowcaseJamesSpecConsistent(spec));
    assert.equal(spec.keys.patientKey, "showcase-james-chen-v1");
    assert.equal(spec.clinicSlug, "sydney-hair-institute");
    assert.equal(spec.timeZone, "Australia/Sydney");
  });

  it("reconciles graft allocation and finances", () => {
    const spec = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    assert.equal(totalPlannedGrafts(spec.plannedZones), 2800);
    assert.equal(spec.graftTarget, 2800);
    assert.equal(spec.finances.depositCents + spec.finances.balanceCents, spec.finances.quoteCents);
  });

  it("scores the intended fixture excellent at 100", () => {
    const spec = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    const score = scoreShowcaseFixtureCompleteness(spec.intendedFixturePresence);
    assert.equal(score.score, 100);
    assert.equal(score.band, "excellent");
    assert.equal(score.meets_excellent_target, true);
  });

  it("keeps prohibited product brands out of keys", () => {
    const keys = Object.values(buildIhrgShowcaseJamesChenSpec(FIXED_NOW).keys).join(" ");
    for (const prohibited of ["LeadFlow", "HairIntel", "AuditOS", "AcademyOS"]) {
      assert.equal(keys.includes(prohibited), false);
    }
  });

  it("places procedure in the past and outcomes in the future", () => {
    const { schedule } = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    assert.equal(schedule.byId.procedure.isPast, true);
    assert.equal(schedule.byId.observed_outcome_3m.isFuture, true);
    assert.equal(schedule.byId.observed_outcome_6m.isFuture, true);
  });

  it("rebuilds identical keys and calendar dates for the same now", () => {
    const first = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    const second = buildIhrgShowcaseJamesChenSpec(FIXED_NOW);
    assert.deepEqual(first.keys, second.keys);
    assert.deepEqual(
      first.schedule.milestones.map(({ id, ymd }) => ({ id, ymd })),
      second.schedule.milestones.map(({ id, ymd }) => ({ id, ymd }))
    );
  });
});
