/**
 * Androgen-Age risk modelling report module.
 * Engine-owned: outputs narrative + chart definition. UI/PDF draws from definition.
 * Reusable for B2C + B2B reports.
 */

const MU = 23;
const SIGMA = 9;
const AGE_MIN = 15;
const AGE_MAX = 70;
const AGE_STEP = 0.5;
const DHT_MANAGED_MULT = 0.72;
const TRT_MULT = 1.15;

function gaussian(x: number, mu: number, sigma: number): number {
  return Math.exp(-Math.pow(x - mu, 2) / (2 * sigma * sigma));
}

/** Input for androgen-age model. Same shape for B2C and B2B. */
export type AndrogenAgeInput = {
  patientAge: number;
  sex: string;
  trt: boolean;
  dhtManagement: boolean;
  freeTPct: number | null;
};

/** Chart definition: data points + labels. PDF/UI draws from this. */
export type AndrogenAgeChartDefinition = {
  type: "androgen_age_curve";
  id: string;
  title: string;
  data: {
    ages: number[];
    unmanaged: number[];
    dhtManaged: number[];
    patientAge: number;
    patientValue: number;
    annotations: string[];
  };
  labels: {
    xAxis: string;
    yAxis: string;
    unmanaged: string;
    dhtManaged: string;
    patientLabel: string;
  };
  options: {
    ageMin: number;
    ageMax: number;
  };
};

/** Narrative interpretation (claim-safe). */
export type AndrogenAgeNarrative = {
  bullets: string[];
  summary?: string;
};

export type AndrogenAgeModuleOutput = {
  narrative: AndrogenAgeNarrative;
  chartDefinition: AndrogenAgeChartDefinition;
};

const NARRATIVE_BULLETS: string[] = [
  "Educational model, not deterministic.",
  "Earlier onset + higher androgen drive can correlate with faster progression; genetics dominates.",
  "TRT may increase androgen exposure in susceptible individuals.",
  "DHT management may reduce androgen-driven acceleration.",
];

/**
 * Compute androgen-age risk model outputs.
 * Pure engine logic: no UI, no canvas. Same module for B2C and B2B.
 */
export function computeAndrogenAgeModule(
  input: AndrogenAgeInput
): AndrogenAgeModuleOutput {
  const { patientAge, freeTPct, trt, dhtManagement } = input;

  const ftFactor =
    freeTPct != null
      ? Math.min(1.3, Math.max(0.7, 0.7 + 0.6 * (freeTPct / 100)))
      : 1.0;

  const annotations: string[] = [];
  if (freeTPct == null) annotations.push("Free T not available");
  if (trt) annotations.push("TRT: yes");

  const ages: number[] = [];
  for (let a = AGE_MIN; a <= AGE_MAX; a += AGE_STEP) ages.push(a);

  const baseCurve = ages.map((a) => gaussian(a, MU, SIGMA));
  const maxBase = Math.max(...baseCurve);
  const normalized = baseCurve.map((v) => (maxBase > 0 ? v / maxBase : 0));

  const trtMult = trt ? TRT_MULT : 1;
  const unmanaged = normalized.map((v) => v * ftFactor * trtMult);
  const dhtManaged = unmanaged.map((v) => v * DHT_MANAGED_MULT);

  const ageIdx = ages.findIndex((a) => a >= patientAge);
  const idx = ageIdx >= 0 ? Math.min(ageIdx, ages.length - 1) : ages.length - 1;
  const patientValue = unmanaged[idx];

  const narrative: AndrogenAgeNarrative = {
    bullets: NARRATIVE_BULLETS,
  };

  const chartDefinition: AndrogenAgeChartDefinition = {
    type: "androgen_age_curve",
    id: "androgen_age",
    title: "Age + Free Testosterone Influence (Educational Risk Model)",
    data: {
      ages,
      unmanaged,
      dhtManaged,
      patientAge,
      patientValue,
      annotations,
    },
    labels: {
      xAxis: "Age",
      yAxis: "Relative androgen drive",
      unmanaged: "Unmanaged",
      dhtManaged: "DHT managed (×0.72)",
      patientLabel: `You (age ${patientAge})`,
    },
    options: {
      ageMin: AGE_MIN,
      ageMax: AGE_MAX,
    },
  };

  return { narrative, chartDefinition };
}

/**
 * Whether the androgen-age module applies (men 15–70).
 */
export function isAndrogenAgeApplicable(input: AndrogenAgeInput): boolean {
  return (
    input.sex?.toLowerCase() === "male" &&
    input.patientAge >= AGE_MIN &&
    input.patientAge <= AGE_MAX
  );
}
