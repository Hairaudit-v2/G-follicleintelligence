/**
 * Server entry for Team HR notification / My HR portal loaders.
 * Prefer this barrel for pages and other server modules.
 * Client code must not import this module — use `@/src/lib/team/notifications`
 * for pure notification DTOs and portal selection.
 */

import "server-only";

export { loadHrNotificationByStaffId } from "@/src/lib/team/notifications/staffHrNotificationLoader.server";

export {
  loadMyHrPortalPage,
  type MyHrPortalPageData,
  type MyHrPortalPageState,
} from "@/src/lib/team/notifications/myHrPortalLoader.server";
