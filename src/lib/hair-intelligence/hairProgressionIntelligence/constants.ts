/** HIE Stage 9B — Hair Progression Intelligence Engine (read-model analytics). */
export const HAIR_PROGRESSION_ENGINE_VERSION = "9b.1.0";

/** MedicationOS canonical codes used for progression vs exposure analytics. */
export const HAIR_PROGRESSION_TRACKED_THERAPY_CODES = [
  "finasteride",
  "dutasteride",
  "oral_minoxidil",
  "topical_minoxidil",
  "prp",
  "exosomes",
] as const;

export type HairProgressionTrackedTherapyCode = (typeof HAIR_PROGRESSION_TRACKED_THERAPY_CODES)[number];

export function isHairProgressionTrackedTherapyCode(v: string): v is HairProgressionTrackedTherapyCode {
  return (HAIR_PROGRESSION_TRACKED_THERAPY_CODES as readonly string[]).includes(v);
}
