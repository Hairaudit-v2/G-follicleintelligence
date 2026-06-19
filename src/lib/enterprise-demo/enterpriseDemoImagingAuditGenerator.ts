import {
  ENTERPRISE_DEMO_AUDIT_KEY_METADATA,
  ENTERPRISE_DEMO_IMAGE_KEY_METADATA,
  ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA,
} from "./enterpriseDemoConstants";
import {
  buildEnterpriseDemoSurgerySpecs,
  type EnterpriseDemoClinicPerformanceProfile,
  type EnterpriseDemoSurgerySpec,
  type EnterpriseDemoSurgeryStatus,
} from "./enterpriseDemoSurgeriesGenerator";

/** Canonical TITAN surgery-outcome imaging slots (metadata-only demo capture). */
export const ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS = [
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
  "12_month",
] as const;

export type EnterpriseDemoImagingProtocolSlot = (typeof ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS)[number];

export const ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG = "titan_surgery_outcome";

export type EnterpriseDemoImagingCompletionProfile =
  | "excellent_completion"
  | "complete_with_quality_flags"
  | "missing_follow_up"
  | "graft_tray_mismatch"
  | "standard_completion";

export type EnterpriseDemoAuditStatus =
  | "approved"
  | "changes_required"
  | "incomplete_follow_up"
  | "graft_variance_warning"
  | "not_applicable";

export type EnterpriseDemoImageQualityStatus = "pass" | "warn" | "fail";

export type EnterpriseDemoImageSpec = {
  demoImageKey: string;
  demoSurgeryKey: string;
  demoPatientKey: string;
  demoCaseKey: string;
  clinicSlug: string;
  slot: EnterpriseDemoImagingProtocolSlot;
  storagePath: string;
  originalFilename: string;
  imageCategory: "consult" | "scalp" | "donor" | "post_op" | "progress" | "before" | "after";
  imagingLibraryAxis: "consultation" | "surgery" | "follow_up";
  anatomicalRegion:
    | "hairline"
    | "frontal_third"
    | "midscalp"
    | "crown"
    | "donor"
    | "temple_left"
    | "temple_right"
    | "global"
    | "other";
  visitType: string;
  followUpInterval: string | null;
  takenAt: string;
  qualityStatus: EnterpriseDemoImageQualityStatus;
  qualityFlags: string[];
  synthetic: true;
};

export type EnterpriseDemoProtocolSessionSpec = {
  demoProtocolSessionKey: string;
  demoSurgeryKey: string;
  demoCaseKey: string;
  demoPatientKey: string;
  clinicSlug: string;
  templateSlug: typeof ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG;
  completionProfile: EnterpriseDemoImagingCompletionProfile;
  protocolCompletionStatus: ImagingOsDemoProtocolCompletionStatus;
  slotsExpected: number;
  slotsFilled: number;
  missingSlots: EnterpriseDemoImagingProtocolSlot[];
  qualityFlaggedSlots: EnterpriseDemoImagingProtocolSlot[];
  slotImageKeys: Partial<Record<EnterpriseDemoImagingProtocolSlot, string>>;
};

export type ImagingOsDemoProtocolCompletionStatus =
  | "excellent"
  | "complete_with_flags"
  | "missing_follow_up"
  | "graft_tray_mismatch"
  | "partial";

export type EnterpriseDemoOutcomeAuditSpec = {
  demoAuditKey: string;
  demoSurgeryKey: string;
  demoCaseKey: string;
  demoPatientKey: string;
  clinicSlug: string;
  checkpointKey: "month_3" | "month_6" | "month_12";
  measurementDate: string;
  auditStatus: EnterpriseDemoAuditStatus;
  metricValues: {
    graft_survival_estimate: number;
    density_change: number;
    donor_recovery_score: number;
    hairline_design_score: number;
    patient_satisfaction_score: number;
    audit_score_available: number;
  };
  confidenceLevel: "low" | "medium" | "high";
  warnings: string[];
  imagingRefs: string[];
};

