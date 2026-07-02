/**
 * Pure Procedure Day live workflow — stage machine and display derivation.
 */

export const PROCEDURE_DAY_WORKFLOW_STAGES = [
  "scheduled",
  "arrived",
  "pre_op",
  "anaesthesia",
  "extraction",
  "graft_counting",
  "implantation",
  "quality_check",
  "post_op",
  "discharged",
  "completed",
] as const;

export type ProcedureDayWorkflowStage = (typeof PROCEDURE_DAY_WORKFLOW_STAGES)[number];

export const PROCEDURE_DAY_STAGE_LABELS: Record<ProcedureDayWorkflowStage, string> = {
  scheduled: "Scheduled",
  arrived: "Arrived",
  pre_op: "Pre-op",
  anaesthesia: "Anaesthesia",
  extraction: "Extraction",
  graft_counting: "Graft counting",
  implantation: "Implantation",
  quality_check: "Quality check",
  post_op: "Post-op",
  discharged: "Discharged",
  completed: "Completed",
};

const TERMINAL_STAGES = new Set<ProcedureDayWorkflowStage>(["discharged", "completed"]);

export function isProcedureDayWorkflowStage(v: string): v is ProcedureDayWorkflowStage {
  return (PROCEDURE_DAY_WORKFLOW_STAGES as readonly string[]).includes(v);
}

export function procedureDayStageIndex(stage: ProcedureDayWorkflowStage): number {
  return PROCEDURE_DAY_WORKFLOW_STAGES.indexOf(stage);
}

export function nextProcedureDayStage(
  stage: ProcedureDayWorkflowStage
): ProcedureDayWorkflowStage | null {
  const idx = procedureDayStageIndex(stage);
  if (idx < 0 || idx >= PROCEDURE_DAY_WORKFLOW_STAGES.length - 1) return null;
  const next = PROCEDURE_DAY_WORKFLOW_STAGES[idx + 1]!;
  if (TERMINAL_STAGES.has(stage)) return null;
  return next;
}

export function assertProcedureDayStageTransitionAllowed(
  from: ProcedureDayWorkflowStage,
  to: ProcedureDayWorkflowStage
): void {
  if (from === to) return;
  const fromIdx = procedureDayStageIndex(from);
  const toIdx = procedureDayStageIndex(to);
  if (fromIdx < 0 || toIdx < 0) throw new Error("Invalid procedure day stage.");
  if (toIdx < fromIdx) throw new Error(`Cannot move backward from ${from} to ${to}.`);
  if (toIdx > fromIdx + 1) throw new Error(`Stages must advance one step at a time (${from} → ${to}).`);
}

export function deriveProcedureDayStageFromBooking(input: {
  bookingStatus: string;
  procedureStatus?: string | null;
}): ProcedureDayWorkflowStage {
  const booking = input.bookingStatus.trim().toLowerCase();
  const proc = input.procedureStatus?.trim().toLowerCase() ?? "";

  if (proc === "completed" || booking === "completed") return "completed";
  if (booking === "cancelled" || booking === "no_show" || proc === "cancelled" || proc === "aborted") {
    return "scheduled";
  }
  if (proc === "in_progress" || booking === "in_progress") return "extraction";
  if (proc === "checked_in" || booking === "arrived") return "arrived";
  if (booking === "confirmed") return "scheduled";
  return "scheduled";
}

export function buildProcedureDayChecklist(
  stage: ProcedureDayWorkflowStage,
  metrics: {
    graftsExtracted?: number | null;
    graftsImplanted?: number | null;
    preOpComplete?: boolean;
    consentSigned?: boolean;
  }
): { id: string; label: string; complete: boolean; required: boolean }[] {
  const items = [
    {
      id: "consent",
      label: "Consent confirmed",
      complete: metrics.consentSigned === true,
      required: true,
    },
    {
      id: "pre_op",
      label: "Pre-op checklist complete",
      complete: metrics.preOpComplete === true,
      required: true,
    },
    {
      id: "anaesthesia",
      label: "Anaesthesia clearance",
      complete: procedureDayStageIndex(stage) >= procedureDayStageIndex("anaesthesia"),
      required: true,
    },
    {
      id: "extraction",
      label: "Extraction documented",
      complete: (metrics.graftsExtracted ?? 0) > 0,
      required: true,
    },
    {
      id: "implantation",
      label: "Implantation documented",
      complete: (metrics.graftsImplanted ?? 0) > 0,
      required: true,
    },
    {
      id: "quality",
      label: "Quality check signed off",
      complete: procedureDayStageIndex(stage) >= procedureDayStageIndex("quality_check"),
      required: true,
    },
    {
      id: "post_op",
      label: "Post-op instructions given",
      complete: procedureDayStageIndex(stage) >= procedureDayStageIndex("post_op"),
      required: true,
    },
  ];
  return items;
}

export function buildProcedureDaySafetyWarnings(input: {
  stage: ProcedureDayWorkflowStage;
  graftsExtracted?: number | null;
  graftsImplanted?: number | null;
  transectionRate?: number | null;
  adverseEvents?: string[] | null;
  financialClearanceBlocked?: boolean;
  missingSurgeon?: boolean;
}): string[] {
  const warnings: string[] = [];
  if (input.financialClearanceBlocked) {
    warnings.push("Financial clearance incomplete — confirm deposit before starting.");
  }
  if (input.missingSurgeon) {
    warnings.push("Surgeon not assigned on procedure record.");
  }
  const ex = input.graftsExtracted ?? 0;
  const im = input.graftsImplanted ?? 0;
  if (
    ex > 0 &&
    im > 0 &&
    procedureDayStageIndex(input.stage) >= procedureDayStageIndex("implantation") &&
    im > ex
  ) {
    warnings.push("Implanted graft count exceeds extracted count.");
  }
  if (input.transectionRate != null && input.transectionRate > 15) {
    warnings.push(`High transection rate (${input.transectionRate}%).`);
  }
  if (input.adverseEvents?.length) {
    warnings.push(`${input.adverseEvents.length} adverse event(s) recorded.`);
  }
  return warnings;
}

export function mergeProcedureDayMetrics(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

export function applyGraftMetricIncrement(
  current: number | null | undefined,
  delta: number
): number {
  const base = typeof current === "number" && Number.isFinite(current) ? current : 0;
  return base + delta;
}