import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SHOWCASE_COMPLETENESS_EXCELLENT_MIN,
  SHOWCASE_CATEGORY_WEIGHTS,
  SHOWCASE_INTELLIGENCE_CATEGORIES,
  SHOWCASE_JAMES_CHEN_AGE_YEARS,
  SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
  SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE,
  SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET,
  SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  SHOWCASE_JAMES_CHEN_SEX,
  SHOWCASE_JAMES_CHEN_STAGING_LABEL,
  SHOWCASE_LIFECYCLE_MILESTONE_SPECS,
  SHOWCASE_PACKAGE_A,
  SHOWCASE_PACKAGE_B,
  SHOWCASE_TIMEZONE,
  assertShowcaseTimezoneAligned,
  buildShowcaseIdempotencyKeys,
  buildShowcaseMilestoneSchedule,
  buildShowcaseScheduleForPackage,
  createShowcaseTimelineAnchor,
  emptyShowcaseFixturePresence,
  fullShowcaseFixturePresence,
  isShowcaseJamesChenPatientKey,
  minimalExcellentShowcaseFixturePresence,
  orderShowcaseMilestonesByInstant,
  scoreShowcaseFixtureCompleteness,
  showcaseAnchorYmd,
  showcaseBirthDateYmd,
  showcaseInstantAtDayOffset,
  showcaseAddMonthsPreservingDay,
  showcasePackageConfig,
  showcasePatientMetadataFragment,
  showcaseSchedulesEqual,
  showcaseYmdAtDayOffset,
  signedDayDeltaBetweenYmd,
} from "./index";

const FIXED_NOW = new Date("2026-08-07T04:00:00.000Z"); // mid-morning Sydney on Demo Day

describe("showcaseJamesChenConstants", () => {
  it("keeps one stable James Chen identity across packages", () => {
    assert.equal(SHOWCASE_JAMES_CHEN_DISPLAY_NAME, "James Chen");
    assert.equal(SHOWCASE_JAMES_CHEN_AGE_YEARS, 42);
    assert.equal(SHOWCASE_JAMES_CHEN_SEX, "male");
    assert.equal(SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE, "3V");
    assert.equal(SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET, "4");
    assert.equal(SHOWCASE_JAMES_CHEN_STAGING_LABEL, "Norwood 3V–4");
    assert.equal(SHOWCASE_PACKAGE_A.patientKey, SHOWCASE_JAMES_CHEN_PATIENT_KEY);
    assert.equal(SHOWCASE_PACKAGE_B.patientKey, SHOWCASE_JAMES_CHEN_PATIENT_KEY);
    assert.equal(SHOWCASE_PACKAGE_A.patientKeyField, "demo_patient_key");
    assert.equal(SHOWCASE_PACKAGE_B.patientKeyField, "clinic_demo_patient_key");
  });

  it("uses Australia/Sydney for both packages with no alternate zones", () => {
    assert.equal(SHOWCASE_TIMEZONE, "Australia/Sydney");
    assertShowcaseTimezoneAligned();
    assert.equal(showcasePackageConfig("A").timeZone, "Australia/Sydney");
    assert.equal(showcasePackageConfig("B").timeZone, "Australia/Sydney");
    assert.equal(SHOWCASE_PACKAGE_A.clinicSlug, "sydney-hair-institute");
    assert.equal(SHOWCASE_PACKAGE_B.tenantSlug, "follicle-demo-clinic");
  });

  it("idempotency keys are stable across re-runs and distinct per package prefix", () => {
    const a1 = buildShowcaseIdempotencyKeys("A");
    const a2 = buildShowcaseIdempotencyKeys("A");
    const b1 = buildShowcaseIdempotencyKeys("B");
    assert.deepEqual(a1, a2);
    assert.equal(a1.patientKey, b1.patientKey);
    assert.notEqual(a1.caseKey, b1.caseKey);
    assert.match(a1.caseKey, /^ihrg-/);
    assert.match(b1.caseKey, /^clinic-/);
    assert.equal(isShowcaseJamesChenPatientKey(a1.patientKey), true);
    assert.equal(isShowcaseJamesChenPatientKey("someone-else"), false);
  });

  it("patient metadata fragment carries Norwood 3V–4 and age 42", () => {
    const meta = showcasePatientMetadataFragment("A");
    assert.equal(meta.demo_patient_key, SHOWCASE_JAMES_CHEN_PATIENT_KEY);
    assert.equal(meta.showcase_age_years, 42);
    assert.equal(meta.showcase_norwood_baseline, "3V");
    assert.equal(meta.showcase_norwood_plan_target, "4");
    assert.equal(meta.enterprise_demo_showcase, true);
  });

  it("does not introduce prohibited product brands in canonical strings", () => {
    const prohibited = ["LeadFlow", "HairIntel", "AuditOS", "AcademyOS"];
    const corpus = [
      SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
      SHOWCASE_JAMES_CHEN_PATIENT_KEY,
      SHOWCASE_JAMES_CHEN_STAGING_LABEL,
      SHOWCASE_PACKAGE_A.showcaseFlag,
      SHOWCASE_PACKAGE_B.showcaseFlag,
      ...Object.values(buildShowcaseIdempotencyKeys("A")),
      ...Object.values(buildShowcaseIdempotencyKeys("B")),
    ].join(" ");
    for (const brand of prohibited) {
      assert.equal(corpus.includes(brand), false, `must not contain ${brand}`);
    }
  });
});

