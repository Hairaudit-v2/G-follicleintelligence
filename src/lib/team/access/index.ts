/**
 * Public Team access API — pure types, projection helpers, and access-domain
 * eligibility / task-map helpers.
 *
 * Server loaders & mutations: `@/src/lib/team/access/server`
 * Token hashing (Node crypto): `@/src/lib/team/access/staffAccessInviteCore`
 * Do not import `*.server` modules from client components (type-only imports of
 * page result types from dedicated server files are allowed).
 */

export type {
  StaffAccessAttentionReason,
  StaffAccessEntry,
  StaffAccessEntryStatus,
  StaffAccessIdentitySummary,
} from "@/src/lib/team/access/types";

export { STAFF_ACCESS_ATTENTION_LABELS } from "@/src/lib/team/access/types";

export {
  deriveStaffAccessAttentionReasons,
  mapAuthLoginToAccessEntryStatus,
  projectStaffAccessEntry,
  type StaffAccessProjectionFacts,
} from "@/src/lib/team/access/projectStaffAccessEntry";

export {
  applyStaffAccessEntryFlags,
  type StaffAccessCentreActionFlags,
} from "@/src/lib/team/access/toStaffAccessCentreRow";

export type {
  StaffAuthLoginStatus,
  StaffInviteStatus,
} from "@/src/lib/team/access/staffAccessCentreCore";

export {
  DEPARTED_EMPLOYMENT_STATUSES,
  STAFF_LOGIN_INVITE_EXPIRY_DAYS,
  authLoginStatusLabel,
  canReceiveLoginInvite,
  inviteStatusLabel,
  isArchivedStaff,
  isDepartedStaff,
  nextResendInvitationTimestamps,
  pinStatusLabel,
  resolveAuthLoginStatus,
  resolveInviteStatus,
  resolvePermissionTemplateLabel,
} from "@/src/lib/team/access/staffAccessCentreCore";

export type {
  StaffTenantLinkIntegrity,
  StaffTenantLinkSnapshot,
  StaffAccessAcceptAuditKind,
} from "@/src/lib/team/access/staffAccessAcceptCore";

export {
  assessStaffTenantLinkIntegrity,
  resolveStaffAccessAcceptAuditKind,
} from "@/src/lib/team/access/staffAccessAcceptCore";

export {
  WORKFORCE_HR_MANAGE_DENIED_MESSAGE,
  WORKFORCE_HR_MANAGE_ROLES,
  workforceHrManageAllowedForRole,
  type WorkforceHrManageDecision,
} from "@/src/lib/team/access/workforceHrManageGateCore";

export {
  listUnlinkedStaffWithEmail,
  normalizeStaffLinkEmail,
  planStaffFiUserLinks,
  type StaffFiUserLinkCandidate,
  type StaffFiUserLinkExistingUser,
  type StaffFiUserLinkPlanRow,
  type StaffFiUserLinkPlanResult,
  type StaffFiUserLinkActionKind,
} from "@/src/lib/team/access/staffFiUserLinkPlan";

export type {
  StaffHrTaskCategory,
  StaffHrTaskDefinition,
  StaffHrTaskImpact,
  StaffHrTaskRouteTarget,
} from "@/src/lib/team/access/staffHrTaskMapCore";

export {
  STAFF_HR_TASK_CATEGORY_LABELS,
  buildStaffHrTaskMap,
  findStaffHrTaskById,
  groupStaffHrTasksByCategory,
} from "@/src/lib/team/access/staffHrTaskMapCore";

export type {
  StaffHrTaskMapBannerPreset,
  StaffHrTaskMapBannerSurface,
} from "@/src/lib/team/access/staffHrTaskMapBannerCore";

export {
  STAFF_HR_TASK_MAP_BANNER_PRESETS,
  buildStaffHrTaskMapBannerHref,
  parseStaffHrTaskMapCategoryParam,
  resolveStaffHrTaskMapBanner,
} from "@/src/lib/team/access/staffHrTaskMapBannerCore";
