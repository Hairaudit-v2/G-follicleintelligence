/**
 * FI-UX-REBUILD-1 S4.2 — Canonical Pipeline presentation types (pure).
 * Client-safe boundary: no DB rows, no HubSpot payloads, no React.
 */

import type {
  PipelineStaffColumnId,
  PipelineUrgencyFlag,
} from "@/src/lib/crm/pipelineStaffModel";

export type { PipelineStaffColumnId, PipelineUrgencyFlag };

// ---------------------------------------------------------------------------
// Structural enrichment inputs (not full CRM/DB rows)
// ---------------------------------------------------------------------------

export type PipelineTaskInput = {
  taskId: string;
  leadId: string;
  title: string;
  dueAtIso: string | null;
  completedAtIso: string | null;
  status: string;
  assigneeUserId: string | null;
  assigneeDisplayName?: string | null;
};

export type PipelineCommunicationHintInput = {
  communicationId: string;
  leadId: string;
  nextFollowUpAtIso: string | null;
  channel?: string | null;
  outcome?: string | null;
};

export type PipelineConsultationInput = {
  bookingId: string;
  consultationId?: string | null;
  startAtIso: string;
  status: string;
  cancelledAtIso?: string | null;
};

export type PipelineReminderInput = {
  reminderId: string;
  leadId: string;
  scheduledAtIso: string;
  status: string;
  label?: string | null;
};

export type PipelinePresentationPermissions = {
  canMutate: boolean;
  canConvert: boolean;
  canBookConsultation?: boolean;
};

// ---------------------------------------------------------------------------
// Card / column / presentation
// ---------------------------------------------------------------------------

export type PipelineUrgencyLevel = "blocker" | "action_needed" | "information";

export type PipelineNextActionKind =
  | "task"
  | "task_no_date"
  | "communication_hint"
  | "appointment"
  | "reminder"
  | "none";

export type PipelineConsultationState =
  | "none"
  | "booked"
  | "due_today"
  | "completed"
  | "cancelled"
  | "no_show";

export type PipelineBlockerSeverity = "blocker" | "action_needed" | "information";

export type PipelineCardActionId =
  | "contact"
  | "log_outcome"
  | "schedule_follow_up"
  | "complete_follow_up"
  | "assign_owner"
  | "move_stage"
  | "book_consultation"
  | "mark_lost"
  | "reopen"
  | "convert"
  | "open_lead"
  | "open_patient";

export type PipelineCardBlocker = {
  id: string;
  kind: string;
  label: string;
  severity: PipelineBlockerSeverity;
  href: string | null;
};

export type PipelineLeadCard = {
  leadId: string;
  person: {
    personId: string | null;
    displayName: string;
    patientId: string | null;
  };
  contact: {
    hasEmail: boolean;
    hasPhone: boolean;
    preferredChannel: "phone" | "email" | "sms" | null;
  };
  owner: {
    userId: string | null;
    displayName: string | null;
    unassigned: boolean;
  };
  source: {
    key: string | null;
    label: string;
    externalSystem: string | null;
  };
  stage: {
    backendStageId: string | null;
    backendSlug: string | null;
    backendLabel: string | null;
    staffColumnId: PipelineStaffColumnId;
    staffColumnLabel: string;
    daysInStage: number | null;
  };
  lifecycle: {
    state: "active" | "holding" | "converted" | "lost" | "archived";
    warningCodes: string[];
  };
  urgency: {
    flags: PipelineUrgencyFlag[];
    highest: PipelineUrgencyLevel | null;
    primaryLabel: string | null;
  };
  nextAction: {
    kind: PipelineNextActionKind;
    label: string;
    dueAtIso: string | null;
    overdue: boolean;
    sourceId: string | null;
  };
  followUps: {
    openCount: number;
    overdueCount: number;
    dueTodayCount: number;
    nextTaskId: string | null;
  };
  consultation: {
    state: PipelineConsultationState;
    nextBookingId: string | null;
    nextBookingAtIso: string | null;
    lastConsultationId: string | null;
  };
  conversion: {
    state: "active" | "converted" | "lost" | "archived";
    convertedAtIso: string | null;
    patientId: string | null;
    lostReason: string | null;
  };
  /**
   * Canonical lead timestamps for ops sort/filter (from fi_crm_leads + enrichment).
   * Never use presentation generatedAt as activity.
   */
  timestamps: {
    createdAtIso: string | null;
    updatedAtIso: string | null;
    /** max(updated_at, lastActivity, comms, tasks, consults) — not passive refresh. */
    meaningfulActivityAtIso: string | null;
    stageEnteredAtIso: string | null;
    /** Lost timestamp when known (metadata or stage enter for closed_lost). */
    lostAtIso: string | null;
  };
  score: {
    value: number | null;
    highValue: boolean;
  };
  blockers: PipelineCardBlocker[];
  primaryAction: PipelineCardActionId | null;
  secondaryActions: PipelineCardActionId[];
  links: {
    lead: string;
    patient: string | null;
    calendar: string;
    consultation: string | null;
  };
};

