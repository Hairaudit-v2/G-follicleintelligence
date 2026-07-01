import type { ProcedureDayUpsertPatch, ProcedureStatusValue } from "@/src/lib/cases/procedureDayTypes";
import { isProcedureStatus } from "@/src/lib/cases/procedureDayTypes";
import type { CaseProcedureRow } from "@/src/lib/cases/procedureDayLoaders";

export type LiveTheatreCaseSyncTrigger = "procedure_completed" | "graft_reconciliation_completed";

export const LIVE_THEATRE_SYNC_MILESTONE_KEYS = {
  syncedAt: "_live_theatre_sync_at",
  surgeryId: "_live_theatre_sync_surgery_id",
  trigger: "_live_theatre_sync_trigger",
} as const;

export type LiveTheatreSurgerySnapshot = {
  id: string;
  case_id: string | null;
  status: string;
  scheduled_date: string;
  actual_start_at: string | null;
  actual_end_at: string | null;
  surgeon_fi_user_id: string | null;
};

export type LiveTheatreGraftSessionSnapshot = {
  extracted_grafts: number;
  implanted_grafts: number;
  total_hairs: number;
  reconciliation_status: string;
  reconciled_at: string | null;
};

const PROCEDURE_STATUS_RANK: Record<ProcedureStatusValue, number> = {
  scheduled: 0,
  checked_in: 1,
  in_progress: 2,
  paused: 3,
  completed: 4,
  cancelled: 5,
  aborted: 6,
};

export function mapLiveTheatreStatusToProcedureStatus(
  surgeryStatus: string,
  trigger: LiveTheatreCaseSyncTrigger
): ProcedureStatusValue | null {
  const s = surgeryStatus.trim().toLowerCase();
  if (s === "completed" || trigger === "procedure_completed") return "completed";
  if (s === "cancelled") return "cancelled";
  if (s === "in_progress" || s === "pre_op" || s === "anaesthetic") return "in_progress";
  if (s === "scheduled") return "scheduled";
  return null;
}

export function shouldAdvanceProcedureStatus(
  current: string | null | undefined,
  next: ProcedureStatusValue
): boolean {
  const cur = isProcedureStatus(current) ? current : "scheduled";
  if (cur === "cancelled" || cur === "aborted") return false;
  if (next === "cancelled") return true;
  return PROCEDURE_STATUS_RANK[next] >= PROCEDURE_STATUS_RANK[cur];
}

export function buildLiveTheatreSyncMilestones(input: {
  existing: Record<string, string>;
  trigger: LiveTheatreCaseSyncTrigger;
  surgeryId: string;
  syncedAt: string;
  graftSession: LiveTheatreGraftSessionSnapshot | null;
}): Record<string, string> {
  const merged = { ...input.existing };
  merged[LIVE_THEATRE_SYNC_MILESTONE_KEYS.syncedAt] = input.syncedAt;
  merged[LIVE_THEATRE_SYNC_MILESTONE_KEYS.surgeryId] = input.surgeryId;
  merged[LIVE_THEATRE_SYNC_MILESTONE_KEYS.trigger] = input.trigger;

  if (
    input.trigger === "graft_reconciliation_completed" &&
    input.graftSession?.reconciled_at?.trim()
  ) {
    merged.final_count_agreed = input.graftSession.reconciled_at.trim();
  }
  if (input.trigger === "procedure_completed") {
    merged.patient_discharge_ready = input.syncedAt;
  }

  return merged;
}

