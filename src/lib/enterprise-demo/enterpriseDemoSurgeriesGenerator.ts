import {
  ENTERPRISE_DEMO_CLINICS,
  ENTERPRISE_DEMO_CASE_KEY_METADATA,
  ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
  ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
  ENTERPRISE_DEMO_GRAFT_SESSION_KEY_METADATA,
  ENTERPRISE_DEMO_GRAFT_EVENT_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoPatientConsultationSpecs,
  type EnterpriseDemoPatientConsultationSpec,
} from "./enterpriseDemoPatientsGenerator";
import {
  ENTERPRISE_DEMO_DEFAULT_VOLUME,
  type EnterpriseDemoVolumeOptions,
} from "./enterpriseDemoVolumeOptions";

export const ENTERPRISE_DEMO_SURGERIES_PER_CLINIC = 12;
export const ENTERPRISE_DEMO_TOTAL_SURGERIES =
  ENTERPRISE_DEMO_CLINICS.length * ENTERPRISE_DEMO_SURGERIES_PER_CLINIC;

/**
 * Patient indices (1–30) selected for surgery seeding per clinic.
 * 1 quoted + 6 accepted + 5 converted = 12 surgeries per clinic (96 total).
 */
export const ENTERPRISE_DEMO_SURGERY_PATIENT_INDICES: readonly number[] = [
  17,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  28,
  29,
];

export const ENTERPRISE_DEMO_SURGERY_STATUSES = [
  "scheduled",
  "pre_op",
  "in_progress",
  "paused",
  "completed",
] as const;

export type EnterpriseDemoSurgeryStatus = (typeof ENTERPRISE_DEMO_SURGERY_STATUSES)[number];

export const ENTERPRISE_DEMO_EXTRACTION_TECHNIQUES = [
  "FUE",
  "DHI",
  "FUT hybrid",
  "manual FUE",
] as const;

export type EnterpriseDemoExtractionTechnique = (typeof ENTERPRISE_DEMO_EXTRACTION_TECHNIQUES)[number];

export const ENTERPRISE_DEMO_IMPLANTATION_METHODS = [
  "lateral slit",
  "implanter pen",
  "stick-and-place",
  "DHI implanter",
] as const;

export type EnterpriseDemoImplantationMethod = (typeof ENTERPRISE_DEMO_IMPLANTATION_METHODS)[number];

export const ENTERPRISE_DEMO_PUNCH_SIZES = ["0.70", "0.75", "0.80", "0.85", "0.90", "1.00"] as const;

export type EnterpriseDemoClinicPerformanceProfile =
  | "default"
  | "benchmark"
  | "elevated_transection"
  | "missing_reconciliation"
  | "graft_count_vs_quote";

export const ENTERPRISE_DEMO_CLINIC_PERFORMANCE_PROFILES: Record<
  string,
  EnterpriseDemoClinicPerformanceProfile
> = {
  "london-central-institute": "elevated_transection",
  "bangkok-restoration-centre": "missing_reconciliation",
  "dubai-hair-institute": "graft_count_vs_quote",
  "sydney-hair-institute": "benchmark",
};

export type EnterpriseDemoGraftCountEventSpec = {
  demoGraftEventKey: string;
  eventType: "count_update" | "tray_count" | "tray_confirmed" | "graft_reconciliation";
  deltaExtracted: number;
  deltaImplanted: number;
  deltaDiscarded: number;
  singles: number | null;
  doubles: number | null;
  triples: number | null;
  multiples: number | null;
  totalHairs: number | null;
  note: string | null;
  sequenceOrder: number;
};

export type EnterpriseDemoGraftSessionSpec = {
  demoGraftSessionKey: string;
  phase: "extraction" | "implantation" | "tray_count" | "reconciliation";
  targetGrafts: number;
  extractedGrafts: number;
  implantedGrafts: number;
  discardedGrafts: number;
  remainingGrafts: number;
  singles: number;
  doubles: number;
  triples: number;
  multiples: number;
  totalHairs: number;
  averageHairsPerGraft: number;
  reconciliationStatus: "pending" | "balanced" | "mismatch" | "completed";
  skipReconciliationEvent: boolean;
  events: EnterpriseDemoGraftCountEventSpec[];
};

