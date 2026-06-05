/**
 * Hamilton–Norwood, Ludwig, and hairline pattern labels for CRM / clinical UI.
 * Values align with `fi_patient_clinical_details` check constraints and Zod schemas.
 */

export const NORWOOD_SCALE_VALUES = [
  "I",
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
  "VII",
  "unknown",
] as const;

export type NorwoodScaleValue = (typeof NORWOOD_SCALE_VALUES)[number];

export const NORWOOD_OPTIONS: readonly { value: NorwoodScaleValue; label: string; description: string }[] = [
  { value: "I", label: "Stage I", description: "Minimal recession; full hairline." },
  { value: "II", label: "Stage II", description: "Triangular recession at temples." },
  { value: "IIa", label: "Stage IIa", description: "Recession across entire frontal hairline." },
  { value: "III", label: "Stage III", description: "Deep temporal recession; vertex often spared." },
  { value: "IIIa", label: "Stage IIIa", description: "III with continued frontal recession." },
  { value: "IIIvertex", label: "Stage III vertex", description: "Primarily vertex / crown thinning." },
  { value: "IV", label: "Stage IV", description: "Further recession; enlarged vertex thinning." },
  { value: "IVa", label: "Stage IVa", description: "Advanced recession with sparse mid-scalp band." },
  { value: "V", label: "Stage V", description: "Vertex and frontal areas merging." },
  { value: "Va", label: "Stage Va", description: "More extensive than V; narrower bridge." },
  { value: "VI", label: "Stage VI", description: "Bridge of hair between frontal and vertex lost." },
  { value: "VII", label: "Stage VII", description: "Most extensive; narrow band or horseshoe pattern." },
  { value: "unknown", label: "Not classified", description: "Stage not assessed or not applicable." },
] as const;

export const LUDWIG_SCALE_VALUES = ["I", "II", "III"] as const;
export type LudwigScaleValue = (typeof LUDWIG_SCALE_VALUES)[number];

export const LUDWIG_OPTIONS: readonly { value: LudwigScaleValue; label: string; description: string }[] = [
  { value: "I", label: "Ludwig I", description: "Mild thinning on crown; frontal hairline preserved." },
  { value: "II", label: "Ludwig II", description: "Noticeable central widening; moderate crown loss." },
  { value: "III", label: "Ludwig III", description: "Diffuse thinning with see-through crown." },
] as const;

export const HAIRLINE_PATTERN_VALUES = [
  "receding",
  "diffuse",
  "mature",
  "stable",
  "temporal_recession",
  "vertex_thinning",
  "unknown",
] as const;

export type HairlinePatternValue = (typeof HAIRLINE_PATTERN_VALUES)[number];

export const HAIRLINE_PATTERN_OPTIONS: readonly { value: HairlinePatternValue; label: string; description: string }[] = [
  { value: "receding", label: "Receding", description: "Classic frontal / temple pullback." },
  { value: "diffuse", label: "Diffuse", description: "Generalised thinning without sharp hairline step." },
  { value: "mature", label: "Mature hairline", description: "Physiological adult shift, not necessarily pathological loss." },
  { value: "stable", label: "Stable", description: "Pattern unchanged over clinically relevant period." },
  { value: "temporal_recession", label: "Temporal recession", description: "Predominant loss at temples." },
  { value: "vertex_thinning", label: "Vertex / crown thinning", description: "Predominant thinning at crown." },
  { value: "unknown", label: "Not specified", description: "Pattern not recorded." },
] as const;

const NORWOOD_LABEL_BY_VALUE = new Map(NORWOOD_OPTIONS.map((o) => [o.value, o.label] as const));
const LUDWIG_LABEL_BY_VALUE = new Map(LUDWIG_OPTIONS.map((o) => [o.value, o.label] as const));
const HAIRLINE_LABEL_BY_VALUE = new Map(HAIRLINE_PATTERN_OPTIONS.map((o) => [o.value, o.label] as const));

/** Display label for a stored Norwood code (falls back to raw value). */
export function getNorwoodLabel(scale: string | null | undefined): string {
  if (scale == null || !String(scale).trim()) return "—";
  const v = String(scale).trim() as NorwoodScaleValue;
  return NORWOOD_LABEL_BY_VALUE.get(v) ?? `Norwood ${v}`;
}

/** Short label for compact summaries (e.g. timeline). */
export function getNorwoodShortLabel(scale: string | null | undefined): string | null {
  if (scale == null || !String(scale).trim()) return null;
  const v = String(scale).trim();
  if (v === "unknown") return null;
  return `NW ${v}`;
}

export function getLudwigLabel(scale: string | null | undefined): string {
  if (scale == null || !String(scale).trim()) return "—";
  const v = String(scale).trim() as LudwigScaleValue;
  return LUDWIG_LABEL_BY_VALUE.get(v) ?? `Ludwig ${v}`;
}

export function getLudwigShortLabel(scale: string | null | undefined): string | null {
  if (scale == null || !String(scale).trim()) return null;
  return `Ludwig ${String(scale).trim()}`;
}

export function getHairlinePatternLabel(pattern: string | null | undefined): string {
  if (pattern == null || !String(pattern).trim()) return "—";
  const v = String(pattern).trim() as HairlinePatternValue;
  return HAIRLINE_LABEL_BY_VALUE.get(v) ?? v.replace(/_/g, " ");
}

/** One-line summary for profile / timeline (no PHI in scale fields). */
export function formatClinicalScalesSummary(input: {
  norwood_scale: string | null;
  ludwig_scale: string | null;
  hairline_pattern: string | null;
  primary_concern?: string | null;
}): string | null {
  const parts: string[] = [];
  const nw = getNorwoodShortLabel(input.norwood_scale);
  if (nw) parts.push(nw);
  const ld = getLudwigShortLabel(input.ludwig_scale);
  if (ld && input.ludwig_scale?.trim() && input.ludwig_scale !== "unknown") parts.push(ld);
  const hl = input.hairline_pattern?.trim();
  if (hl && hl !== "unknown") {
    parts.push(getHairlinePatternLabel(hl));
  }
  const pc = input.primary_concern?.trim();
  if (pc) parts.push(pc.length > 80 ? `${pc.slice(0, 77)}…` : pc);
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

export function isNorwoodScaleValue(v: string): v is NorwoodScaleValue {
  return (NORWOOD_SCALE_VALUES as readonly string[]).includes(v);
}

export function isLudwigScaleValue(v: string): v is LudwigScaleValue {
  return (LUDWIG_SCALE_VALUES as readonly string[]).includes(v);
}

export function isHairlinePatternValue(v: string): v is HairlinePatternValue {
  return (HAIRLINE_PATTERN_VALUES as readonly string[]).includes(v);
}
