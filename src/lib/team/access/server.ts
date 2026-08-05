/**
 * Server entry for Team staff access loaders, manage gate, and access mutations.
 * Prefer this barrel for pages and server actions.
 * Client code must not import this module — use `@/src/lib/team/access` for
 * pure types / projections / task-map helpers.
 *
 * Token hashing lives on `staffAccessInviteCore` (Node crypto; server routes only).
 * Dual-table repair stays on `@/src/lib/workforce/staffTenantLinkRepair.server`.
 */

import "server-only";

export {
  loadStaffAccessCentrePage,
  loadStaffAccessCentreRowForMember,
  sendStaffLoginInvite,
  resendStaffLoginInvite,
  copyStaffLoginInviteLink,
  revokeStaffLoginAccess,
  suspendStaffLoginAccess,
  type StaffAccessCentreRow,
  type StaffAccessCentrePageModel,
  type SendStaffLoginInviteResult,
} from "@/src/lib/team/access/staffAccessCentre.server";

export {
  loadStaffAccessInviteByToken,
  acceptStaffAccessInvitation,
  buildStaffAccessPinSetupUrl,
  type StaffAccessAcceptPageModel,
} from "@/src/lib/team/access/staffAccessAccept.server";

export {
  createStaffAccessPinSetupToken,
  completeStaffAccessPinSetup,
  revokePendingStaffAccessPinSetups,
  requestStaffPinResetLink,
  completeStaffPinResetViaToken,
} from "@/src/lib/team/access/staffAccessPinLayer.server";

export {
  assertWorkforceHrManageAllowed,
  resolveWorkforceHrManageCapability,
  WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  WORKFORCE_HR_MANAGE_ROLES,
  workforceHrManageAllowedForRole,
  type WorkforceHrManageDecision,
} from "@/src/lib/team/access/workforceHrManageGate.server";

export {
  insertStaffAccessAuditEvent,
  STAFF_ACCESS_AUDIT_EVENTS,
} from "@/src/lib/team/access/staffAccessInviteAudit.server";
