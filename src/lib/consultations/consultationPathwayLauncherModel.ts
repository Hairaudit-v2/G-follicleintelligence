import {
  FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
  HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
  HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
} from "@/src/lib/consultationForms/consultationFormConstants";
import type { ConsultationFormInstanceWithTemplate } from "@/src/lib/consultationForms/consultationFormTypes";
import {
  getConsultationTypeDefinition,
  type ConsultationTypeId,
} from "@/src/lib/consultations/consultationTypeConfig";
import type { ConsultationRow } from "@/src/lib/consultations/consultationTypes";

export type ConsultationPathwayLauncherPathKey =
  | "hair_transplant"
  | "hair_loss_hli"
  | "female_hair_loss"
  | "repair"
  | "follow_up_review"
  | "scalp_pathology";

export type ConsultationPathwayProgressLabel = "not_started" | "in_progress" | "submitted";

export type ConsultationPathwayCardView = {
  pathKey: ConsultationPathwayLauncherPathKey;
  title: string;
  purpose: string;
  whenToUse: string;
  availability: "active" | "soon";
  href: string | null;
  templateSlug: string | null;
  progress: ConsultationPathwayProgressLabel;
  instanceId: string | null;
  recommended: boolean;
};

export type ConsultationPathwayLauncherViewModel = {
  recommendedPathKey: ConsultationPathwayLauncherPathKey | null;
  recommendedHint: string | null;
  cards: ConsultationPathwayCardView[];
};

const TRANSPLANT_CONSULTATION_TYPES: readonly ConsultationTypeId[] = [
  "scalp_hair_transplant",
  "eyebrow_transplant",
  "beard_transplant",
  "body_hair_transplant",
] as const;

const TREATMENT_FORWARD_CONSULTATION_TYPES: readonly ConsultationTypeId[] = [
  "medical_hair_loss",
  "prp_prf",
  "exosomes",
  "mesotherapy",
] as const;

/** Word-boundary tokens that weakly suggest a surgical / transplant pathway. */
const SURGERY_SIGNAL = /\b(fue|fut|transplant|transplantation|surgery|surgical|hairline|grafts?|strip\s+harvest)\b/i;

/**
 * Female-context hair loss signals (conservative overlap with surgery terms → neutral elsewhere).
 */