export type EnterpriseDemoSurgeryTeamRole = "surgeon" | "nurse" | "technician";

export type EnterpriseDemoSurgeryTeamMemberSpec = {
  role: EnterpriseDemoSurgeryTeamRole;
  demoStaffKey: string;
  assignmentStatus: "assigned" | "confirmed" | "checked_in" | "active" | "completed";
};

export type EnterpriseDemoSurgerySpec = {
  demoSurgeryKey: string;
  demoCaseKey: string;
  demoBookingKey: string;
  demoConsultationKey: string;
  demoPatientKey: string;
  clinicSlug: string;
  patientIndex: number;
  surgeryStatus: EnterpriseDemoSurgeryStatus;
  procedurePhase: string;
  liveStatus: string;
  leadSurgeonStaffKey: string;
  team: EnterpriseDemoSurgeryTeamMemberSpec[];
  procedureType: string;
  graftTarget: number;
  hairCountEstimate: number;
  quotedGraftEstimate: number | null;
  quotedValue: number | null;
  punchSize: string;
  extractionTechnique: EnterpriseDemoExtractionTechnique;
  implantationMethod: EnterpriseDemoImplantationMethod;
  dayCount: number;
  scheduledDate: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  timezone: string;
  performanceProfile: EnterpriseDemoClinicPerformanceProfile;
  transectionRatePercent: number | null;
  invoiceGraftPlaceholder: number | null;
  graftSession: EnterpriseDemoGraftSessionSpec | null;
  consultationStatus: string;
  displayName: string;
  email: string;
  gender: string;
};

const SURGERY_STATUS_TEMPLATE: readonly EnterpriseDemoSurgeryStatus[] = [
  "completed",
  "completed",
  "completed",
  "in_progress",
  "in_progress",
  "pre_op",
  "pre_op",
  "scheduled",
  "scheduled",
  "paused",
  "completed",
  "in_progress",
];

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

function clinicPerformanceProfile(clinicSlug: string): EnterpriseDemoClinicPerformanceProfile {
  return ENTERPRISE_DEMO_CLINIC_PERFORMANCE_PROFILES[clinicSlug] ?? "default";
}

function procedurePhaseForStatus(status: EnterpriseDemoSurgeryStatus): string {
  switch (status) {
    case "scheduled":
      return "pre_op";
    case "pre_op":
      return "patient_arrived";
    case "in_progress":
      return "implantation";
    case "paused":
      return "extraction_paused";
    case "completed":
      return "completed";
    default:
      return "pre_op";
  }
}

function liveStatusForSurgeryStatus(status: EnterpriseDemoSurgeryStatus): string {
  switch (status) {
    case "scheduled":
      return "waiting";
    case "pre_op":
      return "waiting";
    case "in_progress":
      return "active";
    case "paused":
      return "break";
    case "completed":
      return "completed";
    default:
      return "waiting";
  }
}

function scheduledWindowForSurgery(
  consultationDate: string,
  clinicSurgeryIndex: number,
  demoBookingKey: string,
  _timezone: string
): { scheduledDate: string; scheduledStartAt: string; scheduledEndAt: string } {
  const base = new Date(`${consultationDate}T10:00:00.000Z`);
  // Two 6-hour theatre slots per day per lead surgeon; spread 12 clinic surgeries across days.
  const dayOffset = Math.floor(clinicSurgeryIndex / 2) + (stableHash(demoBookingKey) % 2);
  const daysForward = 14 + dayOffset;
  base.setUTCDate(base.getUTCDate() + daysForward);
  const scheduledDate = base.toISOString().slice(0, 10);
  const start = new Date(base);
  start.setUTCHours(clinicSurgeryIndex % 2 === 0 ? 8 : 14, 30, 0, 0);
  const end = new Date(start);
  end.setUTCHours(start.getUTCHours() + 6);
  return {
    scheduledDate,
    scheduledStartAt: start.toISOString(),
    scheduledEndAt: end.toISOString(),
  };
}

