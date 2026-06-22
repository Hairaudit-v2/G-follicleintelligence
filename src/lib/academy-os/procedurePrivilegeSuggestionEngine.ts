/**
 * AcademyOS Phase C — suggest operational privileges from IIOHR competency projections.
 * Does not auto-grant — admin confirmation required.
 */

import type { FiStaffCompetencyProjectionRow } from "./academyCompetencyTypes";
import type { FiStaffProcedurePrivilegeRow, PrivilegeLevel } from "./procedurePrivilegeTypes";

export type SuggestedProcedurePrivilege = {
  procedureKey: string;
  privilegeLevel: PrivilegeLevel;
  sourceCompetencyKey: string;
  reason: string;
};

export type ProcedurePrivilegeSuggestionResult = {
  suggestedPrivileges: SuggestedProcedurePrivilege[];
  reason: string;
  sourceProjectionId: string;
};

type CompetencyMappingRule = {
  pattern: RegExp;
  suggestions: Array<{ procedureKey: string; privilegeLevel: PrivilegeLevel; reason: string }>;
};

const COMPETENCY_TO_PRIVILEGE_RULES: CompetencyMappingRule[] = [
  {
    pattern: /^fue_extraction_level_1$/i,
    suggestions: [{ procedureKey: "fue_extraction", privilegeLevel: "perform_supervised", reason: "Level 1 FUE extraction competency" }],
  },
  {
    pattern: /^fue_extraction_level_[2-9]$/i,
    suggestions: [{ procedureKey: "fue_extraction", privilegeLevel: "perform_independent", reason: "Advanced FUE extraction competency" }],
  },
  {
    pattern: /^fue_implantation_level_1$/i,
    suggestions: [{ procedureKey: "fue_implantation", privilegeLevel: "perform_supervised", reason: "Level 1 FUE implantation competency" }],
  },
  {
    pattern: /^fue_implantation_level_2$/i,
    suggestions: [{ procedureKey: "fue_implantation", privilegeLevel: "perform_independent", reason: "Level 2 FUE implantation competency" }],
  },
  {
    pattern: /^fue_implantation_level_[3-9]$/i,
    suggestions: [{ procedureKey: "fue_implantation", privilegeLevel: "perform_independent", reason: "Advanced FUE implantation competency" }],
  },
  {
    pattern: /^theatre_assistant_level_[12]$/i,
    suggestions: [
      { procedureKey: "theatre_setup", privilegeLevel: "assist", reason: "Theatre assistant competency" },
      { procedureKey: "graft_sorting", privilegeLevel: "assist", reason: "Theatre assistant competency" },
    ],
  },
  {
    pattern: /^hair_consultation_certified$/i,
    suggestions: [{ procedureKey: "consultation", privilegeLevel: "perform_independent", reason: "Hair consultation certification" }],
  },
  {
    pattern: /^infection_control_protocol$/i,
    suggestions: [{ procedureKey: "theatre_setup", privilegeLevel: "assist", reason: "Infection control protocol competency" }],
  },
  {
    pattern: /^donor_assessment/i,
    suggestions: [{ procedureKey: "donor_assessment", privilegeLevel: "perform_supervised", reason: "Donor assessment competency" }],
  },
  {
    pattern: /^hairline_design/i,
    suggestions: [{ procedureKey: "hairline_design", privilegeLevel: "perform_supervised", reason: "Hairline design competency" }],
  },
  {
    pattern: /^graft_sorting/i,
    suggestions: [{ procedureKey: "graft_sorting", privilegeLevel: "assist", reason: "Graft sorting competency" }],
  },
  {
    pattern: /^prp/i,
    suggestions: [{ procedureKey: "prp_assistance", privilegeLevel: "perform_supervised", reason: "PRP competency projection" }],
  },
  {
    pattern: /^exosomes/i,
    suggestions: [{ procedureKey: "exosomes_assistance", privilegeLevel: "perform_supervised", reason: "Exosomes competency projection" }],
  },
];

function normalizeCompetencyKey(key: string): string {
  return key.trim().toLowerCase();
}

function isProjectionEligibleForSuggestion(row: FiStaffCompetencyProjectionRow): boolean {
  return row.competencyStatus === "active" || row.competencyStatus === "expiring";
}

/** Suggest privileges for a single competency projection row. */
export function suggestProcedurePrivilegesFromProjection(
  projection: FiStaffCompetencyProjectionRow
): ProcedurePrivilegeSuggestionResult {
  const competencyKey = normalizeCompetencyKey(projection.competencyKey);

  if (!isProjectionEligibleForSuggestion(projection)) {
    return {
      suggestedPrivileges: [],
      reason: `Competency status ${projection.competencyStatus} — no privilege suggestions`,
      sourceProjectionId: projection.id,
    };
  }

  const suggested: SuggestedProcedurePrivilege[] = [];

  for (const rule of COMPETENCY_TO_PRIVILEGE_RULES) {
    if (!rule.pattern.test(competencyKey)) continue;
    for (const item of rule.suggestions) {
      suggested.push({
        procedureKey: item.procedureKey,
        privilegeLevel: item.privilegeLevel,
        sourceCompetencyKey: projection.competencyKey,
        reason: item.reason,
      });
    }
  }

  if (suggested.length === 0) {
    return {
      suggestedPrivileges: [],
      reason: "No mapping rule for competency key",
      sourceProjectionId: projection.id,
    };
  }

  return {
    suggestedPrivileges: suggested,
    reason: `Suggested from IIOHR competency ${projection.competencyKey}`,
    sourceProjectionId: projection.id,
  };
}

/** Batch suggestions from all projections, deduped by procedure + level. */
export function suggestProcedurePrivilegesFromProjections(
  projections: FiStaffCompetencyProjectionRow[]
): ProcedurePrivilegeSuggestionResult[] {
  return projections.map(suggestProcedurePrivilegesFromProjection);
}

/** Returns suggestions not already covered by an active privilege. */
export function filterNovelPrivilegeSuggestions(input: {
  suggestions: ProcedurePrivilegeSuggestionResult[];
  existingPrivileges: FiStaffProcedurePrivilegeRow[];
}): ProcedurePrivilegeSuggestionResult[] {
  const existing = new Set(
    input.existingPrivileges
      .filter((p) => p.privilegeStatus === "active" || p.privilegeStatus === "pending_review")
      .map((p) => `${String(p.procedureKey).trim().toLowerCase()}::${p.privilegeLevel}`)
  );

  return input.suggestions.map((result) => ({
    ...result,
    suggestedPrivileges: result.suggestedPrivileges.filter(
      (s) => !existing.has(`${s.procedureKey.trim().toLowerCase()}::${s.privilegeLevel}`)
    ),
  }));
}
