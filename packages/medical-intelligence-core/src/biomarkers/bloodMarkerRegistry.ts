/**
 * Blood marker registry focused on hair-loss workups. Core hair markers are prioritised in UI,
 * while broader generic lab markers remain supported as "additional markers".
 */

export type ClinicalFlagChar = "Fe" | "T" | "A" | "⊕" | "!" | null;

export type SexApplicability = "all" | "female" | "male";

export type HairOptimalRange = {
  optimalLow: number;
  optimalHigh: number;
  unit: string;
  explanationLow: string;
  explanationHigh: string;
  explanationOptimal: string;
};

export type MarkerDefinition = {
  /** Canonical normalized key (e.g. ferritin, tsh). */
  key: string;
  /** Display label for UI and reports. */
  label: string;
  /** UI group/category. */
  category: string;
  /** Core trichology marker or secondary/additional marker. */
  isPrimaryHairMarker: boolean;
  /** Aliases and common lab names; all resolve to this key. */
  aliases: string[];
  /** Common units seen in lab reports. */
  commonUnits: string[];
  /** Default/suggested unit when none provided. */
  defaultUnit: string;
  /** Triage flag for review workspace (Fe, T, A, ⊕, !). */
  clinicalFlag: ClinicalFlagChar;
  /** Hair-specific optimal range and explanations. Null means: use lab reference. */
  hairOptimal: HairOptimalRange | null;
  sexApplicability: SexApplicability;
};

export function normaliseLookupValue(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ");
}

/** Build alias map: normalized alias -> key. */
function buildAliasMap(registry: MarkerDefinition[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const def of registry) {
    map.set(normaliseLookupValue(def.key), def.key);
    map.set(normaliseLookupValue(def.label), def.key);
    for (const a of def.aliases) {
      map.set(normaliseLookupValue(a), def.key);
    }
  }
  return map;
}

const INTERPRET_WITH_LAB =
  "Interpret with lab reference and clinical context. No fixed hair-specific optimal range is defined.";

function primaryMarker(def: Omit<MarkerDefinition, "isPrimaryHairMarker">): MarkerDefinition {
  return { ...def, isPrimaryHairMarker: true };
}

function additionalMarker(def: Omit<MarkerDefinition, "isPrimaryHairMarker">): MarkerDefinition {
  return { ...def, isPrimaryHairMarker: false };
}

