/**
 * FI-DEMO-DAY-2A.4 — Detect showcase Health-record overview patients from
 * tenant-scoped metadata markers (no client-supplied readiness).
 */

import {
  SHOWCASE_JAMES_CHEN_PATIENT_KEY,
  SHOWCASE_PACKAGE_A,
  SHOWCASE_PACKAGE_B,
  type ShowcaseDemoPackage,
} from "@/src/lib/demo-day/showcaseJamesChenConstants";

export type ShowcaseDetectionInput = {
  /** Foundation patient metadata (authoritative). */
  patientMetadata?: Record<string, unknown> | null;
  /** Person metadata (fallback / enrichment only). */
  personMetadata?: Record<string, unknown> | null;
};

export type ShowcaseDetectionResult = {
  isShowcase: boolean;
  showcasePatientKey: string | null;
  demoPackage: ShowcaseDemoPackage | null;
  /** True when the canonical James Chen key is present — never drive ordinary behaviour alone. */
  isJamesChenShowcase: boolean;
  markersFound: string[];
};

function metaString(
  meta: Record<string, unknown> | null | undefined,
  key: string
): string | null {
  if (!meta) return null;
  const v = meta[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  return null;
}

function metaTruthy(
  meta: Record<string, unknown> | null | undefined,
  key: string
): boolean {
  if (!meta) return false;
  const v = meta[key];
  return v === true || v === "true" || v === 1 || v === "1";
}

function readPatientKey(meta: Record<string, unknown> | null | undefined): string | null {
  return (
    metaString(meta, SHOWCASE_PACKAGE_A.patientKeyField) ??
    metaString(meta, SHOWCASE_PACKAGE_B.patientKeyField) ??
    metaString(meta, "demo_patient_key") ??
    metaString(meta, "clinic_demo_patient_key")
  );
}

function mergeMeta(input: ShowcaseDetectionInput): Record<string, unknown> {
  return {
    ...(input.personMetadata && typeof input.personMetadata === "object"
      ? input.personMetadata
      : {}),
    ...(input.patientMetadata && typeof input.patientMetadata === "object"
      ? input.patientMetadata
      : {}),
  };
}

/**
 * Discover showcase overview eligibility from existing seed markers.
 * Prefer capabilities downstream — do not gate ordinary patients solely on name.
 */
export function detectShowcasePatient(input: ShowcaseDetectionInput): ShowcaseDetectionResult {
  const meta = mergeMeta(input);
  const markersFound: string[] = [];

  const patientKey = readPatientKey(meta);
  if (patientKey) {
    if (metaString(meta, SHOWCASE_PACKAGE_A.patientKeyField)) {
      markersFound.push(SHOWCASE_PACKAGE_A.patientKeyField);
    }
    if (metaString(meta, SHOWCASE_PACKAGE_B.patientKeyField)) {
      markersFound.push(SHOWCASE_PACKAGE_B.patientKeyField);
    }
  }

  const enterpriseFlag = metaTruthy(meta, SHOWCASE_PACKAGE_A.showcaseFlag);
  const clinicFlag = metaTruthy(meta, SHOWCASE_PACKAGE_B.showcaseFlag);
  if (enterpriseFlag) markersFound.push(SHOWCASE_PACKAGE_A.showcaseFlag);
  if (clinicFlag) markersFound.push(SHOWCASE_PACKAGE_B.showcaseFlag);

  const packageRaw = metaString(meta, "demo_package");
  let demoPackage: ShowcaseDemoPackage | null = null;
  if (packageRaw === "A" || packageRaw === "B") {
    demoPackage = packageRaw;
    markersFound.push("demo_package");
  } else if (enterpriseFlag || metaString(meta, SHOWCASE_PACKAGE_A.patientKeyField)) {
    demoPackage = "A";
  } else if (clinicFlag || metaString(meta, SHOWCASE_PACKAGE_B.patientKeyField)) {
    demoPackage = "B";
  }

  const isJamesChenShowcase = patientKey === SHOWCASE_JAMES_CHEN_PATIENT_KEY;
  const isShowcase =
    isJamesChenShowcase ||
    enterpriseFlag ||
    clinicFlag ||
    (patientKey != null && patientKey.length > 0);

  return {
    isShowcase,
    showcasePatientKey: patientKey,
    demoPackage: isShowcase ? demoPackage : null,
    isJamesChenShowcase,
    markersFound: Array.from(new Set(markersFound)),
  };
}
