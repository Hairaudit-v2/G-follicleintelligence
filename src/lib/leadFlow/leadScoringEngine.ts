/**
 * LeadFlowOS Phase LF-3 — deterministic hair-restoration lead scoring (pure, no DB I/O).
 */

import { clampLeadScore } from "@/src/lib/leadFlow/leadFlowFoundationCore";

export const LEAD_PRIORITY_BANDS = ["low", "medium", "high", "urgent"] as const;
export type LeadPriorityBand = (typeof LEAD_PRIORITY_BANDS)[number];

export const PREDICTED_PROCEDURES = [
  "fue_transplant",
  "prp",
  "exosomes",
  "repair_case",
  "consultation_only",
  "unknown",
] as const;
export type PredictedProcedure = (typeof PREDICTED_PROCEDURES)[number];

export type LeadScoringInput = {
  procedure_interest: string | null;
  lead_source: string | null;
  country: string | null;
  budget_range: string | null;
  current_stage: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
};

export type LeadScoringResult = {
  lead_score: number;
  conversion_probability: number;
  priority_band: LeadPriorityBand;
  predicted_procedure: PredictedProcedure;
  scoring_reasons: string[];
  risk_flags: string[];
};

const REPAIR_INTEREST = /repair|bad\s*transplant|donor\s*damage|corrective|revision/i;
const TRANSPLANT_INTEREST = /transplant|\bfue\b|hairline|crown|\bfut\b/i;
const PRP_INTEREST = /\bprp\b|platelet/i;
const EXOSOME_INTEREST = /exosome/i;
const CONSULT_ONLY_INTEREST = /consult|unsure|not\s*sure|explor|information/i;

const HIGH_BUDGET = /high|surgery[-\s]?ready|premium|\$?\s*1[5-9]\d{3}|\$?\s*[2-9]\d{4,}|15\s*k|20\s*k|25\s*k/i;
const LOW_BUDGET = /low|unknown|unsure|tbd|n\/a|none|^$/i;

const AUSTRALIA_COUNTRY = /australia|\bau\b|aus\b/i;

const CONSULTATION_STAGES = /^(consultation_booked|consult_scheduled)$/i;
const QUOTE_STAGES = /^(quote_sent|proposal_sent)$/i;
const PROCEDURE_BOOKED_STAGES = /^(procedure_booked|won)$/i;

