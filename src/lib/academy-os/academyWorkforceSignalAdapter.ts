import type {
  AcademyReadinessBand,
  FiStaffCompetencyProjectionRow,
} from "./academyCompetencyTypes";

export type AcademyCompetencyRisk = "low" | "medium" | "high" | "critical";

export type AcademyCompetencySignals = {
  activeCompetencies: number;
  expiredCompetencies: number;
  restrictedCompetencies: number;
  highestReadinessBand: AcademyReadinessBand | null;
  competencyRisk: AcademyCompetencyRisk;
  certificationsExpiringSoon: number;
  /** True when at least one AcademyOS projection row exists for this staff member. */
  hasProjection: boolean;
};

const READINESS_BAND_RANK: Record<AcademyReadinessBand, number> = {
  early: 1,
  developing: 2,
  supervised: 3,
  advanced: 4,
};

const MS_DAY = 86_400_000;
const EXPIRING_SOON_DAYS = 30;

function parseIsoDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw.trim());
  return Number.isNaN(t) ? null : new Date(t);
}

function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / MS_DAY;
}

function resolveHighestReadinessBand(
  projections: FiStaffCompetencyProjectionRow[]
): AcademyReadinessBand | null {
  let highest: AcademyReadinessBand | null = null;
  let rank = 0;

  for (const row of projections) {
    if (!row.readinessBand) continue;
    const r = READINESS_BAND_RANK[row.readinessBand];
    if (r > rank) {
      rank = r;
      highest = row.readinessBand;
    }
  }

  return highest;
}

function resolveCompetencyRisk(input: {
  active: number;
  expired: number;
  restricted: number;
  expiringSoon: number;
}): AcademyCompetencyRisk {
  if (input.restricted > 0 || input.expired > 0) return "critical";
  if (input.expiringSoon > 0) return "high";
  if (input.active === 0) return "medium";
  return "low";
}

/**
 * Pure adapter — builds WorkforceOS competency readiness signals from AcademyOS projections.
 */
export function buildAcademyCompetencySignalsFromProjections(
  projections: FiStaffCompetencyProjectionRow[],
  now?: Date
): AcademyCompetencySignals {
  const at = now ?? new Date();

  if (projections.length === 0) {
    return {
      activeCompetencies: 0,
      expiredCompetencies: 0,
      restrictedCompetencies: 0,
      highestReadinessBand: null,
      competencyRisk: "medium",
      certificationsExpiringSoon: 0,
      hasProjection: false,
    };
  }

  let activeCompetencies = 0;
  let expiredCompetencies = 0;
  let restrictedCompetencies = 0;
  let certificationsExpiringSoon = 0;

  for (const row of projections) {
    switch (row.competencyStatus) {
      case "active":
        activeCompetencies++;
        break;
      case "expired":
        expiredCompetencies++;
        break;
      case "restricted":
      case "suspended":
        restrictedCompetencies++;
        break;
      case "expiring":
        activeCompetencies++;
        certificationsExpiringSoon++;
        break;
      default:
        break;
    }

    if (row.competencyStatus === "active" && row.expiresAt) {
      const exp = parseIsoDate(row.expiresAt);
      if (exp && daysUntil(exp, at) <= EXPIRING_SOON_DAYS && daysUntil(exp, at) >= 0) {
        certificationsExpiringSoon++;
      }
    }
  }

  return {
    activeCompetencies,
    expiredCompetencies,
    restrictedCompetencies,
    highestReadinessBand: resolveHighestReadinessBand(projections),
    competencyRisk: resolveCompetencyRisk({
      active: activeCompetencies,
      expired: expiredCompetencies,
      restricted: restrictedCompetencies,
      expiringSoon: certificationsExpiringSoon,
    }),
    certificationsExpiringSoon,
    hasProjection: true,
  };
}