export type EnterpriseDemoImagingAuditBundleSpec = {
  surgery: EnterpriseDemoSurgerySpec;
  images: EnterpriseDemoImageSpec[];
  protocolSession: EnterpriseDemoProtocolSessionSpec | null;
  outcomeAudits: EnterpriseDemoOutcomeAuditSpec[];
};

export const ENTERPRISE_DEMO_CLINIC_IMAGING_PROFILES: Record<
  string,
  EnterpriseDemoImagingCompletionProfile
> = {
  "sydney-hair-institute": "excellent_completion",
  "london-central-institute": "complete_with_quality_flags",
  "bangkok-restoration-centre": "missing_follow_up",
  "dubai-hair-institute": "graft_tray_mismatch",
};

const BASELINE_SLOTS: readonly EnterpriseDemoImagingProtocolSlot[] = [
  "front",
  "left",
  "right",
  "top",
  "crown",
  "donor",
];

const SURGERY_DAY_SLOTS: readonly EnterpriseDemoImagingProtocolSlot[] = [
  "immediate_post_op",
  "graft_tray",
];

const FOLLOW_UP_SLOTS: readonly EnterpriseDemoImagingProtocolSlot[] = ["3_month", "6_month", "12_month"];

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

function imagingProfileForClinic(clinicSlug: string): EnterpriseDemoImagingCompletionProfile {
  return ENTERPRISE_DEMO_CLINIC_IMAGING_PROFILES[clinicSlug] ?? "standard_completion";
}

function protocolCompletionStatusForProfile(
  profile: EnterpriseDemoImagingCompletionProfile,
  missingFollowUp: boolean,
  hasGraftTrayMismatch: boolean,
  hasQualityFlags: boolean,
  slotsFilled: number,
  slotsExpected: number
): ImagingOsDemoProtocolCompletionStatus {
  if (slotsFilled < slotsExpected && !missingFollowUp) return "partial";
  if (profile === "excellent_completion") return "excellent";
  if (profile === "missing_follow_up" || missingFollowUp) return "missing_follow_up";
  if (profile === "graft_tray_mismatch" || hasGraftTrayMismatch) return "graft_tray_mismatch";
  if (profile === "complete_with_quality_flags" || hasQualityFlags) return "complete_with_flags";
  return "complete_with_flags";
}

function includesSurgeryDayCapture(status: EnterpriseDemoSurgeryStatus): boolean {
  return status === "in_progress" || status === "paused" || status === "completed";
}

function includesFollowUpCapture(status: EnterpriseDemoSurgeryStatus): boolean {
  return status === "completed";
}

export function resolveIncludedImagingSlots(
  surgeryStatus: EnterpriseDemoSurgeryStatus,
  imagingProfile: EnterpriseDemoImagingCompletionProfile
): EnterpriseDemoImagingProtocolSlot[] {
  const slots: EnterpriseDemoImagingProtocolSlot[] = [...BASELINE_SLOTS];

  if (includesSurgeryDayCapture(surgeryStatus)) {
    slots.push(...SURGERY_DAY_SLOTS);
  }

  if (includesFollowUpCapture(surgeryStatus)) {
    if (imagingProfile === "missing_follow_up") {
      return slots;
    }
    slots.push(...FOLLOW_UP_SLOTS);
  }

  return slots;
}

function slotAnatomicalRegion(
  slot: EnterpriseDemoImagingProtocolSlot
): EnterpriseDemoImageSpec["anatomicalRegion"] {
  switch (slot) {
    case "front":
    case "immediate_post_op":
      return "hairline";
    case "left":
      return "temple_left";
    case "right":
      return "temple_right";
    case "top":
      return "global";
    case "crown":
      return "crown";
    case "donor":
      return "donor";
    case "graft_tray":
      return "other";
    case "3_month":
    case "6_month":
    case "12_month":
      return "frontal_third";
    default:
      return "other";
  }
}

function slotImageCategory(
  slot: EnterpriseDemoImagingProtocolSlot
): EnterpriseDemoImageSpec["imageCategory"] {
  if (slot === "donor") return "donor";
  if (slot === "immediate_post_op" || slot === "graft_tray") return "post_op";
  if (slot === "3_month" || slot === "6_month" || slot === "12_month") return "progress";
  return "scalp";
}

