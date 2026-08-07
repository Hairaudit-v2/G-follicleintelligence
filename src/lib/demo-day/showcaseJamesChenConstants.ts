/**
 * FI-DEMO-DAY-2A.1 — Canonical James Chen showcase identity and shared Package A/B keys.
 *
 * Pure constants only. Seeds (2A.2+) must upsert by these keys — never invent new brands
 * or alternate patient identities for the Digital Twin story.
 */

import {
  CLINIC_DEMO_CLINIC_NAME,
  CLINIC_DEMO_TENANT_SLUG,
  CLINIC_DEMO_TIMEZONE,
} from "@/src/lib/clinic-demo/clinicDemoConstants";
import {
  ENTERPRISE_DEMO_TENANT_SLUG,
} from "@/src/lib/enterprise-demo/enterpriseDemoConstants";
import { IHRG_DEMO_DAY_CLINIC_SLUG, IHRG_DEMO_DAY_TIMEZONE } from "@/src/lib/ihrg-demo/ihrgDemoDayAlignmentModel";

/** Stable demo patient key shared by both packages (tenant-scoped rows remain separate). */
export const SHOWCASE_JAMES_CHEN_PATIENT_KEY = "showcase-james-chen-v1" as const;

export const SHOWCASE_JAMES_CHEN_DISPLAY_NAME = "James Chen" as const;
export const SHOWCASE_JAMES_CHEN_GIVEN_NAME = "James" as const;
export const SHOWCASE_JAMES_CHEN_FAMILY_NAME = "Chen" as const;
export const SHOWCASE_JAMES_CHEN_AGE_YEARS = 42 as const;
export const SHOWCASE_JAMES_CHEN_SEX = "male" as const;
export const SHOWCASE_JAMES_CHEN_LEAD_SOURCE = "web_enquiry" as const;

/** Baseline staging: Norwood 3V with planned 4-adjacent recipient strategy. */
export const SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE = "3V" as const;
export const SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET = "4" as const;
export const SHOWCASE_JAMES_CHEN_STAGING_LABEL = "Norwood 3V–4" as const;

/** Operational timezone for James’s story (both packages). */
export const SHOWCASE_TIMEZONE = "Australia/Sydney" as const;

export type ShowcaseDemoPackage = "A" | "B";

export const SHOWCASE_PACKAGE_A = {
  packageCode: "A" as const,
  tenantSlug: ENTERPRISE_DEMO_TENANT_SLUG,
  clinicSlug: IHRG_DEMO_DAY_CLINIC_SLUG,
  timeZone: IHRG_DEMO_DAY_TIMEZONE,
  /** Metadata field on Package A patient / related rows */
  patientKeyField: "demo_patient_key" as const,
  patientKey: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  showcaseFlag: "enterprise_demo_showcase" as const,
} as const;

export const SHOWCASE_PACKAGE_B = {
  packageCode: "B" as const,
  tenantSlug: CLINIC_DEMO_TENANT_SLUG,
  clinicName: CLINIC_DEMO_CLINIC_NAME,
  timeZone: CLINIC_DEMO_TIMEZONE,
  /** Metadata field on Package B patient / related rows */
  patientKeyField: "clinic_demo_patient_key" as const,
  patientKey: SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  showcaseFlag: "clinic_demo_showcase" as const,
} as const;

export type ShowcasePackageConfig =
  | typeof SHOWCASE_PACKAGE_A
  | typeof SHOWCASE_PACKAGE_B;

export function showcasePackageConfig(pkg: ShowcaseDemoPackage): ShowcasePackageConfig {
  return pkg === "A" ? SHOWCASE_PACKAGE_A : SHOWCASE_PACKAGE_B;
}

/**
 * Deterministic idempotency keys for James Chen story artifacts.
 * Re-seed must resolve the same logical entities via these keys.
 */
export type ShowcaseIdempotencyKeys = {
  patientKey: typeof SHOWCASE_JAMES_CHEN_PATIENT_KEY;
  personKey: string;
  leadKey: string;
  consultationKey: string;
  caseKey: string;
  bookingKey: string;
  surgeryKey: string;
  hairlineDesignKey: string;
  quoteInvoiceKey: string;
  depositPaymentKey: string;
  balanceInvoiceKey: string;
  graftSessionKey: string;
  outcomeAuditKey: string;
  protocolSessionKey: string;
};

export function buildShowcaseIdempotencyKeys(pkg: ShowcaseDemoPackage): ShowcaseIdempotencyKeys {
  const prefix = pkg === "A" ? "ihrg" : "clinic";
  const base = SHOWCASE_JAMES_CHEN_PATIENT_KEY;
  return {
    patientKey: base,
    personKey: `${prefix}-${base}-person`,
    leadKey: `${prefix}-${base}-lead`,
    consultationKey: `${prefix}-${base}-consultation`,
    caseKey: `${prefix}-${base}-case`,
    bookingKey: `${prefix}-${base}-booking`,
    surgeryKey: `${prefix}-${base}-surgery`,
    hairlineDesignKey: `${prefix}-${base}-hairline`,
    quoteInvoiceKey: `${prefix}-${base}-quote`,
    depositPaymentKey: `${prefix}-${base}-deposit`,
    balanceInvoiceKey: `${prefix}-${base}-balance`,
    graftSessionKey: `${prefix}-${base}-graft-session`,
    outcomeAuditKey: `${prefix}-${base}-outcome-audit`,
    protocolSessionKey: `${prefix}-${base}-protocol-session`,
  };
}

/** Assert package timezones stay on Australia/Sydney (brief invariant). */
export function assertShowcaseTimezoneAligned(): void {
  if (SHOWCASE_TIMEZONE !== "Australia/Sydney") {
    throw new Error(`SHOWCASE_TIMEZONE must be Australia/Sydney, got ${SHOWCASE_TIMEZONE}`);
  }
  if (SHOWCASE_PACKAGE_A.timeZone !== SHOWCASE_TIMEZONE) {
    throw new Error("Package A timezone must match SHOWCASE_TIMEZONE");
  }
  if (SHOWCASE_PACKAGE_B.timeZone !== SHOWCASE_TIMEZONE) {
    throw new Error("Package B timezone must match SHOWCASE_TIMEZONE");
  }
}

export function isShowcaseJamesChenPatientKey(value: unknown): boolean {
  return value === SHOWCASE_JAMES_CHEN_PATIENT_KEY;
}

/** Metadata fragment seeds should merge onto James’s patient row. */
export function showcasePatientMetadataFragment(
  pkg: ShowcaseDemoPackage
): Record<string, string | boolean | number> {
  const config = showcasePackageConfig(pkg);
  return {
    [config.patientKeyField]: config.patientKey,
    [config.showcaseFlag]: true,
    showcase_display_name: SHOWCASE_JAMES_CHEN_DISPLAY_NAME,
    showcase_age_years: SHOWCASE_JAMES_CHEN_AGE_YEARS,
    showcase_sex: SHOWCASE_JAMES_CHEN_SEX,
    showcase_norwood_baseline: SHOWCASE_JAMES_CHEN_NORWOOD_BASELINE,
    showcase_norwood_plan_target: SHOWCASE_JAMES_CHEN_NORWOOD_PLAN_TARGET,
    showcase_staging_label: SHOWCASE_JAMES_CHEN_STAGING_LABEL,
    showcase_lead_source: SHOWCASE_JAMES_CHEN_LEAD_SOURCE,
    showcase_timezone: SHOWCASE_TIMEZONE,
    demo_package: pkg,
  };
}
