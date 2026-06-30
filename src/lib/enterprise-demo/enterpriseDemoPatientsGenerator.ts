import type {
  ConsultationStatus,
  ConsultationTypeId,
} from "@/src/lib/consultations/consultationTypes";
import type { LudwigScaleValue, NorwoodScaleValue } from "@/src/lib/patients/hairLossScales";
import { ENTERPRISE_DEMO_CLINICS } from "./enterpriseDemoConstants";
import {
  ENTERPRISE_DEMO_DEFAULT_VOLUME,
  type EnterpriseDemoVolumeOptions,
} from "./enterpriseDemoVolumeOptions";

export const ENTERPRISE_DEMO_PATIENTS_PER_CLINIC = 30;
export const ENTERPRISE_DEMO_PATIENT_EMAIL_DOMAIN = "follicleintelligence.local";
export const ENTERPRISE_DEMO_SOURCE_SYSTEM = "titan_demo";

export const ENTERPRISE_DEMO_AGE_BANDS = [
  "under_25",
  "25_35",
  "36_45",
  "46_55",
  "56_plus",
] as const;

export type EnterpriseDemoAgeBand = (typeof ENTERPRISE_DEMO_AGE_BANDS)[number];

export const ENTERPRISE_DEMO_GENDERS = ["male", "female"] as const;
export type EnterpriseDemoGender = (typeof ENTERPRISE_DEMO_GENDERS)[number];

export const ENTERPRISE_DEMO_LEAD_SOURCES = [
  "website",
  "instagram",
  "google_ads",
  "referral",
  "walk_in",
  "medical_referral",
  "influencer",
  "franchise_partner",
] as const;

export type EnterpriseDemoLeadSource = (typeof ENTERPRISE_DEMO_LEAD_SOURCES)[number];

/** Savin female-pattern scale (stored in demo metadata; not yet a DB column). */
export const ENTERPRISE_DEMO_SAVIN_SCALES = [
  "I-1",
  "I-2",
  "I-3",
  "I-4",
  "II-1",
  "II-2",
  "unknown",
] as const;

export type EnterpriseDemoSavinScale = (typeof ENTERPRISE_DEMO_SAVIN_SCALES)[number];

export const ENTERPRISE_DEMO_CONVERSION_OUTCOMES = [
  "pending_follow_up",
  "quoted_awaiting_decision",
  "quoted_declined",
  "accepted_awaiting_surgery",
  "converted_to_case",
  "lost_to_competitor",
  "not_a_candidate",
] as const;

export type EnterpriseDemoConversionOutcome = (typeof ENTERPRISE_DEMO_CONVERSION_OUTCOMES)[number];

export const ENTERPRISE_DEMO_JOURNEY_ARCHETYPES = [
  "new_lead",
  "booked_consult",
  "completed_consult",
  "surgery_booked",
  "surgery_completed",
  "follow_up_3_month",
  "follow_up_6_month",
  "follow_up_9_month",
  "follow_up_12_month",
  "repair_assessment",
  "poor_donor_candidate",
  "excellent_candidate",
  "prp_only",
  "medical_therapy_monitoring",
] as const;

export type EnterpriseDemoJourneyArchetype = (typeof ENTERPRISE_DEMO_JOURNEY_ARCHETYPES)[number];

export type EnterpriseDemoPatientConsultationSpec = {
  demoPatientKey: string;
  demoConsultationKey: string;
  clinicSlug: string;
  patientIndex: number;
  displayName: string;
  email: string;
  gender: EnterpriseDemoGender;
  ageBand: EnterpriseDemoAgeBand;
  norwoodScale: NorwoodScaleValue | null;
  ludwigScale: LudwigScaleValue | null;
  savinScale: EnterpriseDemoSavinScale | null;
  diagnosis: string;
  leadSource: EnterpriseDemoLeadSource;
  consultationStatus: ConsultationStatus;
  consultationType: ConsultationTypeId;
  quotedTreatment: string | null;
  quotedValue: number | null;
  graftEstimate: number | null;
  conversionOutcome: EnterpriseDemoConversionOutcome;
  consultantStaffKey: string;
  consultationDate: string;
  timezone: string;
  journeyArchetype: EnterpriseDemoJourneyArchetype;
};