const REGISTRY: MarkerDefinition[] = [
  primaryMarker({
    key: "ferritin",
    label: "Ferritin",
    category: "Iron / oxygen delivery",
    aliases: ["Ferritin", "Serum Ferritin", "Iron stores", "FER"],
    commonUnits: ["ug/L", "µg/L", "ng/mL"],
    defaultUnit: "µg/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 50,
      optimalHigh: 150,
      unit: "µg/L",
      explanationLow: "Low ferritin can contribute to telogen shedding; consider repletion for hair.",
      explanationHigh: "Elevated ferritin may be acute-phase; interpret with iron studies.",
      explanationOptimal: "Within range often associated with healthy hair growth.",
    },
  }),
  primaryMarker({
    key: "serum_iron",
    label: "Serum iron",
    category: "Iron / oxygen delivery",
    aliases: ["Iron", "Serum Iron", "Serum Fe", "Iron serum"],
    commonUnits: ["µmol/L", "ug/dL", "µg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "transferrin",
    label: "Transferrin",
    category: "Iron / oxygen delivery",
    aliases: ["Transferrin", "Siderophilin", "Transferrin serum"],
    commonUnits: ["g/L", "mg/dL"],
    defaultUnit: "g/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "transferrin_saturation",
    label: "Transferrin saturation",
    category: "Iron / oxygen delivery",
    aliases: ["TSAT", "Transferrin sat", "Iron saturation", "Fe sat"],
    commonUnits: ["%"],
    defaultUnit: "%",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "tibc",
    label: "TIBC",
    category: "Iron / oxygen delivery",
    aliases: ["TIBC", "Total iron binding capacity", "UIBC", "Unsaturated iron binding capacity"],
    commonUnits: ["µmol/L", "ug/dL", "µg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "haemoglobin",
    label: "Haemoglobin",
    category: "Iron / oxygen delivery",
    aliases: ["Hemoglobin", "Hb", "Hgb", "FBC Haemoglobin"],
    commonUnits: ["g/L", "g/dL"],
    defaultUnit: "g/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 120,
      optimalHigh: 170,
      unit: "g/L",
      explanationLow: "Low haemoglobin may indicate anaemia and can be relevant to hair shedding.",
      explanationHigh: "Interpret with full blood count and clinical context.",
      explanationOptimal: INTERPRET_WITH_LAB,
    },
  }),
  primaryMarker({
    key: "mcv",
    label: "MCV",
    category: "Iron / oxygen delivery",
    aliases: ["MCV", "Mean cell volume", "Mean corpuscular volume"],
    commonUnits: ["fL"],
    defaultUnit: "fL",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 80,
      optimalHigh: 100,
      unit: "fL",
      explanationLow: "Low MCV may support iron deficiency; interpret with ferritin and haemoglobin.",
      explanationHigh: "Interpret with B12, folate, and lab reference.",
      explanationOptimal: INTERPRET_WITH_LAB,
    },
  }),
  primaryMarker({
    key: "mch",
    label: "MCH",
    category: "Iron / oxygen delivery",
    aliases: ["MCH", "Mean cell haemoglobin", "Mean corpuscular haemoglobin"],
    commonUnits: ["pg"],
    defaultUnit: "pg",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 27,
      optimalHigh: 32,
      unit: "pg",
      explanationLow: "Low MCH may support iron deficiency; interpret with ferritin and haemoglobin.",
      explanationHigh: "Interpret with lab reference.",
      explanationOptimal: INTERPRET_WITH_LAB,
    },
  }),
  primaryMarker({
    key: "tsh",
    label: "TSH",
    category: "Thyroid",
    aliases: ["TSH", "Thyroid Stimulating Hormone", "Thyrotropin"],
    commonUnits: ["mU/L", "mIU/L", "uIU/mL", "µIU/mL"],
    defaultUnit: "mU/L",
    clinicalFlag: "T",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 0.4,
      optimalHigh: 2.5,
      unit: "mU/L",
      explanationLow: "Low TSH may indicate hyperthyroidism; can affect hair.",
      explanationHigh: "Elevated TSH may indicate hypothyroidism; relevant to diffuse hair loss.",
      explanationOptimal: "Within range often associated with normal thyroid function for hair.",
    },
  }),
  primaryMarker({
    key: "free_t4",
    label: "Free T4",
    category: "Thyroid",
    aliases: ["Free T4", "FT4", "fT4", "Free Thyroxine"],
    commonUnits: ["pmol/L", "ng/dL"],
    defaultUnit: "pmol/L",
    clinicalFlag: "T",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 10,
      optimalHigh: 22,
      unit: "pmol/L",
      explanationLow: "Low free T4 may indicate hypothyroidism; relevant to hair.",
      explanationHigh: "Elevated free T4 may indicate hyperthyroidism; can affect hair.",
      explanationOptimal: "Within normal thyroid range.",
    },
  }),
  primaryMarker({
    key: "free_t3",
    label: "Free T3",
    category: "Thyroid",
    aliases: ["Free T3", "FT3", "fT3", "Free Triiodothyronine"],
    commonUnits: ["pmol/L", "pg/mL"],
    defaultUnit: "pmol/L",
    clinicalFlag: "T",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 3.5,
      optimalHigh: 6.5,
      unit: "pmol/L",
      explanationLow: "Low free T3 can be seen in hypothyroidism; may affect hair.",
      explanationHigh: "Elevated free T3 may indicate hyperthyroidism; can affect hair.",
      explanationOptimal: "Within normal thyroid range.",
    },
  }),
  primaryMarker({
    key: "tpo_antibodies",
    label: "TPO antibodies",
    category: "Thyroid",
    aliases: ["TPO antibodies", "Thyroid peroxidase antibodies", "Anti-TPO", "TPO Ab", "TPO antibody"],
    commonUnits: ["IU/mL", "kIU/L"],
    defaultUnit: "IU/mL",
    clinicalFlag: "T",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "tg_antibodies",
    label: "Thyroglobulin antibodies",
    category: "Thyroid",
    aliases: ["TG antibodies", "Thyroglobulin antibodies", "Anti-Tg", "Tg Ab", "TG antibody"],
    commonUnits: ["IU/mL", "kIU/L"],
    defaultUnit: "IU/mL",
    clinicalFlag: "T",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "vitamin_d_25oh",
    label: "Vitamin D (25-OH)",
    category: "Nutritional / follicular support",
    aliases: [
      "Vitamin D",
      "25-OH Vitamin D",
      "25(OH)D",
      "25-OH Vit D",
      "25OHD",
      "Vit D",
      "Vitamin D3",
      "25-Hydroxyvitamin D",
    ],
    commonUnits: ["nmol/L", "ng/mL"],
    defaultUnit: "nmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 75,
      optimalHigh: 150,
      unit: "nmol/L",
      explanationLow: "Low vitamin D may be relevant to hair; consider supplementation.",
      explanationHigh: "Above target; avoid excessive supplementation.",
      explanationOptimal: "Adequate for bone and general health; may support hair.",
    },
  }),
  primaryMarker({
    key: "vitamin_b12",
    label: "Vitamin B12",
    category: "Nutritional / follicular support",
    aliases: ["B12", "Vitamin B12", "Cobalamin"],
    commonUnits: ["ng/L", "pg/mL", "pmol/L"],
    defaultUnit: "ng/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 200,
      optimalHigh: 900,
      unit: "ng/L",
      explanationLow: "Low B12 can contribute to hair changes; consider supplementation.",
      explanationHigh: "Very high levels are often supplementation-related; interpret clinically.",
      explanationOptimal: "Adequate for hair and general health.",
    },
  }),
  primaryMarker({
    key: "folate",
    label: "Folate",
    category: "Nutritional / follicular support",
    aliases: ["Folate", "Folic acid", "Serum folate", "Vitamin B9", "Red cell folate", "RBC folate"],
    commonUnits: ["nmol/L", "ng/mL", "ug/L", "µg/L"],
    defaultUnit: "nmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "zinc",
    label: "Zinc",
    category: "Nutritional / follicular support",
    aliases: ["Zinc", "Serum Zinc", "Zn"],
    commonUnits: ["µmol/L", "ug/dL", "µg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 10,
      optimalHigh: 18,
      unit: "µmol/L",
      explanationLow: "Low zinc can affect hair; consider diet or supplementation.",
      explanationHigh: "Adequate; very high levels can be toxic.",
      explanationOptimal: "Adequate for hair and immunity.",
    },
  }),
  primaryMarker({
    key: "magnesium",
    label: "Magnesium",
    category: "Nutritional / follicular support",
    aliases: ["Magnesium", "Mg", "Serum magnesium"],
    commonUnits: ["mmol/L", "mg/dL"],
    defaultUnit: "mmol/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "crp",
    label: "C-Reactive Protein",
    category: "Inflammation / metabolic stress",
    aliases: ["CRP", "C-Reactive Protein", "hs-CRP", "High sensitivity CRP"],
    commonUnits: ["mg/L", "mg/dL"],
    defaultUnit: "mg/L",
    clinicalFlag: "⊕",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 0,
      optimalHigh: 5,
      unit: "mg/L",
      explanationLow: "No significant inflammation detected.",
      explanationHigh: "Elevated CRP suggests inflammation; may be relevant to scalp or systemic.",
      explanationOptimal: "Low inflammation; favourable for scalp health.",
    },
  }),
  primaryMarker({
    key: "esr",
    label: "ESR",
    category: "Inflammation / metabolic stress",
    aliases: ["ESR", "Erythrocyte sedimentation rate", "Sed rate"],
    commonUnits: ["mm/h", "mm/hr"],
    defaultUnit: "mm/h",
    clinicalFlag: "⊕",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "hba1c",
    label: "HbA1c",
    category: "Inflammation / metabolic stress",
    aliases: ["HbA1c", "A1c", "A1C", "Glycated Haemoglobin", "Glycated hemoglobin"],
    commonUnits: ["mmol/mol", "%"],
    defaultUnit: "mmol/mol",
    clinicalFlag: "⊕",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 0,
      optimalHigh: 42,
      unit: "mmol/mol",
      explanationLow: "Not clinically relevant at low values; interpret with context.",
      explanationHigh: "Elevated HbA1c may indicate glycaemic dysregulation; can affect hair.",
      explanationOptimal: "Within non-diabetic range.",
    },
  }),
  primaryMarker({
    key: "fasting_glucose",
    label: "Fasting glucose",
    category: "Inflammation / metabolic stress",
    aliases: ["Fasting glucose", "Glucose fasting", "Fasting blood glucose", "FBG"],
    commonUnits: ["mmol/L", "mg/dL"],
    defaultUnit: "mmol/L",
    clinicalFlag: "⊕",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "fasting_insulin",
    label: "Fasting insulin",
    category: "Inflammation / metabolic stress",
    aliases: ["Fasting insulin", "Insulin fasting", "Fasting serum insulin"],
    commonUnits: ["mIU/L", "uIU/mL", "µIU/mL", "pmol/L"],
    defaultUnit: "mIU/L",
    clinicalFlag: "⊕",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "total_testosterone",
    label: "Total Testosterone",
    category: "Hormonal / androgen-related",
    aliases: ["Total Testosterone", "Testosterone", "Testosterone total"],
    commonUnits: ["nmol/L", "ng/dL"],
    defaultUnit: "nmol/L",
    clinicalFlag: "A",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "free_testosterone",
    label: "Free Testosterone",
    category: "Hormonal / androgen-related",
    aliases: ["Free Testosterone", "Calculated free testosterone", "Calculated free T"],
    commonUnits: ["pmol/L", "pg/mL"],
    defaultUnit: "pmol/L",
    clinicalFlag: "A",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "shbg",
    label: "SHBG",
    category: "Hormonal / androgen-related",
    aliases: ["SHBG", "Sex Hormone Binding Globulin"],
    commonUnits: ["nmol/L"],
    defaultUnit: "nmol/L",
    clinicalFlag: "A",
    sexApplicability: "all",
    hairOptimal: {
      optimalLow: 20,
      optimalHigh: 120,
      unit: "nmol/L",
      explanationLow: "Low SHBG can increase free androgen; relevant to pattern loss.",
      explanationHigh: "High SHBG reduces free androgen; interpret with testosterone.",
      explanationOptimal: "Interpret with testosterone for androgen picture.",
    },
  }),
  primaryMarker({
    key: "dheas",
    label: "DHEA-S",
    category: "Hormonal / androgen-related",
    aliases: ["DHEAS", "DHEA-S", "DHEA Sulphate", "DHEA Sulfate", "Dehydroepiandrosterone sulfate"],
    commonUnits: ["µmol/L", "ug/dL", "µg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: "A",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "androstenedione",
    label: "Androstenedione",
    category: "Hormonal / androgen-related",
    aliases: ["Androstenedione", "A4"],
    commonUnits: ["nmol/L", "ng/dL"],
    defaultUnit: "nmol/L",
    clinicalFlag: "A",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "prolactin",
    label: "Prolactin",
    category: "Hormonal / androgen-related",
    aliases: ["Prolactin", "PRL", "Serum prolactin"],
    commonUnits: ["mU/L", "ng/mL"],
    defaultUnit: "mU/L",
    clinicalFlag: "!",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "lh",
    label: "LH",
    category: "Hormonal / androgen-related",
    aliases: ["LH", "Luteinising Hormone", "Luteinizing Hormone"],
    commonUnits: ["IU/L", "mIU/mL"],
    defaultUnit: "IU/L",
    clinicalFlag: "!",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "fsh",
    label: "FSH",
    category: "Hormonal / androgen-related",
    aliases: ["FSH", "Follicle Stimulating Hormone", "Follicle-Stimulating Hormone"],
    commonUnits: ["IU/L", "mIU/mL"],
    defaultUnit: "IU/L",
    clinicalFlag: "!",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "estradiol",
    label: "Estradiol",
    category: "Hormonal / androgen-related",
    aliases: ["Estradiol", "Oestradiol", "E2"],
    commonUnits: ["pmol/L", "pg/mL"],
    defaultUnit: "pmol/L",
    clinicalFlag: "!",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "progesterone",
    label: "Progesterone",
    category: "Hormonal / androgen-related",
    aliases: ["Progesterone", "P4"],
    commonUnits: ["nmol/L", "ng/mL"],
    defaultUnit: "nmol/L",
    clinicalFlag: "!",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "albumin",
    label: "Albumin",
    category: "Protein / systemic support",
    aliases: ["Albumin", "Serum albumin", "Alb"],
    commonUnits: ["g/L", "g/dL"],
    defaultUnit: "g/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "globulin",
    label: "Globulin",
    category: "Protein / systemic support",
    aliases: ["Globulin", "Serum globulin"],
    commonUnits: ["g/L", "g/dL"],
    defaultUnit: "g/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  primaryMarker({
    key: "total_protein",
    label: "Total protein",
    category: "Protein / systemic support",
    aliases: ["Total protein", "Serum total protein", "TP", "Protein total"],
    commonUnits: ["g/L", "g/dL"],
    defaultUnit: "g/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),

  additionalMarker({
    key: "rbc",
    label: "Red cell count",
    category: "Additional markers / haematology",
    aliases: ["RBC", "Red blood cell count", "Erythrocytes", "RCC"],
    commonUnits: ["10^12/L", "×10^12/L", "million/uL"],
    defaultUnit: "×10^12/L",
    clinicalFlag: "Fe",
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "wbc",
    label: "White cell count",
    category: "Additional markers / haematology",
    aliases: ["WBC", "White blood cell count", "Leucocytes", "WCC"],
    commonUnits: ["10^9/L", "×10^9/L", "/uL"],
    defaultUnit: "×10^9/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "platelets",
    label: "Platelets",
    category: "Additional markers / haematology",
    aliases: ["Platelets", "Platelet count", "PLT", "Thrombocytes"],
    commonUnits: ["10^9/L", "×10^9/L"],
    defaultUnit: "×10^9/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "mchc",
    label: "MCHC",
    category: "Additional markers / haematology",
    aliases: ["MCHC", "Mean cell haemoglobin concentration", "Mean corpuscular haemoglobin concentration"],
    commonUnits: ["g/L", "g/dL"],
    defaultUnit: "g/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "alt",
    label: "ALT",
    category: "Additional markers / liver",
    aliases: ["ALT", "Alanine aminotransferase", "SGPT", "GPT"],
    commonUnits: ["U/L", "IU/L"],
    defaultUnit: "U/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "ast",
    label: "AST",
    category: "Additional markers / liver",
    aliases: ["AST", "Aspartate aminotransferase", "SGOT", "GOT"],
    commonUnits: ["U/L", "IU/L"],
    defaultUnit: "U/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "ggt",
    label: "GGT",
    category: "Additional markers / liver",
    aliases: ["GGT", "Gamma GT", "Gamma-glutamyl transferase", "g gamma t"],
    commonUnits: ["U/L", "IU/L"],
    defaultUnit: "U/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "bilirubin_total",
    label: "Bilirubin (total)",
    category: "Additional markers / liver",
    aliases: ["Bilirubin", "Total bilirubin", "Bilirubin total"],
    commonUnits: ["umol/L", "µmol/L", "mg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "alp",
    label: "ALP",
    category: "Additional markers / liver",
    aliases: ["ALP", "Alkaline phosphatase", "Alk phos"],
    commonUnits: ["U/L", "IU/L"],
    defaultUnit: "U/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "creatinine",
    label: "Creatinine",
    category: "Additional markers / kidney",
    aliases: ["Creatinine", "Serum creatinine", "Creat"],
    commonUnits: ["umol/L", "µmol/L", "mg/dL"],
    defaultUnit: "µmol/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "egfr",
    label: "eGFR",
    category: "Additional markers / kidney",
    aliases: ["eGFR", "Estimated GFR", "GFR", "CKD-EPI"],
    commonUnits: ["mL/min/1.73m2", "mL/min/1.73m²"],
    defaultUnit: "mL/min/1.73m²",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
  additionalMarker({
    key: "urea",
    label: "Urea",
    category: "Additional markers / kidney",
    aliases: ["Urea", "BUN", "Blood urea", "Blood urea nitrogen"],
    commonUnits: ["mmol/L", "mg/dL"],
    defaultUnit: "mmol/L",
    clinicalFlag: null,
    sexApplicability: "all",
    hairOptimal: null,
  }),
];

const BY_KEY = new Map<string, MarkerDefinition>(REGISTRY.map((d) => [d.key, d]));
const ALIAS_MAP = buildAliasMap(REGISTRY);

/**
 * Resolve an input string (e.g. from DB or user) to the canonical registry key.
 * Returns the key if found via key, label, or alias; otherwise returns trimmed input (backward compat).
 */
export function resolveMarkerKey(input: string): string {
  if (!input || typeof input !== "string") return "";
  const t = input.trim().replace(/\s+/g, " ");
  return ALIAS_MAP.get(normaliseLookupValue(t)) ?? t;
}

/**
 * Get the registry definition for a key or alias. Returns null if not in registry.
 */
export function getMarkerDefinition(keyOrAlias: string): MarkerDefinition | null {
  const key = resolveMarkerKey(keyOrAlias);
  return BY_KEY.get(key) ?? null;
}

/**
 * Display label for a marker: registry label if known, otherwise original string.
 * Use when showing marker names in UI or reports.
 */
export function getDisplayLabel(markerNameOrKey: string): string {
  const def = getMarkerDefinition(markerNameOrKey);
  return def ? def.label : (markerNameOrKey?.trim() || "");
}

/**
 * Default unit for a marker when none stored. Returns empty string if unknown.
 */
export function getDefaultUnit(markerNameOrKey: string): string {
  const def = getMarkerDefinition(markerNameOrKey);
  return def ? def.defaultUnit : "";
}

/** All registry definitions (read-only). */
export function getAllMarkerDefinitions(): MarkerDefinition[] {
  return [...REGISTRY];
}

/** All canonical keys for trend comparison. */
export const KEY_MARKERS_FOR_TRENDS: string[] = REGISTRY.map((d) => d.key);