function slotLibraryAxis(
  slot: EnterpriseDemoImagingProtocolSlot
): EnterpriseDemoImageSpec["imagingLibraryAxis"] {
  if (slot === "immediate_post_op" || slot === "graft_tray") return "surgery";
  if (slot === "3_month" || slot === "6_month" || slot === "12_month") return "follow_up";
  return "consultation";
}

function slotFollowUpInterval(slot: EnterpriseDemoImagingProtocolSlot): string | null {
  if (slot === "3_month" || slot === "6_month" || slot === "12_month") return slot;
  return null;
}

function slotTakenAt(scheduledDate: string, slot: EnterpriseDemoImagingProtocolSlot): string {
  const base = new Date(`${scheduledDate}T09:00:00.000Z`);
  if (slot === "immediate_post_op" || slot === "graft_tray") {
    base.setUTCDate(base.getUTCDate());
  } else if (slot === "3_month") {
    base.setUTCMonth(base.getUTCMonth() + 3);
  } else if (slot === "6_month") {
    base.setUTCMonth(base.getUTCMonth() + 6);
  } else if (slot === "12_month") {
    base.setUTCMonth(base.getUTCMonth() + 12);
  } else {
    base.setUTCDate(base.getUTCDate() - 7);
  }
  return base.toISOString();
}

function qualityForSlot(
  slot: EnterpriseDemoImagingProtocolSlot,
  imagingProfile: EnterpriseDemoImagingCompletionProfile,
  surgeryKey: string
): { qualityStatus: EnterpriseDemoImageQualityStatus; qualityFlags: string[] } {
  if (imagingProfile === "excellent_completion" || imagingProfile === "standard_completion") {
    return { qualityStatus: "pass", qualityFlags: [] };
  }

  if (imagingProfile === "graft_tray_mismatch" && slot === "graft_tray") {
    return {
      qualityStatus: "fail",
      qualityFlags: ["graft_count_mismatch", "tray_reconciliation_variance"],
    };
  }

  if (imagingProfile === "complete_with_quality_flags") {
    const flaggedSlots = pick(
      ["front", "left", "donor", "crown", "top"] as const,
      surgeryKey,
      "quality-slot-1"
    );
    const flaggedSlots2 = pick(
      ["right", "immediate_post_op", "6_month"] as const,
      surgeryKey,
      "quality-slot-2"
    );
    if (slot === flaggedSlots || slot === flaggedSlots2) {
      return {
        qualityStatus: "warn",
        qualityFlags: pick(
          [
            ["lighting_suboptimal", "angle_deviation"],
            ["motion_blur", "insufficient_resolution"],
            ["hair_obscuring_hairline", "background_clutter"],
          ] as const,
          surgeryKey,
          slot
        ),
      };
    }
  }

  return { qualityStatus: "pass", qualityFlags: [] };
}

function buildSyntheticStoragePath(demoImageKey: string): string {
  return `titan-demo/synthetic/${demoImageKey}.jpg`;
}

function outcomeMetricsForProfile(
  performanceProfile: EnterpriseDemoClinicPerformanceProfile,
  surgeryKey: string
): EnterpriseDemoOutcomeAuditSpec["metricValues"] {
  const hash = stableHash(surgeryKey);
  const jitter = (hash % 7) / 100;

  if (performanceProfile === "benchmark") {
    return {
      graft_survival_estimate: 0.93 + jitter,
      density_change: 0.22 + jitter / 2,
      donor_recovery_score: 9.1 + jitter,
      hairline_design_score: 9.3 + jitter,
      patient_satisfaction_score: 9,
      audit_score_available: 1,
    };
  }

  if (performanceProfile === "elevated_transection") {
    return {
      graft_survival_estimate: 0.78 + jitter / 2,
      density_change: 0.11 + jitter / 3,
      donor_recovery_score: 7.2 + jitter,
      hairline_design_score: 7.8 + jitter,
      patient_satisfaction_score: 7,
      audit_score_available: 1,
    };
  }

  if (performanceProfile === "missing_reconciliation") {
    return {
      graft_survival_estimate: 0.84 + jitter / 2,
      density_change: 0.14 + jitter / 3,
      donor_recovery_score: 7.9 + jitter,
      hairline_design_score: 8.1 + jitter,
      patient_satisfaction_score: 8,
      audit_score_available: 0,
    };
  }

  if (performanceProfile === "graft_count_vs_quote") {
    return {
      graft_survival_estimate: 0.86 + jitter / 2,
      density_change: 0.16 + jitter / 3,
      donor_recovery_score: 8.0 + jitter,
      hairline_design_score: 8.4 + jitter,
      patient_satisfaction_score: 8,
      audit_score_available: 1,
    };
  }

  return {
    graft_survival_estimate: 0.88 + jitter / 2,
    density_change: 0.17 + jitter / 3,
    donor_recovery_score: 8.3 + jitter,
    hairline_design_score: 8.6 + jitter,
    patient_satisfaction_score: 8,
    audit_score_available: 1,
  };
}