function norm(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

function hasContact(value: string | null | undefined): boolean {
  return norm(value).length > 0;
}

function isAustraliaLead(country: string | null | undefined): boolean {
  const c = norm(country);
  if (!c) return false;
  return AUSTRALIA_COUNTRY.test(c);
}

function isInternationalLead(country: string | null | undefined): boolean {
  const c = norm(country);
  if (!c) return false;
  return !isAustraliaLead(c);
}

function isHighBudget(budgetRange: string | null | undefined): boolean {
  const b = norm(budgetRange);
  if (!b) return false;
  return HIGH_BUDGET.test(b);
}

function isLowOrUnknownBudget(budgetRange: string | null | undefined): boolean {
  const b = norm(budgetRange);
  if (!b) return true;
  if (isHighBudget(b)) return false;
  return LOW_BUDGET.test(b);
}

function stageScoreBonus(stage: string | null | undefined): { points: number; reason: string | null } {
  const s = norm(stage).toLowerCase();
  if (!s) return { points: 0, reason: null };
  if (PROCEDURE_BOOKED_STAGES.test(s)) {
    return { points: 35, reason: "Procedure booked stage (+35)" };
  }
  if (QUOTE_STAGES.test(s)) {
    return { points: 25, reason: "Quote or proposal sent stage (+25)" };
  }
  if (CONSULTATION_STAGES.test(s)) {
    return { points: 20, reason: "Consultation booked stage (+20)" };
  }
  return { points: 0, reason: null };
}

function resolvePredictedProcedure(interest: string): PredictedProcedure {
  if (!interest) return "unknown";
  if (REPAIR_INTEREST.test(interest)) return "repair_case";
  if (PRP_INTEREST.test(interest)) return "prp";
  if (EXOSOME_INTEREST.test(interest)) return "exosomes";
  if (TRANSPLANT_INTEREST.test(interest)) return "fue_transplant";
  if (CONSULT_ONLY_INTEREST.test(interest)) return "consultation_only";
  return "unknown";
}

function procedureIntentBonus(interest: string): { points: number; reason: string | null; procedure: PredictedProcedure } {
  const predicted = resolvePredictedProcedure(interest);
  if (!interest) {
    return { points: 0, reason: null, procedure: "unknown" };
  }
  if (predicted === "repair_case") {
    return { points: 30, reason: "Repair or corrective case interest (+30)", procedure: "repair_case" };
  }
  if (predicted === "prp") {
    return { points: 15, reason: "PRP treatment interest (+15)", procedure: "prp" };
  }
  if (predicted === "exosomes") {
    return { points: 15, reason: "Exosome treatment interest (+15)", procedure: "exosomes" };
  }
  if (predicted === "fue_transplant") {
    return { points: 25, reason: "FUE or transplant interest (+25)", procedure: "fue_transplant" };
  }
  if (predicted === "consultation_only") {
    return { points: 0, reason: "Consultation-only interest", procedure: "consultation_only" };
  }
  return { points: 0, reason: null, procedure: "unknown" };
}

export function resolveLeadPriorityBand(leadScore: number): LeadPriorityBand {
  const score = clampLeadScore(leadScore);
  if (score >= 85) return "urgent";
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function scoreLead(input: LeadScoringInput): LeadScoringResult {
  const scoringReasons: string[] = [];
  const riskFlags: string[] = [];

  let contactPoints = 0;
  let intentPoints = 0;
  let budgetPoints = 0;
  let locationPoints = 0;
  let stagePoints = 0;

  if (hasContact(input.phone)) {
    contactPoints += 15;
    scoringReasons.push("Has phone number (+15)");
  } else {
    riskFlags.push("missing_phone");
  }

  if (hasContact(input.email)) {
    contactPoints += 10;
    scoringReasons.push("Has email address (+10)");
  } else {
    riskFlags.push("missing_email");
  }

  const interest = norm(input.procedure_interest);
  const procedure = procedureIntentBonus(interest);
  intentPoints += procedure.points;
  if (procedure.reason) scoringReasons.push(procedure.reason);

  if (isHighBudget(input.budget_range)) {
    budgetPoints += 20;
    scoringReasons.push("High or surgery-ready budget (+20)");
  } else if (isLowOrUnknownBudget(input.budget_range)) {
    riskFlags.push("low_or_unknown_budget");
  }

  if (isAustraliaLead(input.country)) {
    locationPoints += 10;
    scoringReasons.push("Local Australia lead (+10)");
  } else if (isInternationalLead(input.country)) {
    riskFlags.push("international_lead");
  }

  const stageBonus = stageScoreBonus(input.current_stage);
  stagePoints += stageBonus.points;
  if (stageBonus.reason) scoringReasons.push(stageBonus.reason);

  const leadScore = clampLeadScore(contactPoints + intentPoints + budgetPoints + locationPoints + stagePoints);

  const conversionProbability = clampLeadScore(
    Math.round(
      contactPoints * 1 +
        intentPoints * 1.1 +
        budgetPoints * 1 +
        locationPoints * 0.9 +
        stagePoints * 1.25
    )
  );

  return {
    lead_score: leadScore,
    conversion_probability: conversionProbability,
    priority_band: resolveLeadPriorityBand(leadScore),
    predicted_procedure: procedure.procedure,
    scoring_reasons: scoringReasons,
    risk_flags: riskFlags,
  };
}

export function leadScoringRowFromResult(result: LeadScoringResult, scoredAt?: string): Record<string, unknown> {
  return {
    lead_score: result.lead_score,
    conversion_probability: result.conversion_probability,
    priority_band: result.priority_band,
    predicted_procedure: result.predicted_procedure,
    scoring_reasons: result.scoring_reasons,
    risk_flags: result.risk_flags,
    scored_at: scoredAt ?? new Date().toISOString(),
  };
}

export function leadScoringInputFromLeadRow(row: {
  procedure_interest?: string | null;
  lead_source?: string | null;
  country?: string | null;
  budget_range?: string | null;
  current_stage?: string | null;
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}): LeadScoringInput {
  return {
    procedure_interest: row.procedure_interest ?? null,
    lead_source: row.lead_source ?? null,
    country: row.country ?? null,
    budget_range: row.budget_range ?? null,
    current_stage: row.current_stage ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    first_name: row.first_name ?? null,
    last_name: row.last_name ?? null,
  };
}

export function mergeLeadRowForScoring(
  existing: {
    procedure_interest?: string | null;
    lead_source?: string | null;
    country?: string | null;
    budget_range?: string | null;
    current_stage?: string | null;
    email?: string | null;
    phone?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
  patch: Partial<{
    procedureInterest?: string | null;
    leadSource?: string | null;
    country?: string | null;
    budgetRange?: string | null;
    currentStage?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
  }>
): LeadScoringInput {
  return leadScoringInputFromLeadRow({
    procedure_interest: patch.procedureInterest ?? existing?.procedure_interest ?? null,
    lead_source: patch.leadSource ?? existing?.lead_source ?? null,
    country: patch.country ?? existing?.country ?? null,
    budget_range: patch.budgetRange ?? existing?.budget_range ?? null,
    current_stage: patch.currentStage ?? existing?.current_stage ?? null,
    email: patch.email ?? existing?.email ?? null,
    phone: patch.phone ?? existing?.phone ?? null,
    first_name: patch.firstName ?? existing?.first_name ?? null,
    last_name: patch.lastName ?? existing?.last_name ?? null,
  });
}

export type LeadScoringActivityPlan = {
  priorityBandChanged: boolean;
  predictedProcedureChanged: boolean;
  previousPriorityBand: LeadPriorityBand | null;
  nextPriorityBand: LeadPriorityBand;
  previousPredictedProcedure: PredictedProcedure | null;
  nextPredictedProcedure: PredictedProcedure;
};

export function buildLeadScoringActivityPlan(
  previous: {
    priority_band?: string | null;
    predicted_procedure?: string | null;
  } | null,
  next: LeadScoringResult
): LeadScoringActivityPlan {
  const prevBand = previous?.priority_band?.trim() as LeadPriorityBand | undefined;
  const prevProcedure = previous?.predicted_procedure?.trim() as PredictedProcedure | undefined;

  return {
    priorityBandChanged: !!previous && prevBand !== next.priority_band,
    predictedProcedureChanged: !!previous && prevProcedure !== next.predicted_procedure,
    previousPriorityBand: prevBand ?? null,
    nextPriorityBand: next.priority_band,
    previousPredictedProcedure: prevProcedure ?? null,
    nextPredictedProcedure: next.predicted_procedure,
  };
}
