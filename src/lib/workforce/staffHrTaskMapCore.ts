/**
 * WorkforceOS — HR task map for clinic admins.
 * Pure module: defines where to complete each staff-related HR task and what it changes.
 */

import {
  buildOnboardingCentreHrefForTenant,
  buildStaffAccessCentreHrefForTenant,
  buildStaffDirectoryHref,
  buildStaffEntitlementsHref,
  buildStaffIdentityAuditHref,
  buildStaffProfileHref,
  buildWorkforceCommandCentreHref,
} from "@/src/lib/workforce/staffLifecycleCopy";
import { buildStaffStandardHoursSetupIndexHref } from "@/src/lib/workforce-os/staffStandardHoursRoutes";

export type StaffHrTaskCategory =
  | "access"
  | "onboarding"
  | "employment"
  | "leave_availability"
  | "roster"
  | "training_readiness"
  | "offboarding"
  | "audit";

export type StaffHrTaskImpact = {
  lifecycle: string;
  roster: string;
  access: string;
  readiness: string;
  audit: string;
};

export type StaffHrTaskRouteTarget = {
  href: string;
  actionLabel?: string;
  serverAction?: string;
};

export type StaffHrTaskDefinition = {
  id: string;
  label: string;
  description: string;
  category: StaffHrTaskCategory;
  entryPoint: string;
  route: StaffHrTaskRouteTarget;
  requiredPermission: string;
  doesNotChange: string[];
  impact: StaffHrTaskImpact;
};

export const STAFF_HR_TASK_CATEGORY_LABELS: Record<StaffHrTaskCategory, string> = {
  access: "Access",
  onboarding: "Onboarding",
  employment: "Employment",
  leave_availability: "Leave & Availability",
  roster: "Roster",
  training_readiness: "Training & Readiness",
  offboarding: "Offboarding",
  audit: "Audit",
};

function profileEmploymentHref(tenantId: string, staffId?: string): string {
  if (staffId) return `${buildStaffProfileHref(tenantId, staffId)}?action=manage_employment`;
  return buildStaffDirectoryHref(tenantId);
}

function profileMaternityLeaveHref(tenantId: string, staffId?: string): string {
  if (staffId) return `${buildStaffProfileHref(tenantId, staffId)}?action=set_maternity_leave`;
  return profileEmploymentHref(tenantId);
}

function profileArchiveHref(tenantId: string, staffId?: string): string {
  if (staffId) return `${buildStaffProfileHref(tenantId, staffId)}?action=archive`;
  return buildStaffDirectoryHref(tenantId);
}