describe("showcaseTimeline", () => {
  it("resolves Demo Day from the anchor — not a hard-coded calendar today", () => {
    const anchor = createShowcaseTimelineAnchor(FIXED_NOW);
    assert.equal(showcaseAnchorYmd(anchor), "2026-08-07");
    assert.equal(showcaseYmdAtDayOffset(anchor, -7), "2026-07-31");
    assert.equal(showcaseYmdAtDayOffset(anchor, 1), "2026-08-08");
  });

  it("rejects non-Sydney timezones for the James Chen spine", () => {
    assert.throws(() => createShowcaseTimelineAnchor(FIXED_NOW, "UTC"), /Australia\/Sydney/);
    assert.throws(() => createShowcaseTimelineAnchor(FIXED_NOW, "Europe/London"), /Australia\/Sydney/);
  });

  it("handles Australia/Sydney DST boundaries around day offsets", () => {
    // AEDT→AEST transition historically early April; AEST→AEDT early October.
    const april = createShowcaseTimelineAnchor(new Date("2026-04-05T04:00:00.000Z"));
    const oct = createShowcaseTimelineAnchor(new Date("2026-10-04T04:00:00.000Z"));
    assert.equal(showcaseAnchorYmd(april), "2026-04-05");
    assert.equal(showcaseAnchorYmd(oct), "2026-10-04");
    // Crossing the October forward shift by calendar days must still land consecutive YMD.
    assert.equal(showcaseYmdAtDayOffset(oct, -1), "2026-10-03");
    assert.equal(showcaseYmdAtDayOffset(oct, 1), "2026-10-05");
    const iso = showcaseInstantAtDayOffset(oct, 0, 9, 0);
    assert.match(iso, /T\d{2}:\d{2}:\d{2}/);
    // Instant must serialize as valid UTC ISO
    assert.equal(Number.isNaN(Date.parse(iso)), false);
  });

  it("birth date makes James exactly age 42 on Demo Day", () => {
    const anchor = createShowcaseTimelineAnchor(FIXED_NOW);
    assert.equal(showcaseBirthDateYmd(anchor), "1984-08-07");
  });

  it("addMonths preserves day-of-month and clamps end-of-month", () => {
    assert.equal(
      showcaseAddMonthsPreservingDay("2026-07-31", 3, SHOWCASE_TIMEZONE),
      "2026-10-31"
    );
    assert.equal(
      showcaseAddMonthsPreservingDay("2026-01-31", 1, SHOWCASE_TIMEZONE),
      "2026-02-28"
    );
    assert.equal(
      showcaseAddMonthsPreservingDay("2024-01-31", 1, SHOWCASE_TIMEZONE),
      "2024-02-29"
    );
  });

  it("schedule includes past procedure and future observed outcomes", () => {
    const schedule = buildShowcaseMilestoneSchedule(createShowcaseTimelineAnchor(FIXED_NOW));
    const procedure = schedule.byId.procedure;
    const outcome3m = schedule.byId.observed_outcome_3m;
    const outcome6m = schedule.byId.observed_outcome_6m;
    assert.equal(procedure.isPast, true);
    assert.equal(procedure.ymd, "2026-07-31");
    assert.equal(outcome3m.isFuture, true);
    assert.equal(outcome6m.isFuture, true);
    assert.ok(outcome3m.ymd > procedure.ymd);
    assert.ok(outcome6m.ymd > outcome3m.ymd);
    assert.equal(outcome3m.ymd, "2026-10-31");
    assert.equal(outcome6m.ymd, "2027-01-31");
  });

  it("milestone ordering is chronological by instant", () => {
    const schedule = buildShowcaseMilestoneSchedule(createShowcaseTimelineAnchor(FIXED_NOW));
    const ordered = orderShowcaseMilestonesByInstant(schedule.milestones);
    for (let i = 1; i < ordered.length; i++) {
      assert.ok(
        ordered[i - 1]!.iso <= ordered[i]!.iso,
        `${ordered[i - 1]!.id} should be <= ${ordered[i]!.id}`
      );
    }
    assert.equal(ordered[0]!.id, "lead");
    assert.ok(ordered.some((m) => m.id === "observed_outcome_6m"));
  });

  it("re-running schedule builders for the same anchor is duplicate-free and identical", () => {
    const anchor = createShowcaseTimelineAnchor(FIXED_NOW);
    const s1 = buildShowcaseMilestoneSchedule(anchor);
    const s2 = buildShowcaseMilestoneSchedule(anchor);
    const sA = buildShowcaseScheduleForPackage("A", FIXED_NOW);
    const sB = buildShowcaseScheduleForPackage("B", FIXED_NOW);
    assert.equal(showcaseSchedulesEqual(s1, s2), true);
    assert.equal(showcaseSchedulesEqual(sA, sB), true);
    const ids = s1.milestones.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(ids.length, SHOWCASE_LIFECYCLE_MILESTONE_SPECS.length);
  });

  it("signed day deltas match absolute offsets", () => {
    const anchor = createShowcaseTimelineAnchor(FIXED_NOW);
    const ymd = showcaseAnchorYmd(anchor);
    assert.equal(signedDayDeltaBetweenYmd(ymd, showcaseYmdAtDayOffset(anchor, -90), SHOWCASE_TIMEZONE), -90);
    assert.equal(signedDayDeltaBetweenYmd(ymd, showcaseYmdAtDayOffset(anchor, 5), SHOWCASE_TIMEZONE), 5);
  });
});

