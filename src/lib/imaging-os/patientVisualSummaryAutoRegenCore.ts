/**
 * ImagingOS Phase 7C — auto-regeneration rules for patient visual summaries (pure).
 */

import { patientVisualSummaryPatientAccessAllowed } from "./patientVisualSummaryApprovalCore";
import type { PatientVisualSummaryApprovalRecord } from "./patientVisualSummaryReportTypes";

export const PATIENT_VISUAL_SUMMARY_AUTO_REGEN_VERSION =
  "patient_visual_summary_auto_regen_v1" as const;

export const PATIENT_VISUAL_SUMMARY_AUTO_REGEN_TRIGGERS = [
  "graft_reconciled",
  "post_op_capture",
] as const;

export type PatientVisualSummaryAutoRegenTrigger =
  (typeof PATIENT_VISUAL_SUMMARY_AUTO_REGEN_TRIGGERS)[number];

export type PatientVisualSummaryAutoRegenRecord = {
  trigger: PatientVisualSummaryAutoRegenTrigger;
  triggered_at: string;
  source: string;
  version: typeof PATIENT_VISUAL_SUMMARY_AUTO_REGEN_VERSION;
  regenerated: boolean;
  preserved_approved?: boolean;
};

const AUTO_REGEN_KEY = "patient_visual_summary_auto_regen" as const;

export function shouldAutoRegenerateVisualSummary(
  approval: PatientVisualSummaryApprovalRecord | null
): boolean {
  if (!approval) return true;
  return !patientVisualSummaryPatientAccessAllowed(approval);
}

export function buildAutoRegenMetadata(input: {
  trigger: PatientVisualSummaryAutoRegenTrigger;
  source: string;
  regenerated: boolean;
  preservedApproved?: boolean;
  triggeredAt?: string;
}): PatientVisualSummaryAutoRegenRecord {
  return {
    trigger: input.trigger,
    triggered_at: input.triggeredAt ?? new Date().toISOString(),
    source: input.source,
    version: PATIENT_VISUAL_SUMMARY_AUTO_REGEN_VERSION,
    regenerated: input.regenerated,
    ...(input.preservedApproved ? { preserved_approved: true } : {}),
  };
}

export function readAutoRegenMetadata(
  metadata: Record<string, unknown> | null | undefined
): PatientVisualSummaryAutoRegenRecord | null {
  const raw = metadata?.[AUTO_REGEN_KEY];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const m = raw as Record<string, unknown>;
  const trigger = m.trigger;
  if (
    typeof trigger !== "string" ||
    !(PATIENT_VISUAL_SUMMARY_AUTO_REGEN_TRIGGERS as readonly string[]).includes(trigger)
  ) {
    return null;
  }
  return {
    trigger: trigger as PatientVisualSummaryAutoRegenTrigger,
    triggered_at: typeof m.triggered_at === "string" ? m.triggered_at : "",
    source: typeof m.source === "string" ? m.source : "",
    version: PATIENT_VISUAL_SUMMARY_AUTO_REGEN_VERSION,
    regenerated: Boolean(m.regenerated),
    preserved_approved: m.preserved_approved === true ? true : undefined,
  };
}

export function mergeAutoRegenMetadata(
  existingMetadata: Record<string, unknown> | null | undefined,
  record: PatientVisualSummaryAutoRegenRecord
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === "object" && !Array.isArray(existingMetadata)
      ? { ...existingMetadata }
      : {};
  return { ...base, [AUTO_REGEN_KEY]: record };
}