export function buildStaffHrTaskMap(tenantId: string, staffId?: string): StaffHrTaskDefinition[] {
  const tid = tenantId.trim();
  const hrTaskMapHref = `${buildWorkforceCommandCentreHref(tid)}/hr-task-map`;
  const offboardingHref = `/fi-admin/${tid}/hr-os/offboarding`;
  const readinessHref = `/fi-admin/${tid}/hr/staff-readiness`;
  const standardHoursHref = staffId
    ? `${buildStaffStandardHoursSetupIndexHref(tid)}/${staffId}`
    : buildStaffStandardHoursSetupIndexHref(tid);

  return [
    {
      id: "add_new_staff",
      label: "Add new staff member",
      description: "Create a staff profile and start onboarding for a new hire.",
      category: "onboarding",
      entryPoint: "HR OS > Onboarding Centre",
      route: { href: buildOnboardingCentreHrefForTenant(tid), actionLabel: "Open Onboarding Centre" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not provision login until invite is sent separately."],
      impact: {
        lifecycle: "Creates fi_staff_members with pending_onboarding status.",
        roster: "Not roster-eligible until onboarding and hours are complete.",
        access: "No login until invite is sent.",
        readiness: "Onboarding checklist starts incomplete.",
        audit: "Creation event recorded in staff audit timeline.",
      },
    },
    {
      id: "edit_staff_profile",
      label: "Edit staff profile",
      description: "Update name, contact, role, timezone, and local notes.",
      category: "employment",
      entryPoint: "Staff Profile > Edit Staff",
      route: {
        href: staffId ? buildStaffProfileHref(tid, staffId) : buildStaffDirectoryHref(tid),
        actionLabel: "Open staff profile",
      },
      requiredPermission: "hr_manager",
      doesNotChange: ["IIOHR-managed identity fields remain read-only."],
      impact: {
        lifecycle: "Profile metadata updated; employment status unchanged.",
        roster: "No automatic roster change.",
        access: "No automatic access change.",
        readiness: "No automatic readiness change.",
        audit: "Profile update recorded in audit timeline.",
      },
    },
    {
      id: "send_login_invite",
      label: "Send login invite",
      description: "Provision staff login access for an active team member.",
      category: "access",
      entryPoint: "Staff Access Centre or Staff Profile > Actions",
      route: {
        href: buildStaffAccessCentreHrefForTenant(tid),
        actionLabel: "Open Staff Access",
        serverAction: "sendStaffLoginInviteAction",
      },
      requiredPermission: "admin",
      doesNotChange: ["Does not assign module entitlements or training."],
      impact: {
        lifecycle: "Employment status unchanged.",
        roster: "No roster change.",
        access: "Creates auth invite; PIN setup follows acceptance.",
        readiness: "No readiness change.",
        audit: "Invite creation recorded.",
      },
    },
    {
      id: "resend_login_invite",
      label: "Resend login invite",
      description: "Send a fresh login invite when the previous link expired or was not received.",
      category: "access",
      entryPoint: "Staff Access Centre or Staff Profile > Actions",
      route: {
        href: buildStaffAccessCentreHrefForTenant(tid),
        actionLabel: "Open Staff Access",
        serverAction: "resendStaffLoginInviteAction",
      },
      requiredPermission: "admin",
      doesNotChange: ["Does not reset PIN automatically."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Unchanged.",
        access: "New invite link issued.",
        readiness: "Unchanged.",
        audit: "Resend recorded.",
      },
    },
    {
      id: "provision_staff_access",
      label: "Provision staff access",
      description: "Complete login invite, PIN setup, and tenant link for operational sign-in.",
      category: "access",
      entryPoint: "Staff Access Centre",
      route: { href: buildStaffAccessCentreHrefForTenant(tid), actionLabel: "Open Staff Access" },
      requiredPermission: "admin",
      doesNotChange: ["Module entitlements configured separately in Settings."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Unchanged.",
        access: "Auth user linked; PIN can be set.",
        readiness: "Onboarding checklist account/PIN flags may complete.",
        audit: "Access provisioning events recorded.",
      },
    },
    {
      id: "set_role_permissions",
      label: "Set staff role / permissions",
      description: "Configure FI role, module entitlements, and field-level grants.",
      category: "access",
      entryPoint: "Settings > Staff Access or Staff > Role Review",
      route: { href: buildStaffEntitlementsHref(tid), actionLabel: "Open entitlements" },
      requiredPermission: "admin",
      doesNotChange: ["Does not send login invites."],
      impact: {
        lifecycle: "Role code may update on profile.",
        roster: "Clinical assignment eligibility may change.",
        access: "Module and field grants updated.",
        readiness: "Permissions checklist item may complete.",
        audit: "Entitlement changes audited in settings.",
      },
    },
    {
      id: "assign_training",
      label: "Assign training",
      description: "Mark training complete or route staff through Onboarding Centre training checklist.",
      category: "training_readiness",
      entryPoint: "Onboarding Centre or Staff Profile > Actions",
      route: { href: buildOnboardingCentreHrefForTenant(tid), actionLabel: "Open Onboarding Centre" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not change employment or roster hours."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Readiness may unlock roster assignment.",
        access: "Unchanged.",
        readiness: "Training checklist and readiness score updated.",
        audit: "Training completion recorded.",
      },
    },
    {
      id: "review_readiness",
      label: "Review readiness",
      description: "Inspect readiness score, credentials, and clinical eligibility blockers.",
      category: "training_readiness",
      entryPoint: "HR > Staff Readiness or Staff Twin",
      route: { href: readinessHref, actionLabel: "Open readiness dashboard" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Read-only review unless follow-up actions taken."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Informs roster assignment decisions.",
        access: "Unchanged.",
        readiness: "No automatic change.",
        audit: "No mutation.",
      },
    },
    {
      id: "set_standard_hours",
      label: "Set standard hours",
      description: "Configure weekly standard hours used for roster generation.",
      category: "roster",
      entryPoint: "WorkforceOS > Roster > Standard Hours",
      route: { href: standardHoursHref, actionLabel: "Open standard hours" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not create shifts until roster is generated."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Enables roster generation for eligible staff.",
        access: "Unchanged.",
        readiness: "Clears missing-hours blocker when configured.",
        audit: "Hours save recorded in roster audit.",
      },
    },
    {
      id: "add_leave_period",
      label: "Add leave / unavailable period",
      description: "Block scheduling for a date range without ending employment.",
      category: "leave_availability",
      entryPoint: "Staff Profile > Manage Employment or Roster availability",
      route: {
        href: profileEmploymentHref(tid, staffId),
        actionLabel: "Manage employment",
        serverAction: "createAvailabilityBlockAction",
      },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not delete historical shifts."],
      impact: {
        lifecycle: "Employment may change to on_leave for long periods.",
        roster: "Excluded from generation when period fully blocks roster window.",
        access: "Login unchanged unless admin disables access.",
        readiness: "Historical readiness preserved.",
        audit: "Leave block recorded with reason.",
      },
    },
    {
      id: "set_maternity_leave",
      label: "Set maternity leave",
      description:
        "Temporarily remove a staff member from roster generation while preserving employment, access history, and staff profile.",
      category: "leave_availability",
      entryPoint: "Staff Profile > Manage Employment > Set maternity leave",
      route: {
        href: profileMaternityLeaveHref(tid, staffId),
        actionLabel: "Set maternity leave",
        serverAction: "setStaffMaternityLeaveAction",
      },
      requiredPermission: "hr_manager",
      doesNotChange: [
        "Does not archive or terminate the staff member.",
        "Does not delete historical shifts.",
        "Does not remove access unless admin chooses to disable login.",
      ],
      impact: {
        lifecycle: "Employment retained; HR status becomes on_leave.",
        roster: "Excluded from roster generation and missing standard-hours validation for the leave period.",
        access: "Login can remain active unless admin disables access.",
        readiness: "Readiness remains historical but staff is not considered roster-required.",
        audit: "Leave period recorded with reason maternity_leave.",
      },
    },
    {
      id: "suspend_staff",
      label: "Suspend staff access",
      description: "Immediately block sign-in while preserving the staff profile.",
      category: "access",
      entryPoint: "Staff Access Centre",
      route: {
        href: buildStaffAccessCentreHrefForTenant(tid),
        actionLabel: "Open Staff Access",
        serverAction: "suspendStaffLoginAccessAction",
      },
      requiredPermission: "admin",
      doesNotChange: ["Does not terminate employment."],
      impact: {
        lifecycle: "Employment may become suspended.",
        roster: "Excluded from roster pools.",
        access: "Login and PIN disabled.",
        readiness: "Unchanged.",
        audit: "Suspension recorded.",
      },
    },
    {
      id: "mark_inactive",
      label: "Mark inactive",
      description: "Deactivate operational access without offboarding.",
      category: "employment",
      entryPoint: "Staff Profile > Manage Employment",
      route: {
        href: profileEmploymentHref(tid, staffId),
        actionLabel: "Manage employment",
        serverAction: "changeStaffEmploymentStatusAction",
      },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not delete profile or audit history."],
      impact: {
        lifecycle: "Employment becomes inactive; fi_staff.is_active false.",
        roster: "Not roster-eligible.",
        access: "May deactivate operational access when selected.",
        readiness: "Historical readiness preserved.",
        audit: "Status change recorded.",
      },
    },
    {
      id: "archive_staff",
      label: "Archive staff",
      description: "Remove from active directory while retaining full history.",
      category: "offboarding",
      entryPoint: "Staff Profile > Archive Staff",
      route: { href: profileArchiveHref(tid, staffId), actionLabel: "Archive staff" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not delete training, documents, or audit trail."],
      impact: {
        lifecycle: "archived_at set; excluded from active lists.",
        roster: "Not roster-eligible.",
        access: "Operational access deactivated.",
        readiness: "Historical records preserved.",
        audit: "Archive event recorded.",
      },
    },
    {
      id: "restore_staff",
      label: "Restore staff",
      description: "Return an archived staff member to the active directory.",
      category: "offboarding",
      entryPoint: "Staff Profile > Restore Staff",
      route: { href: profileArchiveHref(tid, staffId), actionLabel: "Restore staff" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not automatically re-provision access or hours."],
      impact: {
        lifecycle: "archived_at cleared.",
        roster: "Eligibility depends on employment, hours, and leave.",
        access: "May need separate access reactivation.",
        readiness: "Prior readiness data restored.",
        audit: "Restore event recorded.",
      },
    },
    {
      id: "terminate_offboard",
      label: "Terminate / offboard staff",
      description: "Process resignation, termination, or contract end through Offboarding Centre.",
      category: "offboarding",
      entryPoint: "HR OS > Offboarding Centre",
      route: { href: offboardingHref, actionLabel: "Open Offboarding Centre" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Historical shifts and audit trail preserved."],
      impact: {
        lifecycle: "Employment becomes terminated/resigned/contract_ended.",
        roster: "Future assignments removed; not roster-eligible.",
        access: "Login, PIN, and permissions revoked.",
        readiness: "Historical only.",
        audit: "Offboarding workflow audited.",
      },
    },
    {
      id: "re_enable_roster_eligibility",
      label: "Re-enable roster eligibility",
      description:
        "Composite workflow: return to active employment, clear leave blocks, configure standard hours, and restore access if needed.",
      category: "roster",
      entryPoint: "Staff Profile > Manage Employment + Standard Hours + Staff Access",
      route: { href: staffId ? buildStaffProfileHref(tid, staffId) : buildStaffDirectoryHref(tid) },
      requiredPermission: "hr_manager",
      doesNotChange: ["Does not auto-generate shifts."],
      impact: {
        lifecycle: "Employment set to active.",
        roster: "Eligible when hours configured and leave cleared.",
        access: "May require access reactivation if suspended.",
        readiness: "Training blockers may still apply.",
        audit: "Each step recorded separately.",
      },
    },
    {
      id: "view_identity_audit",
      label: "View identity audit",
      description: "Tenant-wide check of login, PIN, onboarding linkage, and identity signals.",
      category: "audit",
      entryPoint: "WorkforceOS > Identity Audit",
      route: { href: buildStaffIdentityAuditHref(tid), actionLabel: "Open Identity Audit" },
      requiredPermission: "admin",
      doesNotChange: ["Read-only diagnostic view."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Unchanged.",
        access: "Unchanged.",
        readiness: "Unchanged.",
        audit: "No mutation.",
      },
    },
    {
      id: "view_staff_audit_trail",
      label: "View staff audit trail",
      description: "Per-staff lifecycle timeline of profile, employment, access, and HR events.",
      category: "audit",
      entryPoint: "Staff Profile > Audit tab",
      route: {
        href: staffId ? `${buildStaffProfileHref(tid, staffId)}#audit` : buildStaffDirectoryHref(tid),
        actionLabel: "Open audit tab",
      },
      requiredPermission: "hr_manager",
      doesNotChange: ["Read-only history."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Unchanged.",
        access: "Unchanged.",
        readiness: "Unchanged.",
        audit: "No mutation.",
      },
    },
    {
      id: "hr_task_map",
      label: "HR task map — what do I do next?",
      description: "Guide to every staff HR task, where to go, and what each action changes.",
      category: "audit",
      entryPoint: "WorkforceOS > Command Centre > HR Task Map",
      route: { href: hrTaskMapHref, actionLabel: "Open HR Task Map" },
      requiredPermission: "hr_manager",
      doesNotChange: ["Reference guide only."],
      impact: {
        lifecycle: "Unchanged.",
        roster: "Unchanged.",
        access: "Unchanged.",
        readiness: "Unchanged.",
        audit: "No mutation.",
      },
    },
  ];
}

export function groupStaffHrTasksByCategory(
  tasks: readonly StaffHrTaskDefinition[]
): Array<{ category: StaffHrTaskCategory; label: string; tasks: StaffHrTaskDefinition[] }> {
  const order: StaffHrTaskCategory[] = [
    "access",
    "onboarding",
    "employment",
    "leave_availability",
    "roster",
    "training_readiness",
    "offboarding",
    "audit",
  ];

  return order
    .map((category) => ({
      category,
      label: STAFF_HR_TASK_CATEGORY_LABELS[category],
      tasks: tasks.filter((t) => t.category === category),
    }))
    .filter((group) => group.tasks.length > 0);
}

export function findStaffHrTaskById(
  tasks: readonly StaffHrTaskDefinition[],
  taskId: string
): StaffHrTaskDefinition | undefined {
  return tasks.find((t) => t.id === taskId);
}
