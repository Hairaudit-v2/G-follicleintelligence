/**
 * FI-DEMO-DAY-2A.3 — Pure Package B (Follicle Demo Clinic) specs for James Chen.
 * Parallel narrative to Package A; tenant-isolated keys via buildShowcaseIdempotencyKeys("B").
 */

import type { PlannedZoneRow } from "@/src/lib/cases/surgeryPlanningTypes";
import {
  defaultHairlineGeometry,
  type HairlineGeometry,
} from "@/src/lib/cases/surgeryProjection/hairlineDomain";
import {
  CLINIC_DEMO_CLINIC_NAME,
  CLINIC_DEMO_TENANT_SLUG,
} from "@/src/lib/clinic-demo/clinicDemoConstants";
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
  SHOWCASE_PACKAGE_B,
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
import {
  buildIhrgShowcaseJamesPlannedZones,
  IHRG_SHOWCASE_JAMES_BALANCE_CENTS,
  IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS,
  IHRG_SHOWCASE_JAMES_GRAFT_TARGET,
  IHRG_SHOWCASE_JAMES_IMAGE_SLOTS,
  IHRG_SHOWCASE_JAMES_QUOTE_CENTS,
  totalPlannedGrafts,
  type IhrgShowcaseJamesImageSlot,
} from "@/src/lib/ihrg-demo/ihrgShowcaseJamesChenModel";

export const CLINIC_SHOWCASE_JAMES_CLINIC_SLUG = CLINIC_DEMO_TENANT_SLUG;
export const CLINIC_SHOWCASE_JAMES_CLINIC_NAME = CLINIC_DEMO_CLINIC_NAME;
export const CLINIC_SHOWCASE_JAMES_EMAIL =
  "james.chen.showcase@follicle-demo-clinic.demo" as const;

/** Stable staff keys for Package B (created if absent). */
export const CLINIC_SHOWCASE_JAMES_STAFF_KEYS = {
  consultant: "clinic-demo-showcase-consultant",
  surgeon: "clinic-demo-showcase-surgeon",
  nurse: "clinic-demo-showcase-nurse",
  technician: "clinic-demo-showcase-technician",
} as const;

export const CLINIC_SHOWCASE_JAMES_GRAFT_TARGET = IHRG_SHOWCASE_JAMES_GRAFT_TARGET;
export const CLINIC_SHOWCASE_JAMES_QUOTE_CENTS = IHRG_SHOWCASE_JAMES_QUOTE_CENTS;
export const CLINIC_SHOWCASE_JAMES_DEPOSIT_CENTS = IHRG_SHOWCASE_JAMES_DEPOSIT_CENTS;
export const CLINIC_SHOWCASE_JAMES_BALANCE_CENTS = IHRG_SHOWCASE_JAMES_BALANCE_CENTS;
export const CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS = IHRG_SHOWCASE_JAMES_IMAGE_SLOTS;

export type ClinicShowcaseJamesImageSlot = IhrgShowcaseJamesImageSlot;

export type ClinicShowcaseJamesChenSpec = {
  packageCode: "B";
  clinicSlug: typeof CLINIC_SHOWCASE_JAMES_CLINIC_SLUG;
  clinicName: typeof CLINIC_SHOWCASE_JAMES_CLINIC_NAME;
  timeZone: typeof SHOWCASE_TIMEZONE;
  keys: ShowcaseIdempotencyKeys;
  identity: {
    displayName: typeof SHOWCASE_JAMES_CHEN_DISPLAY_NAME;
    givenName: typeof SHOWCASE_JAMES_CHEN_GIVEN_NAME;
    familyName: typeof SHOWCASE_JAMES_CHEN_FAMILY_NAME;
    email: typeof CLINIC_SHOWCASE_JAMES_EMAIL;
    ageYears: typeof SHOWCASE_JAMES_CHEN_AGE_YEARS;
    sex: typeof SHOWCASE_JAMES_CHEN_SEX;
    birthDateYmd: string;
    leadSource: typeof SHOWCASE_JAMES_CHEN_LEAD_SOURCE;
    norwoodBaseline: typeof SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE;
    norwoodPlanTarget: typeof SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET;
    stagingLabel: typeof SHOWCASE_JAMES_CHEN_STAGING_LABEL;
    ageBand: "40-44";
  };
  staffKeys: typeof CLINIC_SHOWCASE_JAMES_STAFF_KEYS;
  graftTarget: typeof CLINIC_SHOWCASE_JAMES_GRAFT_TARGET;
  finances: {
    currency: "AUD";
    quoteCents: typeof CLINIC_SHOWCASE_JAMES_QUOTE_CENTS;
    depositCents: typeof CLINIC_SHOWCASE_JAMES_DEPOSIT_CENTS;
    balanceCents: typeof CLINIC_SHOWCASE_JAMES_BALANCE_CENTS;
  };
  plannedZones: PlannedZoneRow[];
  hairlineGeometry: HairlineGeometry;
  imageSlots: readonly ClinicShowcaseJamesImageSlot[];
  schedule: ShowcaseMilestoneSchedule;
  patientMetadata: Record<string, string | boolean | number>;
  intendedFixturePresence: ShowcaseFixturePresence;
};