function auditStatusForProfile(
  performanceProfile: EnterpriseDemoClinicPerformanceProfile,
  imagingProfile: EnterpriseDemoImagingCompletionProfile
): EnterpriseDemoAuditStatus {
  if (imagingProfile === "missing_follow_up") return "incomplete_follow_up";
  if (performanceProfile === "elevated_transection") return "changes_required";
  if (performanceProfile === "graft_count_vs_quote") return "graft_variance_warning";
  if (performanceProfile === "benchmark") return "approved";
  if (performanceProfile === "missing_reconciliation") return "incomplete_follow_up";
  return "approved";
}

function outcomeWarningsForProfile(
  performanceProfile: EnterpriseDemoClinicPerformanceProfile,
  imagingProfile: EnterpriseDemoImagingCompletionProfile
): string[] {
  const warnings: string[] = [];
  if (performanceProfile === "elevated_transection") {
    warnings.push("Elevated transection rate may depress graft survival estimate.");
    warnings.push("Outcome audit flagged for clinical review.");
  }
  if (performanceProfile === "graft_count_vs_quote") {
    warnings.push("Extracted graft count exceeded quoted estimate; tray imaging variance detected.");
  }
  if (imagingProfile === "missing_follow_up") {
    warnings.push("Follow-up imaging incomplete; audit cannot be closed.");
  }
  if (performanceProfile === "missing_reconciliation") {
    warnings.push("Graft reconciliation incomplete; outcome confidence reduced.");
  }
  return warnings;
}

function buildOutcomeAuditsForSurgery(
  surgery: EnterpriseDemoSurgerySpec,
  imagingProfile: EnterpriseDemoImagingCompletionProfile,
  imageKeys: EnterpriseDemoImageSpec[]
): EnterpriseDemoOutcomeAuditSpec[] {
  if (surgery.surgeryStatus !== "completed") return [];

  const metrics = outcomeMetricsForProfile(surgery.performanceProfile, surgery.demoSurgeryKey);
  const auditStatus = auditStatusForProfile(surgery.performanceProfile, imagingProfile);
  const warnings = outcomeWarningsForProfile(surgery.performanceProfile, imagingProfile);

  const checkpoints: EnterpriseDemoOutcomeAuditSpec["checkpointKey"][] =
    imagingProfile === "missing_follow_up" ? ["month_3"] : ["month_3", "month_6", "month_12"];

  return checkpoints.map((checkpointKey) => {
    const monthOffset = checkpointKey === "month_3" ? 3 : checkpointKey === "month_6" ? 6 : 12;
    const measurementDate = new Date(`${surgery.scheduledDate}T00:00:00.000Z`);
    measurementDate.setUTCMonth(measurementDate.getUTCMonth() + monthOffset);

    const slotPrefix =
      checkpointKey === "month_3" ? "3_month" : checkpointKey === "month_6" ? "6_month" : "12_month";
    const linkedImages = imageKeys.filter((img) => img.slot === slotPrefix).map((img) => img.demoImageKey);

    return {
      demoAuditKey: `${surgery.demoSurgeryKey}-outcome-${checkpointKey}`,
      demoSurgeryKey: surgery.demoSurgeryKey,
      demoCaseKey: surgery.demoCaseKey,
      demoPatientKey: surgery.demoPatientKey,
      clinicSlug: surgery.clinicSlug,
      checkpointKey,
      measurementDate: measurementDate.toISOString().slice(0, 10),
      auditStatus:
        imagingProfile === "missing_follow_up" && checkpointKey !== "month_3"
          ? "not_applicable"
          : auditStatus,
      metricValues: {
        ...metrics,
        audit_score_available:
          imagingProfile === "missing_follow_up" && checkpointKey === "month_3" ? 0 : metrics.audit_score_available,
      },
      confidenceLevel:
        imagingProfile === "missing_follow_up" || surgery.performanceProfile === "missing_reconciliation"
          ? "low"
          : surgery.performanceProfile === "benchmark"
            ? "high"
            : "medium",
      warnings,
      imagingRefs: linkedImages,
    };
  });
}

