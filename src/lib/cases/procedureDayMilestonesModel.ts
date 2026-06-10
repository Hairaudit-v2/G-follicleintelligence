/**
 * Procedure day milestone keys (V1.1) — timestamps stored on `fi_case_procedures.procedure_milestones` as JSON object.
 */

export const PROCEDURE_MILESTONE_KEYS = [
  "patient_arrived",
  "pre_op_brief_complete",
  "consent_time_out",
  "extraction_started",
  "extraction_complete",
  "implantation_started",
  "implantation_complete",
  "final_count_agreed",
  "patient_discharge_ready",
] as const;

export type ProcedureMilestoneKey = (typeof PROCEDURE_MILESTONE_KEYS)[number];

export const PROCEDURE_MILESTONE_LABEL: Record<ProcedureMilestoneKey, string> = {
  patient_arrived: "Patient arrived / checked in",
  pre_op_brief_complete: "Pre-op brief complete",
  consent_time_out: "Consent / time-out confirmed",
  extraction_started: "Extraction started",
  extraction_complete: "Extraction complete",
  implantation_started: "Implantation started",
  implantation_complete: "Implantation complete",
  final_count_agreed: "Final graft counts agreed",
  patient_discharge_ready: "Discharge / handoff ready",
};

export function isProcedureMilestoneKey(k: string): k is ProcedureMilestoneKey {
  return (PROCEDURE_MILESTONE_KEYS as readonly string[]).includes(k);
}

/** Normalize DB JSON to milestone key -> ISO string (non-empty). */
export function parseProcedureMilestones(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!k.trim()) continue;
    if (typeof v !== "string" || !v.trim()) continue;
    out[k.trim()] = v.trim();
  }
  return out;
}

export function milestoneCompletionCount(m: Record<string, string>): number {
  let n = 0;
  for (const k of PROCEDURE_MILESTONE_KEYS) {
    if (m[k]?.trim()) n += 1;
  }
  return n;
}