function resolveGraftTarget(
  spec: EnterpriseDemoPatientConsultationSpec,
  profile: EnterpriseDemoClinicPerformanceProfile
): number {
  const base = spec.graftEstimate ?? 1500 + (stableHash(spec.demoPatientKey) % 1200);
  if (profile === "graft_count_vs_quote") {
    return base + 400 + (stableHash(spec.demoPatientKey) % 300);
  }
  if (profile === "benchmark") {
    return Math.max(800, base - 150);
  }
  return base;
}

function averageHairsPerGraftForProfile(
  profile: EnterpriseDemoClinicPerformanceProfile,
  key: string
): number {
  if (profile === "benchmark") return 2.45 + (stableHash(key) % 10) / 100;
  if (profile === "elevated_transection") return 1.85 + (stableHash(key) % 8) / 100;
  return 2.1 + (stableHash(key) % 15) / 100;
}

function transectionRateForProfile(
  profile: EnterpriseDemoClinicPerformanceProfile,
  key: string
): number | null {
  if (profile !== "elevated_transection") return null;
  return 12 + (stableHash(key) % 9);
}

function discardGraftsForProfile(
  profile: EnterpriseDemoClinicPerformanceProfile,
  extracted: number,
  _key: string
): number {
  if (profile === "benchmark") return Math.max(8, Math.round(extracted * 0.02));
  if (profile === "elevated_transection") return Math.max(45, Math.round(extracted * 0.09));
  return Math.max(15, Math.round(extracted * 0.04));
}

function buildGraftSessionSpec(
  surgeryKey: string,
  status: EnterpriseDemoSurgeryStatus,
  profile: EnterpriseDemoClinicPerformanceProfile,
  graftTarget: number,
  quotedGraftEstimate: number | null,
  patientKey: string,
  patientIndex: number
): EnterpriseDemoGraftSessionSpec | null {
  if (status === "scheduled" || status === "pre_op") return null;

  const demoGraftSessionKey = `${surgeryKey}-graft-session`;
  const avgHairs = averageHairsPerGraftForProfile(profile, patientKey);
  const progressRatio =
    status === "completed"
      ? 1
      : status === "paused"
        ? 0.55
        : status === "in_progress"
          ? 0.72 + (stableHash(patientKey) % 15) / 100
          : 0.35;

  let extracted = Math.round(graftTarget * progressRatio);
  if (profile === "graft_count_vs_quote" && quotedGraftEstimate != null) {
    extracted = Math.round(quotedGraftEstimate * (1.18 + (stableHash(patientKey) % 12) / 100));
  }

  const discarded = discardGraftsForProfile(profile, extracted, patientKey);
  const implanted =
    status === "completed"
      ? extracted - discarded
      : Math.max(0, Math.round((extracted - discarded) * (status === "paused" ? 0.4 : 0.65)));

  const remaining = extracted - implanted - discarded;
  const compositionTotal = extracted;
  const singles = Math.round(compositionTotal * 0.18);
  const doubles = Math.round(compositionTotal * 0.42);
  const triples = Math.round(compositionTotal * 0.28);
  const multiples = Math.max(0, compositionTotal - singles - doubles - triples);
  const totalHairs = Math.round(extracted * avgHairs);

  const skipReconciliationEvent =
    profile === "missing_reconciliation" && status === "completed" && patientIndex % 3 !== 0;

  let reconciliationStatus: EnterpriseDemoGraftSessionSpec["reconciliationStatus"] = "pending";
  if (status === "completed" && !skipReconciliationEvent) {
    reconciliationStatus = profile === "benchmark" ? "completed" : "balanced";
  } else if (skipReconciliationEvent) {
    reconciliationStatus = remaining !== 0 ? "mismatch" : "pending";
  }

  const events: EnterpriseDemoGraftCountEventSpec[] = [];
  const extractionDelta = Math.round(extracted * 0.45);
  events.push({
    demoGraftEventKey: `${demoGraftSessionKey}-count-update-1`,
    eventType: "count_update",
    deltaExtracted: extractionDelta,
    deltaImplanted: 0,
    deltaDiscarded: Math.round(discarded * 0.3),
    singles: null,
    doubles: null,
    triples: null,
    multiples: null,
    totalHairs: Math.round(extractionDelta * avgHairs),
    note: "Mid-extraction count checkpoint",
    sequenceOrder: 1,
  });

  const traySingles = Math.round(extractionDelta * 0.2);
  const trayDoubles = Math.round(extractionDelta * 0.45);
  const trayTriples = Math.round(extractionDelta * 0.25);
  const trayMultiples = Math.max(0, extractionDelta - traySingles - trayDoubles - trayTriples);
  events.push({
    demoGraftEventKey: `${demoGraftSessionKey}-tray-count-1`,
    eventType: "tray_count",
    deltaExtracted: 0,
    deltaImplanted: 0,
    deltaDiscarded: 0,
    singles: traySingles,
    doubles: trayDoubles,
    triples: trayTriples,
    multiples: trayMultiples,
    totalHairs: traySingles + trayDoubles * 2 + trayTriples * 3 + trayMultiples * 4,
    note: "Tray #1",
    sequenceOrder: 2,
  });

  events.push({
    demoGraftEventKey: `${demoGraftSessionKey}-tray-confirmed-1`,
    eventType: "tray_confirmed",
    deltaExtracted: 0,
    deltaImplanted: 0,
    deltaDiscarded: 0,
    singles: null,
    doubles: null,
    triples: null,
    multiples: null,
    totalHairs: null,
    note: "Tray #1 confirmed by lead nurse",
    sequenceOrder: 3,
  });

  if (!skipReconciliationEvent && status === "completed") {
    events.push({
      demoGraftEventKey: `${demoGraftSessionKey}-reconciliation`,
      eventType: "graft_reconciliation",
      deltaExtracted: extracted - extractionDelta,
      deltaImplanted: implanted,
      deltaDiscarded: discarded - Math.round(discarded * 0.3),
      singles: singles,
      doubles: doubles,
      triples: triples,
      multiples: multiples,
      totalHairs: totalHairs,
      note: "Final graft reconciliation",
      sequenceOrder: 4,
    });
  }

  return {
    demoGraftSessionKey,
    phase: status === "completed" ? "reconciliation" : status === "paused" ? "extraction" : "implantation",
    targetGrafts: graftTarget,
    extractedGrafts: extracted,
    implantedGrafts: implanted,
    discardedGrafts: discarded,
    remainingGrafts: remaining,
    singles,
    doubles,
    triples,
    multiples,
    totalHairs,
    averageHairsPerGraft: Math.round(avgHairs * 100) / 100,
    reconciliationStatus,
    skipReconciliationEvent,
    events,
  };
}

