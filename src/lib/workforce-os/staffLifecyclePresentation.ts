import type { StaffEmploymentStatus, StaffMemberLifecycleRow } from "./staffLifecycleTypes";
import {
  OFFBOARDING_CENTRE_EMPLOYMENT_STATUSES,
  STAFF_EMPLOYMENT_STATUSES,
} from "./staffLifecycleTypes";

/** System-only statuses — never shown in admin employment dropdowns. */
export const ADMIN_HIDDEN_EMPLOYMENT_STATUSES: ReadonlySet<StaffEmploymentStatus> = new Set([
  "merged",
  "contract_expired",
]);

/** Statuses available in Manage Employment (excludes offboarding + hidden). */
export const MANAGE_EMPLOYMENT_VISIBLE_STATUSES = [
  "active",
  "inactive",
  "on_leave",
  "pending_onboarding",
  "suspended",
] as const satisfies readonly StaffEmploymentStatus[];

export const MANAGE_EMPLOYMENT_STATUS_LABELS: Record<
  (typeof MANAGE_EMPLOYMENT_VISIBLE_STATUSES)[number],
  string
> = {
  active: "Active",
  inactive: "Inactive",
  on_leave: "On leave",
  pending_onboarding: "Pending onboarding",
  suspended: "Suspended",
};

export const OFFBOARDING_DEPARTURE_TYPES = [
  { value: "terminated", label: "Terminated" },
  { value: "resigned", label: "Resigned" },
  { value: "contract_ended", label: "Contract Ended" },
] as const satisfies ReadonlyArray<{
  value: StaffEmploymentStatus;
  label: string;
}>;

export type StaffLifecycleOperationalState =
  | "pending_onboarding"
  | "active"
  | "temporarily_unavailable"
  | "departed"
  | "archived";

export const STAFF_LIFECYCLE_OPERATIONAL_STATES: ReadonlyArray<{
  id: StaffLifecycleOperationalState;
  label: string;
  description: string;
}> = [
  {
    id: "pending_onboarding",
    label: "Pending Onboarding",
    description:
      "New hire completing onboarding. Not yet available for scheduling or operational duties.",
  },
  {
    id: "active",
    label: "Active",
    description:
      "Available for scheduling, roster assignment, and day-to-day operational systems.",
  },
  {
    id: "temporarily_unavailable",
    label: "Temporarily Unavailable",
    description:
      "Employment continues but scheduling and operations are paused — for leave, suspension, or temporary inactivity.",
  },
  {
    id: "departed",
    label: "Departed",
    description:
      "Employment has ended. System access is revoked. Training, audit, and compliance history are preserved.",
  },
  {
    id: "archived",
    label: "Archived",
    description:
      "Removed from the active staff directory. Employment status is unchanged and the record can be restored.",
  },
];

export function resolveStaffLifecycleOperationalState(
  row: Pick<StaffMemberLifecycleRow, "employment_status" | "archived_at">
): StaffLifecycleOperationalState {
  if (row.archived_at) return "archived";

  switch (row.employment_status) {
    case "pending_onboarding":
      return "pending_onboarding";
    case "active":
      return "active";
    case "inactive":
    case "on_leave":
    case "suspended":
      return "temporarily_unavailable";
    case "terminated":
    case "resigned":
    case "contract_ended":
    case "contract_expired":
    case "merged":
      return "departed";
    default:
      return "active";
  }
}

export function resolveStaffLifecycleOperationalPresentation(
  row: Pick<StaffMemberLifecycleRow, "employment_status" | "archived_at">
): (typeof STAFF_LIFECYCLE_OPERATIONAL_STATES)[number] {
  const currentId = resolveStaffLifecycleOperationalState(row);
  return (
    STAFF_LIFECYCLE_OPERATIONAL_STATES.find((state) => state.id === currentId) ??
    STAFF_LIFECYCLE_OPERATIONAL_STATES[1]!
  );
}