const FEMALE_SIGNAL =
  /\b(female\s+hair\s+loss|women'?s\s+hair\s+loss|womens\s+hair\s+loss|female\s+pattern|diffuse\s+female|female\s+thinning|postpartum|menopause|perimenopause|hormone|hormonal|\bpcos\b|polycystic|part\s+widening|\bludwig\b|\bsinclair\b|traction(\s+alopecia)?)\b/i;

function buildFemaleSignalHaystack(row: ConsultationRow): string {
  const typeLabel = getConsultationTypeDefinition(row.consultation_type as ConsultationTypeId).label;
  return [typeLabel, row.live_notes ?? "", row.recommendation_notes ?? "", JSON.stringify(row.structured_data ?? {})]
    .join("\n")
    .toLowerCase();
}

/**
 * Non-surgical / medical management signals (kept conservative — overlaps with surgery text are resolved as neutral).
 */
const TREATMENT_SIGNAL =
  /\b(shedding|diffuse\s+thinning|diffuse\s+loss|thinning|medical\s+hair\s+loss|medication|minoxidil|finasteride|dutasteride|laboratory|lab\s+work|blood\s+test|investigation|dermatolog|telogen\s+effluvium|alopecia\s+areata)\b/i;

function buildUserSignalText(row: ConsultationRow): string {
  const chunks = [row.live_notes ?? "", row.recommendation_notes ?? "", JSON.stringify(row.structured_data ?? {})];
  return chunks.join("\n").toLowerCase();
}

function buildConsultationSignalText(row: ConsultationRow): string {
  const typeLabel = getConsultationTypeDefinition(row.consultation_type as ConsultationTypeId).label;
  return [typeLabel, buildUserSignalText(row)].join("\n").toLowerCase();
}

/**
 * Lightweight, non-clinical hint only. Consultation type is the anchor; free-text can
 * gently override when it clearly points the other way. Returns null when signals conflict.
 */
export function recommendConsultationPathwayKey(row: ConsultationRow): ConsultationPathwayLauncherPathKey | null {
  const ct = row.consultation_type as ConsultationTypeId;
  const userHay = buildUserSignalText(row);
  const femaleHay = buildFemaleSignalHaystack(row);
  const female = FEMALE_SIGNAL.test(femaleHay);
  const surg = SURGERY_SIGNAL.test(userHay);
  const treat = TREATMENT_SIGNAL.test(userHay);
  const ambiguousText = surg && treat;

  if (ambiguousText) return null;
  if (female && surg) return null;
  if (female && !surg) return "female_hair_loss";

  if ((TRANSPLANT_CONSULTATION_TYPES as readonly string[]).includes(ct)) {
    if (treat && !surg) return "hair_loss_hli";
    return "hair_transplant";
  }
  if ((TREATMENT_FORWARD_CONSULTATION_TYPES as readonly string[]).includes(ct)) {
    if (surg && !treat) return "hair_transplant";
    return "hair_loss_hli";
  }

  const hay = buildConsultationSignalText(row);
  const surgAll = SURGERY_SIGNAL.test(hay);
  const treatAll = TREATMENT_SIGNAL.test(hay);
  if (surgAll && treatAll) return null;
  if (surgAll && !treatAll) return "hair_transplant";
  if (treatAll && !surgAll) return "hair_loss_hli";
  return null;
}

/** Prefer latest in-room instance for a catalog template slug (matches ensure mutations). */
export function pickLatestInRoomInstanceForTemplateSlug(
  instances: ConsultationFormInstanceWithTemplate[],
  templateSlug: string
): ConsultationFormInstanceWithTemplate | null {
  const slug = templateSlug.trim();
  const matches = instances.filter((i) => i.template.slug === slug && i.channel === "in_room");
  if (matches.length === 0) return null;
  matches.sort((a, b) => (a.updated_at < b.updated_at ? 1 : a.updated_at > b.updated_at ? -1 : 0));
  return matches[0] ?? null;
}

function progressForInstance(inst: ConsultationFormInstanceWithTemplate | null): ConsultationPathwayProgressLabel {
  if (!inst) return "not_started";
  if (inst.status === "draft") return "in_progress";
  return "submitted";
}

function ctaLabel(progress: ConsultationPathwayProgressLabel): string {
  if (progress === "not_started") return "Start";
  if (progress === "in_progress") return "Continue";
  return "Review";
}

export function consultationPathwayCtaLabel(progress: ConsultationPathwayProgressLabel): string {
  return ctaLabel(progress);
}

function recommendedHintFor(pathKey: ConsultationPathwayLauncherPathKey | null): string | null {
  if (pathKey === "hair_transplant") {
    return "Recommended: Hair Transplant - this record reads like a surgical / transplant-first consultation.";
  }
  if (pathKey === "hair_loss_hli") {
    return "Recommended: Hair Loss / HLI - this record reads like medical management, shedding, diffuse thinning, or investigation-led care.";
  }
  if (pathKey === "female_hair_loss") {
    return "Recommended: Female Hair Loss - this record mentions female-pattern context, hormones, postpartum, shedding, part widening, traction, or Ludwig / Sinclair grading.";
  }
  return null;
}

export function buildConsultationPathwayLauncherViewModel(input: {
  tenantId: string;
  consultationId: string;
  row: ConsultationRow;
  instances: ConsultationFormInstanceWithTemplate[];
}): ConsultationPathwayLauncherViewModel {
  const tenantId = input.tenantId.trim();
  const consultationId = input.consultationId.trim();
  const base = `/fi-admin/${encodeURIComponent(tenantId)}/consultations/${encodeURIComponent(consultationId)}`;

  const htInst = pickLatestInRoomInstanceForTemplateSlug(
    input.instances,
    HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG
  );
  const hliInst = pickLatestInRoomInstanceForTemplateSlug(
    input.instances,
    HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG
  );
  const femaleInst = pickLatestInRoomInstanceForTemplateSlug(
    input.instances,
    FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG
  );

  const htProgress = progressForInstance(htInst);
  const hliProgress = progressForInstance(hliInst);
  const femaleProgress = progressForInstance(femaleInst);

  const recommendedPathKey = recommendConsultationPathwayKey(input.row);
  const recommendedHint = recommendedHintFor(recommendedPathKey);

  const cards: ConsultationPathwayCardView[] = [
    {
      pathKey: "hair_transplant",
      title: "Hair Transplant Consultation",
      purpose: "Structured surgical candidacy, donor / recipient planning, and consent-ready documentation.",
      whenToUse: "Primary visit for FUE/FUT, hairline design, graft planning, or transplant candidacy.",
      availability: "active",
      href: `${base}/forms`,
      templateSlug: HAIR_TRANSPLANT_CONSULTATION_TEMPLATE_SLUG,
      progress: htProgress,
      instanceId: htInst?.id ?? null,
      recommended: recommendedPathKey === "hair_transplant",
    },
    {
      pathKey: "hair_loss_hli",
      title: "Hair Loss Treatment / HLI",
      purpose: "Medical hair-loss workup, lifestyle and treatment pathways, and longevity-oriented planning.",
      whenToUse: "Shedding, diffuse thinning, stabilisation, medications, labs, or non-surgical treatment planning.",
      availability: "active",
      href: `${base}/forms/hair-loss-treatment`,
      templateSlug: HAIR_LOSS_TREATMENT_CONSULTATION_TEMPLATE_SLUG,
      progress: hliProgress,
      instanceId: hliInst?.id ?? null,
      recommended: recommendedPathKey === "hair_loss_hli",
    },
    {
      pathKey: "female_hair_loss",
      title: "Female Hair Loss Consultation",
      purpose:
        "Female-context pattern assessment (Ludwig / Sinclair when indicated), hormonal and systemic screening, and HLI / Patient Twin routing — without surgical or graft planning fields.",
      whenToUse:
        "Female-pattern thinning, postpartum or hormonal shifts, shedding, part widening, traction concerns, or Ludwig / Sinclair–oriented visits.",
      availability: "active",
      href: `${base}/forms/female-hair-loss`,
      templateSlug: FEMALE_HAIR_LOSS_CONSULTATION_TEMPLATE_SLUG,
      progress: femaleProgress,
      instanceId: femaleInst?.id ?? null,
      recommended: recommendedPathKey === "female_hair_loss",
    },
    {
      pathKey: "repair",
      title: "Repair Consultation",
      purpose: "Prior surgery review, scar camouflage, and corrective planning.",
      whenToUse: "Previous transplant issues, poor density, wide scars, or revision planning.",
      availability: "soon",
      href: null,
      templateSlug: null,
      progress: "not_started",
      instanceId: null,
      recommended: false,
    },
    {
      pathKey: "follow_up_review",
      title: "Follow-up / Review",
      purpose: "Short revisit after treatment or surgery to track progress and adjust the plan.",
      whenToUse: "Scheduled review, post-op check-in, or interval monitoring (not the primary intake).",
      availability: "soon",
      href: null,
      templateSlug: null,
      progress: "not_started",
      instanceId: null,
      recommended: false,
    },
    {
      pathKey: "scalp_pathology",
      title: "Scalp Disorder / Pathology",
      purpose: "Inflammatory scalp disease, scarring alopecia, or biopsy-directed pathways.",
      whenToUse: "Scalp symptoms beyond pattern loss, suspected scarring alopecia, or pathology-led workup.",
      availability: "soon",
      href: null,
      templateSlug: null,
      progress: "not_started",
      instanceId: null,
      recommended: false,
    },
  ];

  return { recommendedPathKey, recommendedHint, cards };
}
