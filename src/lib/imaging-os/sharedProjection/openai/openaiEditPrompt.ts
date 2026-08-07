/**
 * Clinical edit prompt for gpt-image-2 (shared).
 * v3 adds explicit seam / boundary continuity constraints (1C).
 */

export const OPENAI_EDIT_PROMPT_VERSION_V3 =
  "fi-openai-projected-outcome-prompt-v3" as const;

export const ILLUSTRATIVE_PROJECTED_OUTCOME_PROMPT_DISCLAIMER =
  "Illustrative projected outcome only — not a guarantee of surgical results; clinician review required." as const;

export type SharedEditPromptAssumptions = {
  graftCount: number;
  assumedGraftSurvivalRangePct: { min: number; max: number };
  hairsPerGraftAssumption: number;
  projectedDensityRange: { minPerCm2: number; maxPerCm2: number };
};

export function buildOpenAiProjectedOutcomeEditPrompt(input: {
  zonesIncluded: string[];
  planVersion: number;
  assumptions: SharedEditPromptAssumptions;
  mode?: "planned";
}): {
  prompt: string;
  promptVersion: typeof OPENAI_EDIT_PROMPT_VERSION_V3;
} {
  const zones = (input.zonesIncluded.length ? input.zonesIncluded : ["approved recipient zones"])
    .map((z) => z.replaceAll("_", " "))
    .join(", ");
  const a = input.assumptions;

  const prompt = [
    "Edit THIS exact patient photograph in place. Do not generate a new face, body, pose, lighting, or background.",
    "Add plausible natural-looking transplanted hair ONLY inside the masked recipient region (transparent mask areas).",
    "Absolutely preserve: facial identity and proportions; eyes, brows, nose, ears, lips, facial hair; skin tone and pores; expression; forehead below the approved hairline; clothing; background logos.",
    "Do not invent donor-area improvement. Do not remove scars or unrelated features. Do not change native buzzed hair outside the treatment mask.",
    "Keep hair length short and cropped to match native sides — never longer swept or styled hair.",
    "Hair must look like individual short follicles with realistic scalp show-through — never solid coloured fills, planning blocks, opaque zone overlays, wigs, or helmet density.",
    "Hairline: soft irregular leading edge with micro- and macro-irregularity; finer single-hair appearance at the front; gradual density transition behind the hairline; no hard horizontal fill line.",
    "Never produce a rectangular or block-shaped transplant patch. Transition density must fade naturally into native scalp and temporal fringes.",
    "Match direction and angulation to the patient's visible native hair. Match colour, calibre and texture to this patient.",
    "CRITICAL seam prevention: colour, exposure, scalp texture, and lighting must be continuous across the mask boundary; no halo, no duplicated scalp/hair strips, no geometric discontinuity, no hard horizontal composite seam.",
    "Preserve region outside the mask unchanged; feather density only at the approved transition zone inside the editable mask.",
    `Mode: planned (clinically expected planned density — not helmet hair).`,
    `Recipient zones (plan v${input.planVersion}): ${zones}.`,
    `Assumptions: ~${a.graftCount} grafts; survival ${a.assumedGraftSurvivalRangePct.min}–${a.assumedGraftSurvivalRangePct.max}%; ~${a.hairsPerGraftAssumption} hairs/graft; projected density ~${a.projectedDensityRange.minPerCm2}–${a.projectedDensityRange.maxPerCm2}/cm².`,
    "Output a photorealistic edit of the same photograph with transplanted hair added only in the mask.",
    ILLUSTRATIVE_PROJECTED_OUTCOME_PROMPT_DISCLAIMER,
  ].join(" ");

  return { prompt, promptVersion: OPENAI_EDIT_PROMPT_VERSION_V3 };
}
