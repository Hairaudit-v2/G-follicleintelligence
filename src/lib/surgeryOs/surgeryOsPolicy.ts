/**
 * SurgeryOS Phase 1B — pure policy (phase transitions, event/note permissions, actions).
 */

import type {
  SurgeryOsAssignmentStatus,
  SurgeryOsNoteKind,
  SurgeryOsProcedureEventKind,
  SurgeryOsViewerRole,
} from "@/src/lib/surgeryOs/surgeryOsBoardModel";

export const SURGERY_OS_ACTIONS = [
  "create_from_booking",
  "transition_phase",
  "log_event",
  "add_note",
  "update_team_status",
  "add_extraction_count",
  "add_implantation_count",
  "enter_tray_count",
  "log_discarded_grafts",
  "correct_graft_count",
  "reconcile_grafts",
  "confirm_tray_count",
] as const;
export type SurgeryOsAction = (typeof SURGERY_OS_ACTIONS)[number];

/** Major theatre phases for controlled forward transitions. */
export const SURGERY_OS_MAJOR_PHASES = [
  "scheduled",
  "pre_op",
  "anaesthetic",
  "extraction",
  "break",
  "site_creation",
  "implantation",
  "recovery",
  "complete",
] as const;
export type SurgeryOsMajorPhase = (typeof SURGERY_OS_MAJOR_PHASES)[number];

export type SurgeryOsStaffRoleCategory = "surgeon" | "nurse" | "technician" | "other" | null;

export type SurgeryOsMutationContext = {
  viewerRole: SurgeryOsViewerRole;
  staffRoleCategory: SurgeryOsStaffRoleCategory;
  actorFiUserId: string | null;
};

const PHASE_TRANSITIONS: Record<SurgeryOsMajorPhase, readonly SurgeryOsMajorPhase[]> = {
  scheduled: ["pre_op"],
  pre_op: ["anaesthetic"],
  anaesthetic: ["extraction"],
  extraction: ["break"],
  break: ["site_creation"],
  site_creation: ["implantation"],
  implantation: ["recovery"],
  recovery: ["complete"],
  complete: [],
};

export function isSurgeryOsMajorPhase(v: string): v is SurgeryOsMajorPhase {
  return (SURGERY_OS_MAJOR_PHASES as readonly string[]).includes(v);
}

export function isSurgeryOsAction(v: string): v is SurgeryOsAction {
  return (SURGERY_OS_ACTIONS as readonly string[]).includes(v);
}

export function resolveSurgeryOsStaffRoleCategory(
  staffRole: string | null | undefined
): SurgeryOsStaffRoleCategory {
  const sr = (staffRole ?? "").trim().toLowerCase();
  if (!sr) return null;
  if (sr.includes("nurse")) return "nurse";
  if (sr.includes("tech")) return "technician";
  if (sr.includes("surgeon") || sr.includes("doctor")) return "surgeon";
  return "other";
}

export function resolveCurrentMajorPhase(input: {
  status: string;
  procedurePhase: string;
}): SurgeryOsMajorPhase {
  if (input.status === "completed" || input.procedurePhase === "completed") return "complete";
  if (input.procedurePhase === "recovery") return "recovery";
  if (input.procedurePhase === "implantation") return "implantation";
  if (input.procedurePhase === "site_making") return "site_creation";
  if (input.procedurePhase === "break") return "break";
  if (input.procedurePhase === "extraction" || input.procedurePhase === "extraction_paused")
    return "extraction";
  if (input.procedurePhase === "anaesthetic") return "anaesthetic";
  if (input.status === "scheduled") return "scheduled";
  return "pre_op";
}

export function canTransitionSurgeryMajorPhase(
  from: SurgeryOsMajorPhase,
  to: SurgeryOsMajorPhase
): boolean {
  if (from === to) return true;
  return PHASE_TRANSITIONS[from].includes(to);
}

export function assertSurgeryMajorPhaseTransition(
  from: SurgeryOsMajorPhase,
  to: SurgeryOsMajorPhase
): void {
  if (!canTransitionSurgeryMajorPhase(from, to)) {
    throw new Error(`Invalid surgery phase transition: ${from} → ${to}.`);
  }
}

export function nextMajorPhase(current: SurgeryOsMajorPhase): SurgeryOsMajorPhase | null {
  const next = PHASE_TRANSITIONS[current];
  return next.length ? next[0] : null;
}

