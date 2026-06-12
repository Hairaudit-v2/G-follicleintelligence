import type {
  FiIntelligenceSignalSeverity,
  FiOrganisationalIntelligenceSignalKey,
} from "@/src/config/fiOrganisationalIntelligenceSignals";
import { FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS } from "@/src/config/fiOrganisationalIntelligenceSignals";

export type FiStaffSignalCountMap = Partial<Record<FiOrganisationalIntelligenceSignalKey, number>>;

export type FiStaffSignalCard = {
  key: FiOrganisationalIntelligenceSignalKey;
  label: string;
  description: string;
  category: string;
  count: number;
  severity: FiIntelligenceSignalSeverity;
  visibility_level: string;
};

/**
 * Maps a non-negative count to a severity using registry thresholds (supportive, not comparative).
 */
export function severityForSignalCount(
  key: FiOrganisationalIntelligenceSignalKey,
  count: number
): FiIntelligenceSignalSeverity {
  const def = FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS[key];
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n <= 0) return "info";
  if (def.critical_min != null && n >= def.critical_min) return "critical";
  if (n >= def.attention_min) return "attention";
  return "info";
}

/**
 * Builds explainable per-signal cards for manager UI (counts + severity + copy from registry).
 */
export function buildStaffSignalCards(counts: FiStaffSignalCountMap): FiStaffSignalCard[] {
  const out: FiStaffSignalCard[] = [];
  for (const key of Object.keys(FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS) as FiOrganisationalIntelligenceSignalKey[]) {
    const def = FI_ORGANISATIONAL_INTELLIGENCE_SIGNALS[key];
    const count = Math.max(0, Math.floor(Number(counts[key] ?? 0)));
    out.push({
      key,
      label: def.label,
      description: def.description,
      category: def.category,
      count,
      severity: severityForSignalCount(key, count),
      visibility_level: def.visibility_level,
    });
  }
  return out.sort((a, b) => {
    const sev = (s: FiIntelligenceSignalSeverity) => (s === "critical" ? 2 : s === "attention" ? 1 : 0);
    return sev(b.severity) - sev(a.severity) || b.count - a.count || a.label.localeCompare(b.label);
  });
}
