/**
 * FI-UX-REBUILD D6E — presence source audit (code-as-documentation).
 * Maps operational signals to presence derivability. No duplicate attendance system.
 */

export type PresenceSourceStatus =
  | "implemented"
  | "derived"
  | "future"
  | "excluded";

export type PresenceSourceEntry = {
  key: string;
  label: string;
  status: PresenceSourceStatus;
  source: string;
  derives: readonly string[];
  notes?: string;
};

/** PRESENCE SOURCE MAP — existing operational signals → presence snapshots. */
export const PRESENCE_SOURCE_MAP: readonly PresenceSourceEntry[] = [
  {
    key: "staff_pin_session",
    label: "Staff PIN session / login activity",
    status: "future",
    source: "fi_workforce_time_punches + staff session telemetry",
    derives: ["staff_active_session", "role_covered"],
    notes: "WorkforceOS time clock exists but is not wired to Today presence in D6E.",
  },
  {
    key: "reception_check_in",
    label: "Reception check-in actions",
    status: "implemented",
    source: "receptionBoardFlowAction → fi_bookings.booking_status",
    derives: ["staff_recent_action", "patient_checked_in"],
  },
  {
    key: "patient_qr_arrival",
    label: "Patient QR arrival intent",
    status: "implemented",
    source: "fi_bookings.metadata.fi_arrival_intent_at",
    derives: ["patient_arrival_intent"],
  },
  {
    key: "reception_board_status",
    label: "Reception board booking_status=arrived/waiting",
    status: "implemented",
    source: "TenantOperationalDashboard.receptionBoard.cards",
    derives: ["patient_checked_in", "consultation_ready"],
  },
  {
    key: "workspace_profile_session",
    label: "Workspace profile / active user session",
    status: "derived",
    source: "loadWorkspaceProfileKeyForViewer + viewer session",
    derives: ["role_covered", "staff_active_session"],
    notes: "Viewer profile implies their role may be covered — low confidence for others.",
  },
  {
    key: "staff_compliance_readiness",
    label: "Staff compliance / readiness data",
    status: "derived",
    source: "fi_staff_compliance_alerts → entity attention",
    derives: ["surgery_team_incomplete", "role_uncovered"],
  },
  {
    key: "surgery_readiness_board",
    label: "Surgery readiness / staffing board",
    status: "derived",
    source: "entity attention surgery_readiness + actionCentre",
    derives: ["surgery_team_incomplete"],
  },
  {
    key: "appointment_phase",
    label: "Appointment phase / status changes",
    status: "implemented",
    source: "fi_bookings.status + metadata.fi_reception_flow_phase",
    derives: ["consultation_ready", "patient_checked_in"],
  },
  {
    key: "staff_on_duty_bookings",
    label: "Staff assigned to today's bookings",
    status: "derived",
    source: "TenantOperationalDashboard.quickStats.staffOnDutyToday",
    derives: ["role_covered"],
    notes: "Booking assignment ≠ clock-in; low confidence only.",
  },
  {
    key: "door_entry",
    label: "Door entry / access control",
    status: "future",
    source: "External integration (not available)",
    derives: ["staff_active_session", "patient_checked_in"],
  },
  {
    key: "kiosk_device",
    label: "Kiosk device check-in",
    status: "future",
    source: "Dedicated kiosk endpoint (not available)",
    derives: ["patient_checked_in", "staff_recent_action"],
  },
  {
    key: "room_status",
    label: "Room occupancy status",
    status: "future",
    source: "Room management integration (not available)",
    derives: ["consultation_ready"],
  },
  {
    key: "google_calendar",
    label: "Google Calendar presence",
    status: "future",
    source: "Calendar subsystem — intentionally excluded from D6E",
    derives: [],
    notes: "Calendar remains protected; not used for presence.",
  },
  {
    key: "roster_clock_in",
    label: "Roster clock-in / payroll timesheet",
    status: "excluded",
    source: "fi_workforce_time_punches payroll path",
    derives: [],
    notes: "Not payroll or timesheet replacement — excluded from operational presence.",
  },
  {
    key: "payroll_hours",
    label: "Payroll / working-hours logic",
    status: "excluded",
    source: "HR/payroll systems",
    derives: [],
    notes: "Intentionally excluded — not operational presence intelligence.",
  },
  {
    key: "staff_employment_source",
    label: "Staff employment source-of-truth",
    status: "excluded",
    source: "HR employment records",
    derives: [],
    notes: "Protected — not used for live presence.",
  },
];

export function getPresenceSourcesByStatus(
  status: PresenceSourceStatus
): readonly PresenceSourceEntry[] {
  return PRESENCE_SOURCE_MAP.filter((e) => e.status === status);
}

export function getImplementedPresenceSources(): readonly PresenceSourceEntry[] {
  return PRESENCE_SOURCE_MAP.filter(
    (e) => e.status === "implemented" || e.status === "derived"
  );
}

export function isPresenceSourceExcluded(key: string): boolean {
  const entry = PRESENCE_SOURCE_MAP.find((e) => e.key === key);
  return entry?.status === "excluded";
}