export function majorPhaseToSurgeryPatch(phase: SurgeryOsMajorPhase): {
  status: string;
  procedurePhase: string;
  liveStatus: string;
  setActualStart?: boolean;
  setActualEnd?: boolean;
} {
  switch (phase) {
    case "scheduled":
      return { status: "scheduled", procedurePhase: "pre_op", liveStatus: "waiting" };
    case "pre_op":
      return { status: "pre_op", procedurePhase: "pre_op", liveStatus: "waiting" };
    case "anaesthetic":
      return {
        status: "in_progress",
        procedurePhase: "anaesthetic",
        liveStatus: "active",
        setActualStart: true,
      };
    case "extraction":
      return { status: "in_progress", procedurePhase: "extraction", liveStatus: "active" };
    case "break":
      return { status: "paused", procedurePhase: "break", liveStatus: "break" };
    case "site_creation":
      return { status: "in_progress", procedurePhase: "site_making", liveStatus: "active" };
    case "implantation":
      return { status: "in_progress", procedurePhase: "implantation", liveStatus: "active" };
    case "recovery":
      return { status: "in_progress", procedurePhase: "recovery", liveStatus: "active" };
    case "complete":
      return {
        status: "completed",
        procedurePhase: "completed",
        liveStatus: "completed",
        setActualEnd: true,
      };
  }
}

export function eventKindToSurgeryPatch(eventKind: SurgeryOsProcedureEventKind): {
  status?: string;
  procedurePhase?: string;
  liveStatus?: string;
  setActualStart?: boolean;
  setActualEnd?: boolean;
} | null {
  switch (eventKind) {
    case "patient_arrived":
      return { status: "pre_op", procedurePhase: "patient_arrived", liveStatus: "waiting" };
    case "design_approved":
      return { procedurePhase: "design" };
    case "anaesthetic_complete":
      return { procedurePhase: "anaesthetic", liveStatus: "active", setActualStart: true };
    case "extraction_started":
      return {
        status: "in_progress",
        procedurePhase: "extraction",
        liveStatus: "active",
        setActualStart: true,
      };
    case "extraction_paused":
      return { status: "paused", procedurePhase: "extraction_paused", liveStatus: "break" };
    case "extraction_resumed":
      return { status: "in_progress", procedurePhase: "extraction", liveStatus: "active" };
    case "break":
    case "break_started":
      return { status: "paused", procedurePhase: "break", liveStatus: "break" };
    case "break_ended":
      return { status: "in_progress", liveStatus: "active" };
    case "site_making_started":
      return { status: "in_progress", procedurePhase: "site_making", liveStatus: "active" };
    case "implantation_started":
      return { status: "in_progress", procedurePhase: "implantation", liveStatus: "active" };
    case "procedure_completed":
      return {
        status: "completed",
        procedurePhase: "completed",
        liveStatus: "completed",
        setActualEnd: true,
      };
    default:
      return null;
  }
}

const TECHNICIAN_NOTE_KINDS: readonly SurgeryOsNoteKind[] = ["graft_issue", "general"];

export function surgeryOsGraftActionAllowed(
  ctx: SurgeryOsMutationContext,
  action: SurgeryOsAction
): boolean {
  if (ctx.viewerRole === "admin" || ctx.viewerRole === "theatre_manager") return true;
  if (ctx.viewerRole === "surgeon" || ctx.staffRoleCategory === "surgeon") return true;

  switch (action) {
    case "add_extraction_count":
    case "add_implantation_count":
      return ctx.staffRoleCategory === "nurse";
    case "log_discarded_grafts":
      return ctx.staffRoleCategory === "nurse" || ctx.staffRoleCategory === "technician";
    case "enter_tray_count":
      return ctx.staffRoleCategory === "technician";
    case "confirm_tray_count":
      return ctx.staffRoleCategory === "nurse";
    case "correct_graft_count":
    case "reconcile_grafts":
      return false;
    default:
      return false;
  }
}