const MALE_FIRST_NAMES = [
  "James",
  "Michael",
  "David",
  "Daniel",
  "Thomas",
  "William",
  "Robert",
  "Christopher",
  "Matthew",
  "Andrew",
  "Joseph",
  "Ryan",
  "Nathan",
  "Marcus",
  "Oliver",
  "Liam",
  "Noah",
  "Ethan",
  "Lucas",
  "Rafael",
  "Arjun",
  "Khalid",
  "Somchai",
  "Nikos",
  "Diego",
] as const;

const FEMALE_FIRST_NAMES = [
  "Sarah",
  "Emily",
  "Jessica",
  "Sophie",
  "Charlotte",
  "Amelia",
  "Olivia",
  "Hannah",
  "Priya",
  "Fatima",
  "Layla",
  "Mia",
  "Ananya",
  "Eleni",
  "Madison",
  "Anjali",
  "Camila",
  "Beatriz",
  "Nadia",
  "Chloe",
  "Neha",
  "Mariana",
  "Siriporn",
  "Maria",
  "Ashley",
] as const;

const LAST_NAMES = [
  "Anderson",
  "Bennett",
  "Campbell",
  "Chen",
  "Clarke",
  "Cooper",
  "Davis",
  "Fernandez",
  "Garcia",
  "Graves",
  "Harrington",
  "Hassan",
  "Iyer",
  "Johnson",
  "Kapoor",
  "Kourou",
  "Martinez",
  "Nguyen",
  "Okafor",
  "Patel",
  "Rivera",
  "Santos",
  "Sharma",
  "Stavros",
  "Thompson",
  "Voss",
  "Webb",
  "Williams",
  "Wright",
  "Zhang",
] as const;

const NORWOOD_MALE: readonly NorwoodScaleValue[] = [
  "II",
  "IIa",
  "III",
  "IIIa",
  "IIIvertex",
  "IV",
  "IVa",
  "V",
  "Va",
  "VI",
];

const LUDWIG_FEMALE: readonly LudwigScaleValue[] = ["I", "II", "III"];

const SAVIN_FEMALE: readonly EnterpriseDemoSavinScale[] = [
  "I-1",
  "I-2",
  "I-3",
  "I-4",
  "II-1",
  "II-2",
];

const DIAGNOSES_MALE = [
  "Androgenetic alopecia with frontal recession and temple loss.",
  "Progressive male-pattern thinning with crown involvement.",
  "Norwood-pattern hair loss — candidate for FUE restoration.",
  "Diffuse thinning across mid-scalp with preserved donor density.",
  "Temporal recession with early vertex thinning.",
] as const;

const DIAGNOSES_FEMALE = [
  "Female pattern hair loss with central widening and crown thinning.",
  "Diffuse Ludwig-pattern loss with preserved frontal hairline.",
  "Post-menopausal thinning — medical workup recommended.",
  "Central scalp thinning with reduced density on crown.",
  "Progressive diffuse alopecia — suitable for combined medical + surgical plan.",
] as const;

const QUOTED_TREATMENTS = [
  "FUE hair transplant — single session",
  "FUE hair transplant — two-stage plan",
  "FUT strip harvest with FUE refinement",
  "PRP / PRF maintenance programme (6 sessions)",
  "Medical hair loss therapy (12-month plan)",
  "Beard transplant — goatee and cheek definition",
  "Eyebrow restoration — bilateral density rebuild",
  "Combined FUE + PRP starter package",
] as const;

const CONSULTATION_TYPE_BY_TREATMENT: Record<string, ConsultationTypeId> = {
  "FUE hair transplant — single session": "scalp_hair_transplant",
  "FUE hair transplant — two-stage plan": "scalp_hair_transplant",
  "FUT strip harvest with FUE refinement": "scalp_hair_transplant",
  "PRP / PRF maintenance programme (6 sessions)": "prp_prf",
  "Medical hair loss therapy (12-month plan)": "medical_hair_loss",
  "Beard transplant — goatee and cheek definition": "beard_transplant",
  "Eyebrow restoration — bilateral density rebuild": "eyebrow_transplant",
  "Combined FUE + PRP starter package": "scalp_hair_transplant",
};

function stableHash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: readonly T[], key: string, salt: string): T {
  const idx = stableHash(`${key}:${salt}`) % items.length;
  return items[idx];
}

function buildDemoPatientKey(clinicSlug: string, index: number): string {
  return `${clinicSlug}-patient-${String(index).padStart(2, "0")}`;
}

export function buildEnterpriseDemoPatientEmail(demoPatientKey: string): string {
  const local = demoPatientKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".");
  return `titan.patient.${local}@${ENTERPRISE_DEMO_PATIENT_EMAIL_DOMAIN}`;
}

