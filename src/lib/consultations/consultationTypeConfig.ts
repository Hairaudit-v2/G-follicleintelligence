/**
 * ConsultationOS consultation types — layout + prompt metadata only (preview UI).
 * No persistence; consumers use this for local section visibility and copy.
 */

export type ConsultationTypeId =
  | "scalp_hair_transplant"
  | "eyebrow_transplant"
  | "beard_transplant"
  | "body_hair_transplant"
  | "prp_prf"
  | "exosomes"
  | "mesotherapy"
  | "medical_hair_loss";

export type ConsultationSectionId =
  | "assessment"
  | "donor"
  | "medical"
  | "recommendations"
  | "quote"
  | "brow_design"
  | "beard_design"
  | "body_hair"
  | "regenerative_assessment"
  | "medical_hair_loss";

export type ConsultationTypeDefinition = {
  id: ConsultationTypeId;
  label: string;
  sections: ConsultationSectionId[];
  /** Short bullets to steer live notes in preview mode. */
  promptFocus: string[];
};

export const DEFAULT_CONSULTATION_TYPE_ID: ConsultationTypeId = "scalp_hair_transplant";

export const CONSULTATION_TYPE_DEFINITIONS: readonly ConsultationTypeDefinition[] = [
  {
    id: "scalp_hair_transplant",
    label: "Scalp hair transplant",
    sections: ["assessment", "donor", "medical", "recommendations", "quote"],
    promptFocus: [
      "Grade of loss",
      "Pattern classification",
      "Donor density",
      "Graft estimate",
      "Surgery suitability",
    ],
  },
  {
    id: "eyebrow_transplant",
    label: "Eyebrow transplant",
    sections: ["brow_design", "donor", "medical", "recommendations", "quote"],
    promptFocus: [
      "Brow shape/design",
      "Symmetry",
      "Scar tissue",
      "Density requirement",
      "Donor hair suitability",
    ],
  },
  {
    id: "beard_transplant",
    label: "Beard transplant",
    sections: ["beard_design", "donor", "medical", "recommendations", "quote"],
    promptFocus: [
      "Beard zone",
      "Patchy areas",
      "Scar correction",
      "Density goals",
      "Hair direction and angulation",
    ],
  },
  {
    id: "body_hair_transplant",
    label: "Body hair transplant",
    sections: ["body_hair", "donor", "medical", "recommendations", "quote"],
    promptFocus: [
      "Donor source area",
      "Recipient area",
      "Texture match",
      "Extraction suitability",
      "Limitations and risks",
    ],
  },
  {
    id: "prp_prf",
    label: "PRP / PRF",
    sections: ["regenerative_assessment", "medical", "recommendations", "quote"],
    promptFocus: [
      "Hair loss type",
      "Treatment area",
      "Session package",
      "Maintenance plan",
      "Contraindications",
    ],
  },
  {
    id: "exosomes",
    label: "Exosomes",
    sections: ["regenerative_assessment", "medical", "recommendations", "quote"],
    promptFocus: [
      "Treatment area",
      "Indication",
      "Previous regenerative treatments",
      "Number of sessions",
      "Combination therapy",
    ],
  },
  {
    id: "mesotherapy",
    label: "Mesotherapy",
    sections: ["regenerative_assessment", "medical", "recommendations", "quote"],
    promptFocus: [
      "Treatment area",
      "Product/protocol",
      "Session plan",
      "Maintenance plan",
    ],
  },
  {
    id: "medical_hair_loss",
    label: "Hair loss medical consultation",
    sections: ["medical_hair_loss", "medical", "recommendations", "quote"],
    promptFocus: [
      "Pattern/type of loss",
      "Blood test requirements",
      "Medication discussion",
      "Nutritional/hormonal factors",
      "Follow-up plan",
    ],
  },
] as const;

export function getConsultationTypeDefinition(id: ConsultationTypeId): ConsultationTypeDefinition {
  const found = CONSULTATION_TYPE_DEFINITIONS.find((d) => d.id === id);
  return found ?? CONSULTATION_TYPE_DEFINITIONS[0];
}

export function consultationTypeIds(): ConsultationTypeId[] {
  return CONSULTATION_TYPE_DEFINITIONS.map((d) => d.id);
}

export function parseConsultationTypeId(raw: string): ConsultationTypeId | null {
  const t = raw.trim() as ConsultationTypeId;
  return CONSULTATION_TYPE_DEFINITIONS.some((d) => d.id === t) ? t : null;
}
