import "server-only";

import { cache } from "react";

export {
  HR_OS_MODULE_CODE,
  HR_OS_ROUTE_REQUIRED_ROLES,
  type HrOsRouteAccessDenied,
  type HrOsRouteAccessGranted,
  type HrOsRouteAccessResult,
  type ResolveHrOsRouteAccessTestOptions,
  resolveHrOsRouteAccessWithOptions,
} from "./hrOsRouteGateCore.server";

import {
  loadHrOsNavVisibleForViewerImpl,
  resolveHrOsRouteAccessWithOptions,
} from "./hrOsRouteGateCore.server";

async function resolveHrOsRouteAccessImpl(tenantId: string) {
  return resolveHrOsRouteAccessWithOptions(tenantId);
}

/** Deduped per request — layout + page share one gate evaluation and audit write. */
export const resolveHrOsRouteAccess = cache(resolveHrOsRouteAccessImpl);

/** Deduped per request — used by tenant layout for sidebar visibility. */
export const loadHrOsNavVisibleForViewer = cache(loadHrOsNavVisibleForViewerImpl);