export type PipelinePresentationColumn = {
  id: PipelineStaffColumnId;
  label: string;
  kind: "active" | "holding" | "terminal_won" | "terminal_lost";
  cards: PipelineLeadCard[];
  count: number;
  collapsedByDefault: boolean;
};

export type PipelineFollowUpItem = {
  taskId: string;
  leadId: string;
  personDisplayName: string;
  title: string;
  dueAtIso: string | null;
  assignee: { userId: string | null; displayName: string | null };
  status: string;
  contact: { hasEmail: boolean; hasPhone: boolean };
  allowedActions: PipelineCardActionId[];
  links: { lead: string };
};

export type PipelineFollowUpView = {
  buckets: {
    overdue: PipelineFollowUpItem[];
    dueToday: PipelineFollowUpItem[];
    upcoming: PipelineFollowUpItem[];
    noDueDate: PipelineFollowUpItem[];
    completed: PipelineFollowUpItem[];
  };
  summary: {
    overdue: number;
    dueToday: number;
    upcoming: number;
    noDueDate: number;
  };
};

export type PipelineFilterOption = {
  id: string;
  label: string;
  count: number;
};

export type PipelineFilterOptions = {
  staffColumns: PipelineFilterOption[];
  backendStages: PipelineFilterOption[];
  owners: PipelineFilterOption[];
  sources: PipelineFilterOption[];
  urgency: PipelineFilterOption[];
  lifecycle: PipelineFilterOption[];
  assignedToMe: boolean;
  unassigned: boolean;
};

export type PipelineGlobalAction = {
  id: "new_enquiry" | "open_follow_ups" | "open_board";
  label: string;
  href: string | null;
};

export type PipelinePresentationSummary = {
  totalLeads: number;
  active: number;
  holding: number;
  converted: number;
  lost: number;
  archived: number;
  unassigned: number;
  overdueFollowUps: number;
  dueTodayFollowUps: number;
  untouchedNew: number;
  byColumn: Record<PipelineStaffColumnId, number>;
};

export type PipelinePresentationDiagnostics = {
  sourceLeadCount: number;
  visibleLeadCount: number;
  hiddenLeadCount: number;
  duplicateLeadIds: string[];
  orphanTaskIds: string[];
  unknownStageLeadIds: string[];
  conversionInconsistencies: Array<{ leadId: string; kind: string }>;
};

export type PipelinePresentation = {
  generatedAt: string;
  loadTier: "shell" | "full";
  columns: PipelinePresentationColumn[];
  followUps: PipelineFollowUpView;
  summary: PipelinePresentationSummary;
  filters: PipelineFilterOptions;
  actions: PipelineGlobalAction[];
  diagnostics: PipelinePresentationDiagnostics;
};
