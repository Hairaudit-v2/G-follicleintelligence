/**
 * Public Team notifications API — pure HR portal selection + notification composition
 * (client + server safe).
 *
 * Server loaders: `@/src/lib/team/notifications/server`
 *
 * Readiness thresholds / neutral HR readiness types: `@/src/lib/team/identity`
 * (notifications may compose on top of readiness; identity must not import this package).
 */

export {
  HR_PORTAL_SOURCE_SYSTEM_PRIORITY,
  isAllowedHrPortalUrl,
  pickHrPortalFromSourceIds,
  type HrPortalSourceIdInput,
} from "@/src/lib/team/notifications/myHrPortalSelection";

export {
  STAFF_HR_NOTIFICATION_METADATA_KEYS,
  STAFF_HR_SENSITIVE_METADATA_KEYS,
  STAFF_HR_SYNC_STALE_DAYS,
  buildStaffHrNotificationNoLinkSummary,
  buildStaffHrNotificationSummary,
  extractSafeHrNotificationMetadata,
  pickStaffHrNotificationFromSourceRows,
  staffHrNotificationSummaryHasSensitiveKeys,
  type StaffHrNotificationSourceRow,
  type StaffHrNotificationSummary,
  type StaffHrNotificationVariant,
  type StaffHrOnboardingStatus,
} from "@/src/lib/team/notifications/staffHrNotificationSummary";
