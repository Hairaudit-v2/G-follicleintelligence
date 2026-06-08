import type { PathologyTemplateId } from "./pathologyTypes";

export type PathologyTemplateDefinition = {
  id: PathologyTemplateId;
  label: string;
  description: string;
  defaultTests: { code: string | null; label: string }[];
};

export const PATHOLOGY_TEMPLATES: readonly PathologyTemplateDefinition[] = [
  {
    id: "hair_loss_investigation",
    label: "Hair Loss Investigation",
    description: "Baseline haematology, iron studies, thyroid, and key androgens commonly used in male-pattern workup.",
    defaultTests: [
      { code: "FBC", label: "Full blood count" },
      { code: "UE", label: "Urea & electrolytes" },
      { code: "LFT", label: "Liver function tests" },
      { code: "TFT", label: "Thyroid function (TSH ± FT4)" },
      { code: "FERR", label: "Ferritin" },
      { code: "B12", label: "Vitamin B12" },
      { code: "FOL", label: "Folate (serum or RBC)" },
      { code: "VITD", label: "Vitamin D (25-OH)" },
      { code: "IRON", label: "Iron studies (Fe, TIBC/UIBC, transferrin sat.)" },
      { code: "CRP", label: "CRP (or ESR)" },
      { code: "TESTO", label: "Total testosterone" },
      { code: "SHBG", label: "Sex hormone binding globulin" },
      { code: "DHT", label: "DHT (if available)" },
    ],
  },
  {
    id: "female_hair_loss_investigation",
    label: "Female Hair Loss Investigation",
    description: "Adds common endocrine drivers alongside iron, thyroid, and nutrition markers.",
    defaultTests: [
      { code: "FBC", label: "Full blood count" },
      { code: "UE", label: "Urea & electrolytes" },
      { code: "LFT", label: "Liver function tests" },
      { code: "TFT", label: "Thyroid function (TSH ± FT4)" },
      { code: "FERR", label: "Ferritin" },
      { code: "B12", label: "Vitamin B12" },
      { code: "FOL", label: "Folate" },
      { code: "VITD", label: "Vitamin D (25-OH)" },
      { code: "IRON", label: "Iron studies" },
      { code: "CRP", label: "CRP (or ESR)" },
      { code: "LH", label: "LH" },
      { code: "FSH", label: "FSH" },
      { code: "PRL", label: "Prolactin" },
      { code: "TESTO", label: "Total testosterone" },
      { code: "SHBG", label: "SHBG" },
      { code: "AND", label: "Androstenedione" },
      { code: "DHEAS", label: "DHEA sulphate" },
      { code: "E2", label: "Estradiol" },
      { code: "PROG", label: "Progesterone (luteal phase if cycling)" },
    ],
  },
  {
    id: "hair_transplant_pre_op",
    label: "Hair Transplant Pre-Op",
    description: "Standard pre-operative screening panel (adjust per local protocol).",
    defaultTests: [
      { code: "FBC", label: "Full blood count" },
      { code: "UE", label: "Urea & electrolytes" },
      { code: "LFT", label: "Liver function tests" },
      { code: "GLU", label: "Fasting glucose or HbA1c" },
      { code: "HBA1C", label: "HbA1c" },
      { code: "PT", label: "Coagulation screen (PT/INR, APTT)" },
      { code: "HIV", label: "HIV serology" },
      { code: "HBSAG", label: "Hepatitis B surface antigen" },
      { code: "HCV", label: "Hepatitis C antibody" },
      { code: "ECG", label: "ECG (clinical, not lab)" },
    ],
  },
  {
    id: "trt_monitoring",
    label: "TRT Monitoring",
    description: "Typical monitoring cadence markers for testosterone therapy (clinic protocol applies).",
    defaultTests: [
      { code: "FBC", label: "Full blood count (Hb/Hct focus)" },
      { code: "UE", label: "Urea & electrolytes" },
      { code: "LFT", label: "Liver function tests" },
      { code: "LIPID", label: "Lipid profile" },
      { code: "PSA", label: "PSA (age/protocol dependent)" },
      { code: "TESTO", label: "Total testosterone" },
      { code: "FT", label: "Free testosterone (if indicated)" },
      { code: "SHBG", label: "SHBG" },
      { code: "E2", label: "Estradiol" },
      { code: "LHFSH", label: "LH / FSH (baseline or as indicated)" },
    ],
  },
  {
    id: "custom_request",
    label: "Custom Request",
    description: "Start from an empty list and add tests manually.",
    defaultTests: [],
  },
] as const;

export function getPathologyTemplate(id: PathologyTemplateId): PathologyTemplateDefinition | undefined {
  return PATHOLOGY_TEMPLATES.find((t) => t.id === id);
}
