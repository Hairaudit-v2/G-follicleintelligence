import type { HieHairLossClassificationSystem } from "../hairLossClassification/types";

/**
 * Maps a normalised classification grade to a monotonic ordinal for velocity / forecasting.
 * Norwood uses Hamilton–Norwood ordering with vertex as its own step between III and IV.
 */
export function classificationGradeToProgressionOrdinal(
  system: HieHairLossClassificationSystem,
  grade: string
): number | null {
  if (!grade || grade === "unknown") return null;
  switch (system) {
    case "norwood": {
      const g = grade.trim();
      const order: Record<string, number> = {
        I: 1,
        II: 2,
        III: 3,
        "III Vertex": 4,
        IV: 5,
        V: 6,
        VI: 7,
        VII: 8,
      };
      return order[g] ?? null;
    }
    case "ludwig": {
      const g = grade.trim().toUpperCase();
      const order: Record<string, number> = { I: 1, II: 2, III: 3 };
      return order[g] ?? null;
    }
    case "sinclair": {
      const g = grade.trim().toUpperCase();
      const order: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5 };
      return order[g] ?? null;
    }
    case "olsen": {
      const g = grade.trim().toLowerCase();
      const order: Record<string, number> = { mild: 1, moderate: 2, severe: 3 };
      return order[g] ?? null;
    }
    case "custom":
      return null;
    default:
      return null;
  }
}

export function norwoodOrdinalToGradeLabel(ordinal: number): string | null {
  const labels = ["", "I", "II", "III", "III Vertex", "IV", "V", "VI", "VII"];
  const i = Math.round(ordinal);
  if (i < 1 || i > 8) return null;
  return labels[i] ?? null;
}