export function surgeryOsActionAllowed(
  ctx: SurgeryOsMutationContext,
  action: SurgeryOsAction
): boolean {
  const { viewerRole, staffRoleCategory } = ctx;

  if (viewerRole === "admin" || viewerRole === "theatre_manager") return true;

  if (
    action === "add_extraction_count" ||
    action === "add_implantation_count" ||
    action === "enter_tray_count" ||
    action === "confirm_tray_count" ||
    action === "log_discarded_grafts" ||
    action === "correct_graft_count" ||
    action === "reconcile_grafts"
  ) {
    return surgeryOsGraftActionAllowed(ctx, action);
  }

  switch (action) {
    case "create_from_booking":
      return viewerRole === "coordinator" || staffRoleCategory === "nurse";
    case "transition_phase":
      return viewerRole === "surgeon" || staffRoleCategory === "surgeon";
    case "log_event":
      return (
        viewerRole === "surgeon" || staffRoleCategory === "surgeon" || staffRoleCategory === "nurse"
      );
    case "add_note":
      return (
        viewerRole === "surgeon" ||
        staffRoleCategory === "surgeon" ||
        staffRoleCategory === "nurse" ||
        staffRoleCategory === "technician"
      );
    case "update_team_status":
      return (
        viewerRole === "surgeon" || staffRoleCategory === "surgeon" || staffRoleCategory === "nurse"
      );
    default:
      return false;
  }
}

export function surgeryOsNoteKindAllowed(
  ctx: SurgeryOsMutationContext,
  noteKind: SurgeryOsNoteKind
): boolean {
  if (!surgeryOsActionAllowed(ctx, "add_note")) return false;
  if (
    ctx.viewerRole === "admin" ||
    ctx.viewerRole === "theatre_manager" ||
    ctx.viewerRole === "surgeon"
  )
    return true;
  if (ctx.staffRoleCategory === "surgeon" || ctx.staffRoleCategory === "nurse") return true;
  if (ctx.staffRoleCategory === "technician") return TECHNICIAN_NOTE_KINDS.includes(noteKind);
  return false;
}

export function surgeryOsTeamStatusUpdateAllowed(
  ctx: SurgeryOsMutationContext,
  assignmentFiUserId: string
): boolean {
  if (
    ctx.staffRoleCategory === "technician" &&
    ctx.actorFiUserId &&
    ctx.actorFiUserId === assignmentFiUserId
  ) {
    return true;
  }
  if (!surgeryOsActionAllowed(ctx, "update_team_status")) return false;
  if (ctx.viewerRole === "admin" || ctx.viewerRole === "theatre_manager") return true;
  return (
    ctx.viewerRole === "surgeon" ||
    ctx.staffRoleCategory === "surgeon" ||
    ctx.staffRoleCategory === "nurse"
  );
}

export function canTransitionTeamAssignmentStatus(
  from: SurgeryOsAssignmentStatus,
  to: SurgeryOsAssignmentStatus
): boolean {
  if (from === to) return true;
  const allowed: Record<SurgeryOsAssignmentStatus, readonly SurgeryOsAssignmentStatus[]> = {
    assigned: ["confirmed", "checked_in", "active", "unavailable"],
    confirmed: ["checked_in", "active", "unavailable", "assigned"],
    checked_in: ["active", "break", "unavailable", "completed"],
    active: ["break", "unavailable", "completed"],
    break: ["active", "unavailable", "completed"],
    unavailable: ["assigned", "checked_in", "active"],
    completed: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function assertTeamAssignmentStatusTransition(
  from: SurgeryOsAssignmentStatus,
  to: SurgeryOsAssignmentStatus
): void {
  if (!canTransitionTeamAssignmentStatus(from, to)) {
    throw new Error(`Invalid team assignment status transition: ${from} → ${to}.`);
  }
}

export function parseTargetGraftsFromEstimate(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;
  const match = raw.match(/(\d[\d,]*)/);
  if (!match) return null;
  const n = Number.parseInt(match[1].replace(/,/g, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function buildProcedureEventAuditMetadata(input: {
  sourceAction: SurgeryOsAction;
  previousStatus: string;
  newStatus: string;
  previousPhase: string;
  newPhase: string;
  previousLiveStatus: string;
  newLiveStatus: string;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    source_action: input.sourceAction,
    previous_status: input.previousStatus,
    new_status: input.newStatus,
    previous_procedure_phase: input.previousPhase,
    new_procedure_phase: input.newPhase,
    previous_live_status: input.previousLiveStatus,
    new_live_status: input.newLiveStatus,
    ...input.extra,
  };
}

export const SURGERY_OS_LOGGABLE_EVENT_KINDS = [
  "patient_arrived",
  "design_approved",
  "anaesthetic_complete",
  "extraction_started",
  "extraction_paused",
  "extraction_resumed",
  "break_started",
  "break_ended",
  "site_making_started",
  "implantation_started",
  "procedure_completed",
  "custom",
] as const;
export type SurgeryOsLoggableEventKind = (typeof SURGERY_OS_LOGGABLE_EVENT_KINDS)[number];