function conversionOutcomeForStatus(
  status: ConsultationStatus,
  key: string
): EnterpriseDemoConversionOutcome {
  if (status === "draft" || status === "in_progress") {
    return pick(["pending_follow_up", "not_a_candidate"], key, "outcome");
  }
  if (status === "completed") return "pending_follow_up";
  if (status === "quoted") {
    return pick(["quoted_awaiting_decision", "quoted_declined"], key, "quoted_outcome");
  }
  if (status === "accepted") return "accepted_awaiting_surgery";
  if (status === "converted_to_case") return "converted_to_case";
  return pick(["lost_to_competitor", "not_a_candidate"], key, "archived_outcome");
}

function quotedValueForTreatment(treatment: string, key: string): number | null {
  if (treatment.includes("PRP")) return 1800 + (stableHash(key) % 1200);
  if (treatment.includes("Medical")) return 950 + (stableHash(key) % 800);
  if (treatment.includes("Eyebrow")) return 4200 + (stableHash(key) % 2000);
  if (treatment.includes("Beard")) return 5500 + (stableHash(key) % 3500);
  if (treatment.includes("two-stage")) return 14000 + (stableHash(key) % 6000);
  if (treatment.includes("FUT")) return 11000 + (stableHash(key) % 5000);
  if (treatment.includes("Combined")) return 9000 + (stableHash(key) % 4000);
  return 7500 + (stableHash(key) % 7000);
}

function graftEstimateForTreatment(treatment: string, key: string): number | null {
  if (treatment.includes("PRP") || treatment.includes("Medical")) return null;
  if (treatment.includes("Eyebrow")) return 350 + (stableHash(key) % 250);
  if (treatment.includes("Beard")) return 900 + (stableHash(key) % 1100);
  if (treatment.includes("two-stage")) return 2800 + (stableHash(key) % 1200);
  return 1200 + (stableHash(key) % 2800);
}