describe("showcaseFixtureCompleteness", () => {
  it("weights sum to 100 across eight intelligence categories", () => {
    assert.equal(SHOWCASE_INTELLIGENCE_CATEGORIES.length, 8);
    const total = SHOWCASE_INTELLIGENCE_CATEGORIES.reduce(
      (sum, c) => sum + SHOWCASE_CATEGORY_WEIGHTS[c],
      0
    );
    assert.equal(total, 100);
    assert.equal(SHOWCASE_COMPLETENESS_EXCELLENT_MIN, 85);
  });

  it("empty fixture is poor; full fixture is excellent 100", () => {
    const empty = scoreShowcaseFixtureCompleteness(emptyShowcaseFixturePresence());
    assert.equal(empty.score, 0);
    assert.equal(empty.band, "poor");
    assert.equal(empty.meets_excellent_target, false);
    assert.equal(empty.missing.length, 8);

    const full = scoreShowcaseFixtureCompleteness(fullShowcaseFixturePresence());
    assert.equal(full.score, 100);
    assert.equal(full.band, "excellent");
    assert.equal(full.meets_excellent_target, true);
    assert.equal(full.missing.length, 0);
  });

  it("minimal excellent presence clears ≥ 85 threshold", () => {
    const result = scoreShowcaseFixtureCompleteness(minimalExcellentShowcaseFixturePresence());
    assert.equal(result.score, 90);
    assert.equal(result.band, "excellent");
    assert.equal(result.meets_excellent_target, true);
    assert.deepEqual(result.missing, ["treatment"]);
  });

  it("dropping two 15-point categories falls below excellent", () => {
    const presence = {
      ...fullShowcaseFixturePresence(),
      baseline: false,
      outcomes: false,
    };
    const result = scoreShowcaseFixtureCompleteness(presence);
    assert.equal(result.score, 70);
    assert.equal(result.band, "good");
    assert.equal(result.meets_excellent_target, false);
  });

  it("band thresholds: 84 good, 85 excellent, 65 good, 40 partial", () => {
    assert.equal(scoreShowcaseFixtureCompleteness({
      ...fullShowcaseFixturePresence(),
      treatment: false,
      economics: false,
      // 100 - 10 - 10 = 80
    }).band, "good");

    // Craft exactly 85: drop treatment(10) + half? weights are discrete.
    // 100 - 15 = 85 by dropping outcomes only.
    const at85 = scoreShowcaseFixtureCompleteness({
      ...fullShowcaseFixturePresence(),
      outcomes: false,
    });
    assert.equal(at85.score, 85);
    assert.equal(at85.band, "excellent");
  });
});