/**
 * Pure generator: synthetic ImagingOS + AuditOS bundle per demo surgery (96 total).
 */
export function buildEnterpriseDemoImagingAuditBundles(
  surgerySpecs?: EnterpriseDemoSurgerySpec[]
): EnterpriseDemoImagingAuditBundleSpec[] {
  const surgeries = surgerySpecs ?? buildEnterpriseDemoSurgerySpecs();

  return surgeries.map((surgery) => {
    const imagingProfile = imagingProfileForClinic(surgery.clinicSlug);
    const includedSlots = resolveIncludedImagingSlots(surgery.surgeryStatus, imagingProfile);
    const missingSlots = ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS.filter(
      (slot) => !includedSlots.includes(slot)
    );

    const images: EnterpriseDemoImageSpec[] = includedSlots.map((slot) => {
      const demoImageKey = `${surgery.demoSurgeryKey}-image-${slot}`;
      const { qualityStatus, qualityFlags } = qualityForSlot(
        slot,
        imagingProfile,
        surgery.demoSurgeryKey
      );

      return {
        demoImageKey,
        demoSurgeryKey: surgery.demoSurgeryKey,
        demoPatientKey: surgery.demoPatientKey,
        demoCaseKey: surgery.demoCaseKey,
        clinicSlug: surgery.clinicSlug,
        slot,
        storagePath: buildSyntheticStoragePath(demoImageKey),
        originalFilename: `${slot}.jpg`,
        imageCategory: slotImageCategory(slot),
        imagingLibraryAxis: slotLibraryAxis(slot),
        anatomicalRegion: slotAnatomicalRegion(slot),
        visitType: slotLibraryAxis(slot) === "follow_up" ? "follow_up_review" : "surgery_case",
        followUpInterval: slotFollowUpInterval(slot),
        takenAt: slotTakenAt(surgery.scheduledDate, slot),
        qualityStatus,
        qualityFlags,
        synthetic: true,
      };
    });

    const qualityFlaggedSlots = images
      .filter((img) => img.qualityStatus !== "pass")
      .map((img) => img.slot);

    const hasGraftTrayMismatch = qualityFlaggedSlots.includes("graft_tray");
    const hasQualityFlags = qualityFlaggedSlots.some((slot) => slot !== "graft_tray");
    const missingFollowUp = imagingProfile === "missing_follow_up" && surgery.surgeryStatus === "completed";

    const protocolSession: EnterpriseDemoProtocolSessionSpec | null =
      images.length > 0
        ? {
            demoProtocolSessionKey: `${surgery.demoSurgeryKey}-imaging-protocol`,
            demoSurgeryKey: surgery.demoSurgeryKey,
            demoCaseKey: surgery.demoCaseKey,
            demoPatientKey: surgery.demoPatientKey,
            clinicSlug: surgery.clinicSlug,
            templateSlug: ENTERPRISE_DEMO_IMAGING_PROTOCOL_TEMPLATE_SLUG,
            completionProfile: imagingProfile,
            protocolCompletionStatus: protocolCompletionStatusForProfile(
              imagingProfile,
              missingFollowUp,
              hasGraftTrayMismatch,
              hasQualityFlags,
              images.length,
              ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS.length
            ),
            slotsExpected: ENTERPRISE_DEMO_IMAGING_PROTOCOL_SLOTS.length,
            slotsFilled: images.length,
            missingSlots,
            qualityFlaggedSlots,
            slotImageKeys: Object.fromEntries(images.map((img) => [img.slot, img.demoImageKey])) as Partial<
              Record<EnterpriseDemoImagingProtocolSlot, string>
            >,
          }
        : null;

    const outcomeAudits = buildOutcomeAuditsForSurgery(surgery, imagingProfile, images);

    return {
      surgery,
      images,
      protocolSession,
      outcomeAudits,
    };
  });
}

