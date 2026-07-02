/**
 * FI-UX-REBUILD D6E — operational presence types.
 * Not payroll, not surveillance — role and workflow coverage intelligence.
 */

export type PresenceActorKind = "patient" | "staff" | "role" | "room" | "clinic";

export type PresenceState =
  | "present"
  | "active"
  | "expected"
  | "missing"
  | "unknown"
  | "unattended"
  | "inactive";

export type PresenceSignalKind =
  | "patient_arrival_intent"
  | "patient_checked_in"
  | "staff_active_session"
  | "staff_recent_action"
  | "role_covered"
  | "role_uncovered"
  | "clinic_unattended"
  | "surgery_team_incomplete"
  | "consultation_ready"
  | "doctor_missing"
  | "reception_missing";

export type PresenceConfidence = "high" | "medium" | "low";

export type PresenceSnapshot = {
  tenantId: string;
  actorKind: PresenceActorKind;
  actorId?: string;
  role?: string;
  state: PresenceState;
  signalKind: PresenceSignalKind;
  confidence: PresenceConfidence;
  observedAt: string;
  expiresAt?: string;
  source: string;
  /** Role-safe label — never patient names in generic summaries. */
  safeLabel: string;
  reasonLabel: string;
};

export type PresenceSummaryChip = {
  id: string;
  label: string;
  tone: "neutral" | "watch" | "attention";
};

export type PresenceOperationalStatus = {
  headline: string;
  subline?: string;
  chips: PresenceSummaryChip[];
  tone: "active" | "watch" | "attention" | "unknown";
};

export type PresenceSummary = {
  tenantId: string;
  snapshots: PresenceSnapshot[];
  operationalStatus: PresenceOperationalStatus;
  /** Safe escalation hints for Today priority — no PHI. */
  escalationHints: string[];
  generatedAt: string;
};

export type PresenceEngineContext = {
  tenantId: string;
  nowIso?: string;
  profileKey?: string;
  viewerRole?: string;
  /** When true, clinic appears within typical operating window. */
  withinOperatingWindow?: boolean;
  /** Weak signal: distinct staff assigned to today's bookings. */
  staffOnDutyCount?: number;
  /** Viewer has an active workspace session (profile-derived). */
  viewerSessionActive?: boolean;
};
