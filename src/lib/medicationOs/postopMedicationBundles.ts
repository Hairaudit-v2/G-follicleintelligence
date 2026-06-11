/**
 * SurgeryOS default post-operative MedicationOS bundle (template in code; no DB template table v1).
 * Canonical codes align with `fi_medication_os_canonical` seed in `20260719120001_fi_medication_os_v1.sql`.
 */
import { normaliseTherapyPlanItems } from "./medicationOsMutationPolicy";
import type { DraftTherapyPlanItemInput, PlanItemRole, PlanSource, PlanType } from "./medicationOsTypes";

/** Seeded tenant canonical codes for post-op categories (not `postop.*` design aliases). */
export const SURGERY_POSTOP_BUNDLE_V1_CANONICAL_CODES = ["antibiotics", "prednisolone", "pain_medication"] as const;
export type SurgeryPostopBundleV1CanonicalCode = (typeof SURGERY_POSTOP_BUNDLE_V1_CANONICAL_CODES)[number];

export const SURGERY_POSTOP_BUNDLE_PLAN_TITLE = "Post-operative medication plan";

export const SURGERY_POSTOP_BUNDLE_PLAN_METADATA = {
  postop_bundle_template: "surgery_postop_default_v1",
  bundle_version: 1,
} as const;

export type PostopMedicationBundleTemplateLine = {
  /** Product category for governance / tests (not a DB column). */
  category: "antibiotics" | "prednisolone" | "pain_medication";
  canonical_code: SurgeryPostopBundleV1CanonicalCode;
  role: PlanItemRole;
  day_offset_start: number;
  day_offset_end: number | null;
  dosing_summary: string;
  metadata: Record<string, unknown>;
};

/**
 * Default v1 lines: class-level placeholders only — no named controlled drugs.
 * Dosing is intentionally non-specific; agents and doses are chosen in DoctorOS / clinic protocol.
 */
export const DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1: readonly PostopMedicationBundleTemplateLine[] = [
  {
    category: "antibiotics",
    canonical_code: "antibiotics",
    role: "course",
    day_offset_start: 0,
    day_offset_end: 7,
    dosing_summary:
      "Antimicrobial prophylaxis per local protocol; specific agent, dose, and duration to be confirmed by the prescriber.",
    metadata: { generic_class: "antibiotic", agent_specificity: "class_level" },
  },
  {
    category: "prednisolone",
    canonical_code: "prednisolone",
    role: "taper",
    day_offset_start: 0,
    day_offset_end: 5,
    dosing_summary:
      "Oral corticosteroid taper per local post-operative protocol; starting dose and schedule to be set by the prescriber.",
    metadata: { agent_specificity: "class_level" },
  },
  {
    category: "pain_medication",
    canonical_code: "pain_medication",
    role: "prn",
    day_offset_start: 0,
    day_offset_end: 14,
    dosing_summary:
      "Analgesia as required per local protocol; specific agents and maximum daily limits per prescriber and jurisdiction.",
    metadata: { generic_class: "analgesic", agent_specificity: "class_level" },
  },
] as const;

export function postopBundleTemplateLinesToDraftItems(
  lines: readonly PostopMedicationBundleTemplateLine[] = DEFAULT_SURGERY_POSTOP_MEDICATION_BUNDLE_V1
): DraftTherapyPlanItemInput[] {
  return lines.map((line, index) => ({
    canonical_code: line.canonical_code,
    role: line.role,
    dosing_summary: line.dosing_summary,
    day_offset_start: line.day_offset_start,
    day_offset_end: line.day_offset_end,
    sort_order: index,
    metadata: { ...line.metadata, postop_category: line.category },
  }));
}

/** All human-readable strings in the bundle (for safety tests: no named CD agents). */
export function collectPostopBundleTemplateText(lines: readonly PostopMedicationBundleTemplateLine[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    out.push(line.dosing_summary);
    out.push(JSON.stringify(line.metadata));
  }
  return out;
}

export type SurgeryPostopMedicationDryRunModel = {
  status: "dry_run";
  plan: {
    tenant_id: string;
    patient_id: string;
    case_id: string;
    consultation_id: string | null;
    surgery_plan_id: string | null;
    plan_type: PlanType;
    title: string;
    status: "draft";
    source: PlanSource;
    valid_from: null;
    valid_until: null;
    surgery_anchor_date: string;
    metadata: Record<string, unknown>;
  };
  /** Normalised line items as they would be inserted (no ids). */
  items: ReturnType<typeof normaliseTherapyPlanItems>;
};

/**
 * Pure dry-run payload: plan header fields + normalised items (no Supabase).
 */
export function buildSurgeryPostopMedicationDryRunModel(input: {
  tenantId: string;
  patientId: string;
  caseId: string;
  surgeryPlanId?: string | null;
  consultationId?: string | null;
  surgeryAnchorDate: string;
}): SurgeryPostopMedicationDryRunModel {
  const items = normaliseTherapyPlanItems(postopBundleTemplateLinesToDraftItems());
  return {
    status: "dry_run",
    plan: {
      tenant_id: input.tenantId.trim(),
      patient_id: input.patientId.trim(),
      case_id: input.caseId.trim(),
      consultation_id: input.consultationId?.trim() || null,
      surgery_plan_id: input.surgeryPlanId?.trim() || null,
      plan_type: "post_operative",
      title: SURGERY_POSTOP_BUNDLE_PLAN_TITLE,
      status: "draft",
      source: "surgery_postop_bundle",
      valid_from: null,
      valid_until: null,
      surgery_anchor_date: input.surgeryAnchorDate.trim(),
      metadata: { ...SURGERY_POSTOP_BUNDLE_PLAN_METADATA },
    },
    items,
  };
}