function buildSurgerySpecFromPatient(
  patientSpec: EnterpriseDemoPatientConsultationSpec,
  surgeryStatus: EnterpriseDemoSurgeryStatus,
  clinicSurgeryIndex: number
): EnterpriseDemoSurgerySpec {
  const demoSurgeryKey = `${patientSpec.demoConsultationKey}-surgery`;
  const demoCaseKey = `${patientSpec.demoPatientKey}-case`;
  const demoBookingKey = `${patientSpec.demoConsultationKey}-surgery-booking`;
  const profile = clinicPerformanceProfile(patientSpec.clinicSlug);
  const graftTarget = resolveGraftTarget(patientSpec, profile);
  const avgHairs = averageHairsPerGraftForProfile(profile, patientSpec.demoPatientKey);
  const hairCountEstimate = Math.round(graftTarget * avgHairs);
  const scheduled = scheduledWindowForSurgery(
    patientSpec.consultationDate,
    clinicSurgeryIndex,
    demoBookingKey,
    patientSpec.timezone
  );

  const quotedTreatment = patientSpec.quotedTreatment ?? "FUE hair transplant — single session";
  const procedureType = quotedTreatment.includes("Beard")
    ? "beard_transplant"
    : quotedTreatment.includes("Eyebrow")
      ? "eyebrow_transplant"
      : "scalp_hair_transplant";

  const dayCount = quotedTreatment.includes("two-stage") ? 2 : 1;
  const clinicSlug = patientSpec.clinicSlug;

  const team: EnterpriseDemoSurgeryTeamMemberSpec[] = [
    {
      role: "surgeon",
      demoStaffKey: `${clinicSlug}-lead-surgeon`,
      assignmentStatus:
        surgeryStatus === "completed"
          ? "completed"
          : surgeryStatus === "in_progress" || surgeryStatus === "paused"
            ? "active"
            : "confirmed",
    },
    {
      role: "nurse",
      demoStaffKey: `${clinicSlug}-lead-nurse`,
      assignmentStatus:
        surgeryStatus === "completed" ? "completed" : surgeryStatus === "scheduled" ? "assigned" : "checked_in",
    },
    {
      role: "technician",
      demoStaffKey: `${clinicSlug}-technician`,
      assignmentStatus:
        surgeryStatus === "completed"
          ? "completed"
          : surgeryStatus === "in_progress" || surgeryStatus === "paused"
            ? "active"
            : "confirmed",
    },
  ];

  const invoiceGraftPlaceholder =
    profile === "graft_count_vs_quote" ? patientSpec.graftEstimate ?? graftTarget : null;

  return {
    demoSurgeryKey,
    demoCaseKey,
    demoBookingKey,
    demoConsultationKey: patientSpec.demoConsultationKey,
    demoPatientKey: patientSpec.demoPatientKey,
    clinicSlug,
    patientIndex: patientSpec.patientIndex,
    surgeryStatus,
    procedurePhase: procedurePhaseForStatus(surgeryStatus),
    liveStatus: liveStatusForSurgeryStatus(surgeryStatus),
    leadSurgeonStaffKey: `${clinicSlug}-lead-surgeon`,
    team,
    procedureType,
    graftTarget,
    hairCountEstimate,
    quotedGraftEstimate: patientSpec.graftEstimate,
    quotedValue: patientSpec.quotedValue,
    punchSize: pick(ENTERPRISE_DEMO_PUNCH_SIZES, patientSpec.demoPatientKey, "punch"),
    extractionTechnique: pick(ENTERPRISE_DEMO_EXTRACTION_TECHNIQUES, patientSpec.demoPatientKey, "technique"),
    implantationMethod: pick(ENTERPRISE_DEMO_IMPLANTATION_METHODS, patientSpec.demoPatientKey, "implant"),
    dayCount,
    scheduledDate: scheduled.scheduledDate,
    scheduledStartAt: scheduled.scheduledStartAt,
    scheduledEndAt: scheduled.scheduledEndAt,
    timezone: patientSpec.timezone,
    performanceProfile: profile,
    transectionRatePercent: transectionRateForProfile(profile, patientSpec.demoPatientKey),
    invoiceGraftPlaceholder,
    graftSession: buildGraftSessionSpec(
      demoSurgeryKey,
      surgeryStatus,
      profile,
      graftTarget,
      patientSpec.graftEstimate,
      patientSpec.demoPatientKey,
      patientSpec.patientIndex
    ),
    consultationStatus: patientSpec.consultationStatus,
    displayName: patientSpec.displayName,
    email: patientSpec.email,
    gender: patientSpec.gender,
  };
}

