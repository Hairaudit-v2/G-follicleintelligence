/**
 * FI-DEMO-DAY-2A.2 — Pure Package A (IHRG / Sydney) specs for James Chen.
 * No DB I/O.
 */

import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";
import {
  defaultHairlineGeometry,
  type HairlineGeometry,
} from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import {
  SHOWCASE_JAMES_CHEN_AGE_YEARS,
  SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
  SHOWCASE_JAMES_CHEN_FAMILY_NAME,
  SHOWCASE_JAMES_CHEN_GIVEN_NAME,
  SHOWCASE_JAMES_CHEN_LEAD_SOURCE,
  SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE,
  SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET,
  SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  SHOWCASE_JAMES_CHEN_SEX,
  SHOWCASE_JAMES_CHEN_STAGING_LABEL,
  SHOWCASE_PACKAGE_A,
  SHOWCASE_TIMEZONE,
  buildShowcaseIdempotencyKeys,
  showcasePatientMetadataFragment,
  type ShowcaseIdempotencyKeys,
} from "@/src/lib/demo-day/showcaseJamesChenConstants";
import {
  fullShowcaseFixturePresence,
  type ShowcaseFixturePresence,
} from "@/src/lib/demo-day/showcaseFixtureCompleteness";
import {
  buildShowcaseMilestoneSchedule,
  createShowcaseTimelineAnchor,
  showcaseBirthDateYmd,
  type ShowcaseMilestoneSchedule,
  type ShowcaseTimelineAnchor,
} from "@/src/lib/demo-day/showcaseTimeline";

export const IHRG_SHOWCASE_JAMES_CLINIC_SLUG = SHOWCASE_PACKAGE_A.clinicSlug;
export const IHRG_SHOWCASE_JAMES_EMAIL = "james.chen.showcase@follicleintelligence.demo" as const;

export const IHRG_SHOWCASE_JAMES_STAFF_KEYS = {
  consultant: "sydney-hair-institute-consultant",
  surgeon: "sydney-hair-institute-lead-surgeon",
  nurse: "sydney-hair-institute-lead-nurse",
  technician: "sydney-hair-institute-technician",
} as const;

export const IHRG_SHOWCASE_JAMES_GRAFT_TARGET = 2800 as const;
export const IHRG_SHOWCASE_JAMES_QUOTE_CENTS = 1_800_000 as const;
export const IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS = 450_000 as const;
export const IHRG_SHOWCASE_JAMES_BALANCE_CENTS = 1_350_000 as const;

export const IHRG_SHOWCASE_JAMES_IMAGE_SLOTS = [
  "front",
  "left",
  "right",
  "top",
  "crown",
  "donor",
  "immediate_post_op",
  "graft_tray",
  "3_month",
  "6_month",
] as const;

export type IhrgShowcaseJamesImageSlot = (typeof IHRG_SHOWCASE_JAMES_IMAGE_SLOTS)[number];

export type IhrgShowcaseJamesChenSpec = {
  packageCode: "A";
  clinicSlug: typeof IHRG_SHOWCASE_JAMES_CLINIC_SLUG;
  timeZone: typeof SHOWCASE_TIMEZONE;
  keys: ShowcaseIdempotencyKeys;
  identity: {
    displayName: typeof SHOWCASE_JAMES_CHEN_DISPLAY_NAME;
    givenName: typeof SHOWCASE_JAMES_CHEN_GIVEN_NAME;
    familyName: typeof SHOWCASE_JAMES_CHEN_FAMILY_NAME;
    email: typeof IHRG_SHOWCASE_JAMES_EMAIL;
    ageYears: typeof SHOWCASE_JAMES_CHEN_AGE_YEARS;
    sex: typeof SHOWCASE_JAMES_CHEN_SEX;
    birthDateYmd: string;
    leadSource: typeof SHOWCASE_JAMES_CHEN_LEAD_SOURCE;
    norwoodBaseline: typeof SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE;
    norwoodPlanTarget: typeof SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET;
    stagingLabel: typeof SHOWCASE_JAMES_CHEN_STAGING_LABEL;
    ageBand: "40-44";
  };
  staffKeys: typeof IHRG_SHOWCASE_JAMES_STAFF_KEYS;
  graftTarget: typeof IHRG_SHOWCASE_JAMES_GRAFT_TARGET;
  finances: {
    currency: "AUD";
    quoteCents: typeof IHRG_SHOWCASE_JAMES_QUOTE_CENTS;
    depositCents: typeof IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS;
    balanceCents: typeof IHRG_SHOWCASE_JAMES_BALANCE_CENTS;
  };
  plannedZones: PlannedZoneRow[];
  hairlineGeometry: HairlineGeometry;
  imageSlots: readonly IhrgShowcaseJamesImageSlot[];
  schedule: ShowcaseMilestoneSchedule;
  patientMetadata: Record<string, string | boolean | number>;
  intendedFixturePresence: ShowcaseFixturePresence;
};