export function clinicDemoImageKeyForSlot(slot: ClinicShowcaseJamesImageSlot): string {
  return `${buildShowcaseIdempotencyKeys("B").caseKey}-img-${slot}`;
}

export function buildClinicShowcaseJamesChenSpec(
  now: Date = new Date(),
  anchor?: ShowcaseTimelineAnchor
): ClinicShowcaseJamesChenSpec {
  const resolvedAnchor = anchor ?? createShowcaseTimelineAnchor(now, SHOWCASE_TIMEZONE);
  const schedule = buildShowcaseMilestoneSchedule(resolvedAnchor);
  const keys = buildShowcaseIdempotencyKeys("B");

  return {
    packageCode: "B",
    clinicSlug: CLINIC_SHOWCASE_JAMES_CLINIC_SLUG,
    clinicName: CLINIC_SHOWCASE_JAMES_CLINIC_NAME,
    timeZone: SHOWCASE_TIMEZONE,
    keys,
    identity: {
      displayName: SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
      givenName: SHOWCASE_JAMES_CHEN_GIVEN_NAME,
      familyName: SHOWCASE_JAMES_CHEN_FAMILY_NAME,
      email: CLINIC_SHOWCASE_JAMES_EMAIL,
      ageYears: SHOWCASE_JAMES_CHEN_AGE_YEARS,
      sex: SHOWCASE_JAMES_CHEN_SEX,
      birthDateYmd: showcaseBirthDateYmd(resolvedAnchor),
      leadSource: SHOWCASE_JAMES_CHEN_LEAD_SOURCE,
      norwoodBaseline: SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE,
      norwoodPlanTarget: SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET,
      stagingLabel: SHOWCASE_JAMES_CHEN_STAGING_LABEL,
      ageBand: "40-44",
    },
    staffKeys: CLINIC_SHOWCASE_JAMES_STAFF_KEYS,
    graftTarget: CLINIC_SHOWCASE_JAMES_GRAFT_TARGET,
    finances: {
      currency: "AUD",
      quoteCents: CLINIC_SHOWCASE_JAMES_QUOTE_CENTS,
      depositCents: CLINIC_SHOWCASE_JAMES_DEPOSIT_CENTS,
      balanceCents: CLINIC_SHOWCASE_JAMES_BALANCE_CENTS,
    },
    plannedZones: buildIhrgShowcaseJamesPlannedZones(),
    hairlineGeometry: defaultHairlineGeometry(),
    imageSlots: CLINIC_SHOWCASE_JAMES_IMAGE_SLOTS,
    schedule,
    patientMetadata: showcasePatientMetadataFragment("B"),
    intendedFixturePresence: fullShowcaseFixturePresence(),
  };
}

export function assertClinicShowcaseJamesSpecConsistent(
  spec: ClinicShowcaseJamesChenSpec
): void {
  if (spec.keys.patientKey !== SHOWCASE_JAMES_CHEN_PATIENT_KEY) {
    throw new Error("Package B James patient key drifted from canonical showcase key");
  }
  if (!spec.keys.caseKey.startsWith("clinic-")) {
    throw new Error("Package B idempotency keys must use clinic- prefix");
  }
  if (spec.clinicSlug !== CLINIC_DEMO_TENANT_SLUG) {
    throw new Error("Package B James must be anchored to follicle-demo-clinic");
  }
  if (spec.timeZone !== "Australia/Sydney") {
    throw new Error("Package B James must use Australia/Sydney");
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
  if (SHOWCASE_PACKAGE_B.patientKeyField !== "clinic_demo_patient_key") {
    throw new Error("Package B must use clinic_demo_patient_key");
  }
}