/**
 * Pure generator: synthetic surgery specs per demo clinic.
 */
export function buildEnterpriseDemoSurgerySpecs(
  patientSpecs?: EnterpriseDemoPatientConsultationSpec[],
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): EnterpriseDemoSurgerySpec[] {
  const allPatients = patientSpecs ?? buildEnterpriseDemoPatientConsultationSpecs(volume);
  const specs: EnterpriseDemoSurgerySpec[] = [];

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const clinicPatients = allPatients
      .filter((p) => p.clinicSlug === clinic.slug)
      .sort((a, b) => a.patientIndex - b.patientIndex);
    const surgeryCandidates = clinicPatients
      .filter((p) =>
        ["quoted", "accepted", "converted_to_case"].includes(p.consultationStatus)
      )
      .slice(-volume.surgeriesPerClinic);

    for (let i = 0; i < surgeryCandidates.length; i++) {
      const patientSpec = surgeryCandidates[i];
      const surgeryStatus = SURGERY_STATUS_TEMPLATE[Math.min(i, SURGERY_STATUS_TEMPLATE.length - 1)];
      specs.push(buildSurgerySpecFromPatient(patientSpec, surgeryStatus, i));
    }
  }

  return specs;
}

export function validateEnterpriseDemoSurgerySpecs(
  specs: EnterpriseDemoSurgerySpec[],
  volume: EnterpriseDemoVolumeOptions = ENTERPRISE_DEMO_DEFAULT_VOLUME
): { ok: true } | { ok: false; reason: string } {
  const expectedTotal = ENTERPRISE_DEMO_CLINICS.length * volume.surgeriesPerClinic;
  if (specs.length !== expectedTotal) {
    return {
      ok: false,
      reason: `Expected ${expectedTotal} surgery specs, got ${specs.length}.`,
    };
  }

  const surgeryKeys = new Set(specs.map((s) => s.demoSurgeryKey));
  const caseKeys = new Set(specs.map((s) => s.demoCaseKey));
  const bookingKeys = new Set(specs.map((s) => s.demoBookingKey));

  if (surgeryKeys.size !== specs.length) {
    return { ok: false, reason: "Duplicate demo_surgery_key values detected." };
  }
  if (caseKeys.size !== specs.length) {
    return { ok: false, reason: "Duplicate demo_case_key values detected." };
  }
  if (bookingKeys.size !== specs.length) {
    return { ok: false, reason: "Duplicate demo_booking_key values detected." };
  }

  for (const clinic of ENTERPRISE_DEMO_CLINICS) {
    const clinicSpecs = specs.filter((s) => s.clinicSlug === clinic.slug);
    if (clinicSpecs.length !== volume.surgeriesPerClinic) {
      return {
        ok: false,
        reason: `Clinic "${clinic.slug}" expected ${volume.surgeriesPerClinic} surgery specs.`,
      };
    }
  }

  for (const spec of specs) {
    if (spec.graftTarget <= 0) {
      return { ok: false, reason: `Invalid graft target for "${spec.demoSurgeryKey}".` };
    }
    if (spec.graftSession) {
      for (const event of spec.graftSession.events) {
        if (event.deltaExtracted < 0 || event.deltaImplanted < 0 || event.deltaDiscarded < 0) {
          return {
            ok: false,
            reason: `Negative graft delta on event "${event.demoGraftEventKey}".`,
          };
        }
      }
    }
  }

  const londonSpecs = specs.filter((s) => s.clinicSlug === "london-central-institute");
  const bangkokSpecs = specs.filter((s) => s.clinicSlug === "bangkok-restoration-centre");
  const dubaiSpecs = specs.filter((s) => s.clinicSlug === "dubai-hair-institute");
  const sydneySpecs = specs.filter((s) => s.clinicSlug === "sydney-hair-institute");

  if (!londonSpecs.some((s) => s.performanceProfile === "elevated_transection")) {
    return { ok: false, reason: "London clinic missing elevated transection profile." };
  }
  if (!bangkokSpecs.some((s) => s.graftSession?.skipReconciliationEvent)) {
    return { ok: false, reason: "Bangkok clinic missing skip-reconciliation anomaly cases." };
  }
  if (!dubaiSpecs.some((s) => s.performanceProfile === "graft_count_vs_quote")) {
    return { ok: false, reason: "Dubai clinic missing graft-vs-quote profile." };
  }
  if (!sydneySpecs.every((s) => s.performanceProfile === "benchmark")) {
    return { ok: false, reason: "Sydney clinic should be entirely benchmark profile." };
  }

  return { ok: true };
}

/** Metadata keys exported for seed idempotency (re-export for seed module). */
export const DEMO_METADATA_KEYS = {
  case: ENTERPRISE_DEMO_CASE_KEY_METADATA,
  booking: ENTERPRISE_DEMO_BOOKING_KEY_METADATA,
  surgery: ENTERPRISE_DEMO_SURGERY_KEY_METADATA,
  graftSession: ENTERPRISE_DEMO_GRAFT_SESSION_KEY_METADATA,
  graftEvent: ENTERPRISE_DEMO_GRAFT_EVENT_KEY_METADATA,
} as const;