export function buildIhrgShowcaseJamesPlannedZones(): PlannedZoneRow[] {
  return [
    {
      key: "hairline",
      label: "Hairline",
      grafts: 800,
      targetDensityPerCm2: 45,
      deferred: false,
      unassessed: false,
      polygonNorm: [
        { x: 0.18, y: 0.26 },
        { x: 0.5, y: 0.22 },
        { x: 0.82, y: 0.26 },
        { x: 0.72, y: 0.38 },
        { x: 0.28, y: 0.38 },
      ],
    },
    {
      key: "midscalp",
      label: "Mid-scalp",
      grafts: 1200,
      targetDensityPerCm2: 40,
      deferred: false,
      unassessed: false,
      polygonNorm: [
        { x: 0.28, y: 0.38 },
        { x: 0.72, y: 0.38 },
        { x: 0.7, y: 0.55 },
        { x: 0.3, y: 0.55 },
      ],
    },
    {
      key: "crown",
      label: "Crown",
      grafts: 800,
      targetDensityPerCm2: 35,
      deferred: false,
      unassessed: false,
      polygonNorm: [
        { x: 0.35, y: 0.55 },
        { x: 0.65, y: 0.55 },
        { x: 0.62, y: 0.72 },
        { x: 0.38, y: 0.72 },
      ],
    },
  ];
}

export function demoImageKeyForSlot(slot: IhrgShowcaseJamesImageSlot): string {
  return `${buildShowcaseIdempotencyKeys("A").caseKey}-img-${slot}`;
}

export function buildIhrgShowcaseJamesChenSpec(
  now: Date = new Date(),
  anchor?: ShowcaseTimelineAnchor
): IhrgShowcaseJamesChenSpec {
  const resolvedAnchor = anchor ?? createShowcaseTimelineAnchor(now, SHOWCASE_TIMEZONE);
  const schedule = buildShowcaseMilestoneSchedule(resolvedAnchor);
  const keys = buildShowcaseIdempotencyKeys("A");

  return {
    packageCode: "A",
    clinicSlug: IHRG_SHOWCASE_JAMES_CLINIC_SLUG,
    timeZone: SHOWCASE_TIMEZONE,
    keys,
    identity: {
      displayName: SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
      givenName: SHOWCASE_JAMES_CHEN_GIVEN_NAME,
      familyName: SHOWCASE_JAMES_CHEN_FAMILY_NAME,
      email: IHRG_SHOWCASE_JAMES_EMAIL,
      ageYears: SHOWCASE_JAMES_CHEN_AGE_YEARS,
      sex: SHOWCASE_JAMES_CHEN_SEX,
      birthDateYmd: showcaseBirthDateYmd(resolvedAnchor),
      leadSource: SHOWCASE_JAMES_CHEN_LEAD_SOURCE,
      norwoodBaseline: SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE,
      norwoodPlanTarget: SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET,
      stagingLabel: SHOWCASE_JAMES_CHEN_STAGING_LABEL,
      ageBand: "40-44",
    },
    staffKeys: IHRG_SHOWCASE_JAMES_STAFF_KEYS,
    graftTarget: IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
    finances: {
      currency: "AUD",
      quoteCents: IHRG_SHOWCASE_JAMES_QUOTE_CENTS,
      depositCents: IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS,
      balanceCents: IHRG_SHOWCASE_JAMES_BALANCE_CENTS,
    },
    plannedZones: buildIhrgShowcaseJamesPlannedZones(),
    hairlineGeometry: defaultHairlineGeometry(),
    imageSlots: IHRG_SHOWCASE_JAMES_IMAGE_SLOTS,
    schedule,
    patientMetadata: showcasePatientMetadataFragment("A"),
    intendedFixturePresence: fullShowcaseFixturePresence(),
  };
}

export function totalPlannedGrafts(zones: PlannedZoneRow[]): number {
  return zones.reduce((sum, z) => sum + (typeof z.grafts === "number" ? z.grafts : 0), 0);
}

export function assertIhrgShowcaseJamesSpecConsistent(spec: IhrgShowcaseJamesChenSpec): void {
  if (spec.keys.patientKey !== SHOWCASE_JAMES_CHEN_PATIENT_KEY) {
    throw new Error("Package A James patient key drifted from canonical showcase key");
  }
  if (spec.clinicSlug !== "sydney-hair-institute") {
    throw new Error("Package A James must be anchored to sydney-hair-institute");
  }
  if (spec.timeZone !== "Australia/Sydney") {
    throw new Error("Package A James must use Australia/Sydney");
  }
  if (totalPlannedGrafts(spec.plannedZones) !== spec.graftTarget) {
    throw new Error(
      `Planned zone grafts ${totalPlannedGrafts(spec.plannedZones)} must equal graft target ${spec.graftTarget}`
    );
  }
  if (spec.finances.depositCents + spec.finances.balanceCents !== spec.finances.quoteCents) {
    throw new Error("Deposit + balance must equal quote");
  }
  if (spec.hairlineGeometry.polylineNorm.length < 2) {
    throw new Error("Hairline geometry requires polylineNorm");
  }
  if (!spec.schedule.byId.procedure?.isPast) {
    throw new Error("Procedure milestone must be in the past relative to Demo Day");
  }
  if (!spec.schedule.byId.observed_outcome_3m?.isFuture) {
    throw new Error("3-month observed outcome should be future relative to Demo Day");
  }
}