export function isLiveTheatreCaseSyncNoOp(input: {
  existing: CaseProcedureRow | null;
  surgeryId: string;
  trigger: LiveTheatreCaseSyncTrigger;
  graftSession: LiveTheatreGraftSessionSnapshot | null;
}): boolean {
  if (!input.existing) return false;

  const milestones = input.existing.procedure_milestones;
  const lastSurgeryId = milestones[LIVE_THEATRE_SYNC_MILESTONE_KEYS.surgeryId]?.trim();
  const lastTrigger = milestones[LIVE_THEATRE_SYNC_MILESTONE_KEYS.trigger]?.trim();
  const lastSyncedAt = milestones[LIVE_THEATRE_SYNC_MILESTONE_KEYS.syncedAt]?.trim();

  if (lastSurgeryId !== input.surgeryId) return false;
  if (lastTrigger !== input.trigger) return false;
  if (!lastSyncedAt) return false;

  if (input.trigger === "graft_reconciliation_completed") {
    const reconciledAt = input.graftSession?.reconciled_at?.trim();
    if (reconciledAt && reconciledAt !== milestones.final_count_agreed?.trim()) return false;
    if (
      input.graftSession &&
      input.existing.grafts_implanted === input.graftSession.implanted_grafts &&
      input.existing.grafts_extracted === input.graftSession.extracted_grafts
    ) {
      return true;
    }
    return false;
  }

  if (input.existing.procedure_status === "completed") {
    return true;
  }

  return false;
}

export function buildLiveTheatreCaseProcedurePatch(input: {
  surgery: LiveTheatreSurgerySnapshot;
  graftSession: LiveTheatreGraftSessionSnapshot | null;
  existing: CaseProcedureRow | null;
  trigger: LiveTheatreCaseSyncTrigger;
  syncedAt: string;
}): ProcedureDayUpsertPatch | null {
  if (!input.surgery.case_id?.trim()) return null;

  const patch: ProcedureDayUpsertPatch = {};
  const mappedStatus = mapLiveTheatreStatusToProcedureStatus(input.surgery.status, input.trigger);
  if (
    mappedStatus &&
    shouldAdvanceProcedureStatus(input.existing?.procedure_status, mappedStatus)
  ) {
    patch.procedure_status = mappedStatus;
  }

  if (!input.existing?.procedure_date?.trim() && input.surgery.scheduled_date?.trim()) {
    patch.procedure_date = input.surgery.scheduled_date.trim().slice(0, 10);
  }

  if (input.surgery.actual_start_at?.trim()) {
    const existingStart = input.existing?.start_time?.trim();
    if (!existingStart) patch.start_time = input.surgery.actual_start_at.trim();
  }
  if (input.surgery.actual_end_at?.trim()) {
    const existingEnd = input.existing?.finish_time?.trim();
    if (!existingEnd) patch.finish_time = input.surgery.actual_end_at.trim();
  }

  if (!input.existing?.surgeon_user_id?.trim() && input.surgery.surgeon_fi_user_id?.trim()) {
    patch.surgeon_user_id = input.surgery.surgeon_fi_user_id.trim();
  }

  if (input.graftSession) {
    const { extracted_grafts, implanted_grafts, total_hairs } = input.graftSession;
    if (extracted_grafts > 0 || input.existing?.grafts_extracted == null) {
      patch.grafts_extracted = extracted_grafts;
    }
    if (implanted_grafts > 0 || input.existing?.grafts_implanted == null) {
      patch.grafts_implanted = implanted_grafts;
    }
    if (total_hairs > 0 || input.existing?.hairs_implanted == null) {
      patch.hairs_implanted = total_hairs;
    }
  }

  patch.procedure_milestones = buildLiveTheatreSyncMilestones({
    existing: input.existing?.procedure_milestones ?? {},
    trigger: input.trigger,
    surgeryId: input.surgery.id,
    syncedAt: input.syncedAt,
    graftSession: input.graftSession,
  });

  if (input.trigger === "procedure_completed" && !input.existing?.completion_summary?.trim()) {
    patch.completion_summary = "Procedure completed in SurgeryOS live theatre.";
  }

  const hasScalarPatch = Object.keys(patch).some((k) => k !== "procedure_milestones");
  if (!hasScalarPatch && !patch.procedure_milestones) return null;
  return patch;
}
