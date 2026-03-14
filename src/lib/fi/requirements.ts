/**
 * Server-authoritative intake requirements.
 * Minimum data completeness for case submission. No client-only validation dependency.
 */

export type UploadSetRequirement = {
  key: string;
  label: string;
  types: readonly string[];
  minCount: number;
};

/** Required upload sets and min counts (patient photo minFiles style) */
export const INTAKE_UPLOAD_REQUIREMENTS: UploadSetRequirement[] = [
  {
    key: "blood",
    label: "Blood test (PDF or CSV)",
    types: ["blood_pdf", "blood_csv"],
    minCount: 1,
  },
  {
    key: "scalp_photo",
    label: "Scalp/clinical photo",
    types: [
      "scalp_preop_front",
      "scalp_sides_left",
      "scalp_sides_right",
      "scalp_crown",
      "donor_rear",
      "postop_day0",
    ],
    minCount: 1,
  },
];

export type MissingRequirement = {
  key: string;
  label: string;
  required: number;
  actual: number;
  types: string[];
};

export type RequirementsResult =
  | { ok: true }
  | { ok: false; error: string; missing: MissingRequirement[] };

/**
 * Validate upload types against required sets.
 * Counts uploads per set; fails if any set has count < minCount.
 */
export function validateIntakeRequirements(uploadTypes: string[]): RequirementsResult {
  const missing: MissingRequirement[] = [];

  for (const req of INTAKE_UPLOAD_REQUIREMENTS) {
    const count = uploadTypes.filter((t) => req.types.includes(t)).length;
    if (count < req.minCount) {
      missing.push({
        key: req.key,
        label: req.label,
        required: req.minCount,
        actual: count,
        types: [...req.types],
      });
    }
  }

  if (missing.length > 0) {
    const summary = missing
      .map((m) => `${m.label}: ${m.actual}/${m.required} (need ${m.types.join(" or ")})`)
      .join("; ");
    return {
      ok: false,
      error: `Missing required uploads: ${summary}`,
      missing,
    };
  }

  return { ok: true };
}
