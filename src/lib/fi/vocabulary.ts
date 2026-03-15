/**
 * Shared event types and signal vocabulary for Follicle Intelligence.
 * Aligns with docs/design/03-event-ingestion-design.md and 04-signal-normalization-model.md.
 * FI is the intelligence layer; HLI and HairAudit remain operational systems of record.
 */

// ─── Source systems ─────────────────────────────────────────────────────────

export const FI_SOURCE_SYSTEMS = ["hli", "hairaudit"] as const;
export type FiSourceSystem = (typeof FI_SOURCE_SYSTEMS)[number];

// ─── Event types (source_system.domain.action) ──────────────────────────────

export const FI_EVENT_TYPES = [
  // HLI
  "hli.intake.submitted",
  "hli.document.uploaded",
  "hli.blood_request.generated",
  "hli.scalp_imaging.captured",
  "hli.treatment.recorded",
  // HairAudit
  "hairaudit.case.submitted",
  "hairaudit.report.released",
  "hairaudit.audit.completed",
  "hairaudit.verification.completed",
] as const;

export type FiEventType = (typeof FI_EVENT_TYPES)[number];

export function isAllowedEventType(value: string): value is FiEventType {
  return (FI_EVENT_TYPES as readonly string[]).includes(value);
}

// ─── Shared signal vocabulary ───────────────────────────────────────────────

/** Laboratory / systemic (HLI-oriented) */
export const SIGNALS_LAB_SYSTEMIC = [
  "iron_risk",
  "thyroid_risk",
  "androgen_pattern",
  "inflammatory_pattern",
  "nutrition_markers",
] as const;

/** Scalp / trichology (HLI + HairAudit) */
export const SIGNALS_SCALP = [
  "seborrhoeic_pattern",
  "cicatricial_pattern",
  "fibrosis_risk",
  "density_deficit_pattern",
] as const;

/** Surgical / transplant (HairAudit-oriented) */
export const SIGNALS_SURGICAL = [
  "donor_depletion_risk",
  "graft_trauma_risk",
  "surgical_readiness",
] as const;

export const FI_SIGNAL_IDS = [
  ...SIGNALS_LAB_SYSTEMIC,
  ...SIGNALS_SCALP,
  ...SIGNALS_SURGICAL,
] as const;

export type FiSignalId = (typeof FI_SIGNAL_IDS)[number];

export type FiSignalType = "risk" | "pattern";

export const FI_SIGNAL_META: Record<
  FiSignalId,
  { type: FiSignalType; description: string }
> = {
  iron_risk: { type: "risk", description: "Iron status / deficiency risk" },
  thyroid_risk: { type: "risk", description: "Thyroid dysfunction risk" },
  androgen_pattern: {
    type: "pattern",
    description: "Androgen-related pattern (e.g. AGA predisposition)",
  },
  inflammatory_pattern: {
    type: "pattern",
    description: "Inflammatory markers / scalp inflammation",
  },
  nutrition_markers: {
    type: "pattern",
    description: "Vitamins, minerals, diet-related",
  },
  seborrhoeic_pattern: {
    type: "pattern",
    description: "Seborrhoeic dermatitis / oiliness",
  },
  cicatricial_pattern: {
    type: "pattern",
    description: "Cicatricial / scarring alopecia",
  },
  fibrosis_risk: { type: "risk", description: "Scalp fibrosis risk" },
  density_deficit_pattern: {
    type: "pattern",
    description: "Density/miniaturization pattern",
  },
  donor_depletion_risk: {
    type: "risk",
    description: "Donor area depletion risk",
  },
  graft_trauma_risk: {
    type: "risk",
    description: "Graft handling / trauma risk",
  },
  surgical_readiness: {
    type: "risk",
    description: "Readiness for surgery",
  },
};

export function isKnownSignalId(value: string): value is FiSignalId {
  return (FI_SIGNAL_IDS as readonly string[]).includes(value);
}