function consultationDateForKey(key: string, _timezone: string): string {
  const daysAgo = 3 + (stableHash(key) % 88);
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function consultantStaffKey(clinicSlug: string, index: number): string {
  return index % 3 === 0 ? `${clinicSlug}-consultant` : `${clinicSlug}-senior-consultant`;
}

function journeyArchetypeForIndex(
  index: number,
  patientsPerClinic: number
): EnterpriseDemoJourneyArchetype {
  const archetypes = ENTERPRISE_DEMO_JOURNEY_ARCHETYPES;
  const slot = Math.min(index - 1, patientsPerClinic - 1);
  const bucket = Math.floor((slot / Math.max(patientsPerClinic, 1)) * archetypes.length);
  return archetypes[Math.min(bucket, archetypes.length - 1)];
}

function consultationStatusForIndex(
  index: number,
  patientsPerClinic: number,
  surgeriesPerClinic: number
): ConsultationStatus {
  const surgeryBandStart = Math.max(1, patientsPerClinic - surgeriesPerClinic + 1);
  if (index >= surgeryBandStart) {
    const offset = index - surgeryBandStart;
    const quotedCount = Math.max(1, Math.floor(surgeriesPerClinic * 0.35));
    const acceptedCount = Math.max(1, Math.floor(surgeriesPerClinic * 0.35));
    if (offset < quotedCount) return "quoted";
    if (offset < quotedCount + acceptedCount) return "accepted";
    return "converted_to_case";
  }

  const earlySlot = index - 1;
  const third = Math.max(2, Math.floor(patientsPerClinic / 3));
  if (earlySlot < 2) return "draft";
  if (earlySlot < third) return "in_progress";
  if (earlySlot < third * 2) return "completed";
  return "quoted";
}

function buildPatientSpec(
  clinicSlug: string,
  clinicTimezone: string,
  index: number,
  volume: EnterpriseDemoVolumeOptions
): EnterpriseDemoPatientConsultationSpec {
  const demoPatientKey = buildDemoPatientKey(clinicSlug, index);
  const demoConsultationKey = `${demoPatientKey}-consultation`;
  const gender = pick(ENTERPRISE_DEMO_GENDERS, demoPatientKey, "gender");
  const firstName =
    gender === "male"
      ? pick(MALE_FIRST_NAMES, demoPatientKey, "first")
      : pick(FEMALE_FIRST_NAMES, demoPatientKey, "first");
  const lastName = pick(LAST_NAMES, demoPatientKey, "last");
  const displayName = `${firstName} ${lastName}`;
  const ageBand = pick(ENTERPRISE_DEMO_AGE_BANDS, demoPatientKey, "age");
  const consultationStatus = consultationStatusForIndex(
    index,
    volume.patientsPerClinic,
    volume.surgeriesPerClinic
  );
  const journeyArchetype = journeyArchetypeForIndex(index, volume.patientsPerClinic);
  const quotedTreatment =
    consultationStatus === "draft" || consultationStatus === "in_progress"
      ? null
      : pick(QUOTED_TREATMENTS, demoPatientKey, "treatment");
  const consultationType = quotedTreatment
    ? (CONSULTATION_TYPE_BY_TREATMENT[quotedTreatment] ?? "scalp_hair_transplant")
    : pick(
        ["scalp_hair_transplant", "medical_hair_loss", "prp_prf"] as const,
        demoPatientKey,
        "early_type"
      );

  const norwoodScale = gender === "male" ? pick(NORWOOD_MALE, demoPatientKey, "norwood") : null;
  const ludwigScale = gender === "female" ? pick(LUDWIG_FEMALE, demoPatientKey, "ludwig") : null;
  const savinScale = gender === "female" ? pick(SAVIN_FEMALE, demoPatientKey, "savin") : null;
  const diagnosis =
    gender === "male"
      ? pick(DIAGNOSES_MALE, demoPatientKey, "diagnosis")
      : pick(DIAGNOSES_FEMALE, demoPatientKey, "diagnosis");

  const quotedValue =
    quotedTreatment && ["quoted", "accepted", "converted_to_case"].includes(consultationStatus)
      ? quotedValueForTreatment(quotedTreatment, demoPatientKey)
      : null;
  const graftEstimate =
    quotedTreatment && quotedValue != null
      ? graftEstimateForTreatment(quotedTreatment, demoPatientKey)
      : null;

  return {
    demoPatientKey,
    demoConsultationKey,
    clinicSlug,
    patientIndex: index,
    displayName,
    email: buildEnterpriseDemoPatientEmail(demoPatientKey),
    gender,
    ageBand,
    norwoodScale,
    ludwigScale,
    savinScale,
    diagnosis,
    leadSource: pick(ENTERPRISE_DEMO_LEAD_SOURCES, demoPatientKey, "lead"),
    consultationStatus,
    consultationType,
    quotedTreatment,
    quotedValue,
    graftEstimate,
    conversionOutcome: conversionOutcomeForStatus(consultationStatus, demoPatientKey),
    consultantStaffKey: consultantStaffKey(clinicSlug, index),
    consultationDate: consultationDateForKey(demoConsultationKey, clinicTimezone),
    timezone: clinicTimezone,
    journeyArchetype,
  };
}

/**
 * Pure generator: synthetic patient + consultation specs per demo clinic.
 */
export function buildEnterpriseDemoPatientConsultationSpecs(
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): EnterpriseDemoPatientConsultationSpec[] {
  const specs: EnterpriseDemoPatientConsultationSpec[] = [];
  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    for (let i = 1; i <= volume.patientsPerClinic; i++) {
      specs.push(buildPatientSpec(clinic.slug, clinic.timezone, i, volume));
    }
  }
  return specs;
}

export function validateEnterpriseDemoPatientConsultationSpecs(
  specs: EnterpriseDemoPatientConsultationSpec[],
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): { ok: true } | { ok: false; reason: string } {
  const patientKeys = new Set(specs.map((s) => s.demoPatientKey));
  const consultationKeys = new Set(specs.map((s) => s.demoConsultationKey));

  if (patientKeys.size !== specs.length) {
    return { ok: false, reason: "Duplicate demo_patient_key values detected." };
  }
  if (consultationKeys.size !== specs.length) {
    return { ok: false, reason: "Duplicate demo_consultation_key values detected." };
  }

  const expectedTotal = ENTERPRISE_DEMO_CLINICS.length * volume.patientsPerClinic;
  if (specs.length !== expectedTotal) {
    return {
      ok: false,
      reason: `Expected ${expectedTotal} specs, got ${specs.length}.`,
    };
  }

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const clinicSpecs = specs.filter((s) => s.clinicSlug === clinic.slug);
    if (clinicSpecs.length !== volume.patientsPerClinic) {
      return {
        ok: false,
        reason: `Clinic "${clinic.slug}" expected ${volume.patientsPerClinic} specs.`,
      };
    }
  }

  return { ok: true };
}