export function validateEnterpriseDemoImagingAuditBundles(
  bundles: EnterpriseDemoImagingAuditBundleSpec[]
): { ok: true } | { ok: false; reason: string } {
  if (bundles.length !== 96) {
    return { ok: false, reason: `Expected 96 imaging/audit bundles, got ${bundles.length}.` };
  }

  const imageKeys = new Set<string>();
  const auditKeys = new Set<string>();

  for (const bundle of bundles) {
    for (const image of bundle.images) {
      if (imageKeys.has(image.demoImageKey)) {
        return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_IMAGE_KEY_METADATA}: ${image.demoImageKey}` };
      }
      imageKeys.add(image.demoImageKey);
      if (!image.storagePath.includes("titan-demo/synthetic/")) {
        return { ok: false, reason: `Non-synthetic storage path for ${image.demoImageKey}.` };
      }
    }

    for (const audit of bundle.outcomeAudits) {
      if (auditKeys.has(audit.demoAuditKey)) {
        return { ok: false, reason: `Duplicate ${ENTERPRISE_DEMO_AUDIT_KEY_METADATA}: ${audit.demoAuditKey}` };
      }
      auditKeys.add(audit.demoAuditKey);
    }

    if (bundle.protocolSession) {
      const filled = Object.keys(bundle.protocolSession.slotImageKeys).length;
      if (filled !== bundle.images.length) {
        return {
          ok: false,
          reason: `Protocol session slot map mismatch for ${bundle.surgery.demoSurgeryKey}.`,
        };
      }
    }
  }

  const sydneyCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "sydney-hair-institute" && b.surgery.surgeryStatus === "completed"
  );
  if (!sydneyCompleted.every((b) => b.protocolSession?.protocolCompletionStatus === "excellent")) {
    return { ok: false, reason: "Sydney completed surgeries should have excellent protocol completion." };
  }

  const londonCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "london-central-institute" && b.surgery.surgeryStatus === "completed"
  );
  if (!londonCompleted.some((b) => (b.protocolSession?.qualityFlaggedSlots.length ?? 0) > 0)) {
    return { ok: false, reason: "London completed surgeries should include quality-flagged slots." };
  }

  const bangkokCompleted = bundles.filter(
    (b) =>
      b.surgery.clinicSlug === "bangkok-restoration-centre" && b.surgery.surgeryStatus === "completed"
  );
  if (!bangkokCompleted.every((b) => b.protocolSession?.protocolCompletionStatus === "missing_follow_up")) {
    return { ok: false, reason: "Bangkok completed surgeries should miss follow-up imaging." };
  }

  const dubaiCompleted = bundles.filter(
    (b) => b.surgery.clinicSlug === "dubai-hair-institute" && b.surgery.surgeryStatus === "completed"
  );
  if (!dubaiCompleted.some((b) => b.protocolSession?.protocolCompletionStatus === "graft_tray_mismatch")) {
    return { ok: false, reason: "Dubai completed surgeries should flag graft-tray mismatch." };
  }

  return { ok: true };
}

/** Metadata keys exported for seed idempotency. */
export const DEMO_IMAGING_AUDIT_METADATA_KEYS = {
  image: ENTERPRISE_DEMO_IMAGE_KEY_METADATA,
  audit: ENTERPRISE_DEMO_AUDIT_KEY_METADATA,
  protocolSession: ENTERPRISE_DEMO_PROTOCOL_SESSION_KEY_METADATA,
} as const;
