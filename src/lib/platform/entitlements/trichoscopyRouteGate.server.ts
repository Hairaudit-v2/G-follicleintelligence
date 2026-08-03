import "server-only";

import { cache } from "react";

export {
  type TrichoscopyRouteAccessDenied,
  type TrichoscopyRouteAccessGranted,
  type TrichoscopyRouteAccessResult,
  resolveTrichoscopyRouteAccessWithOptions,
  loadTrichoscopyNavVisibleForViewerImpl,
} from "./trichoscopyRouteGateCore.server";

import {
  loadTrichoscopyNavVisibleForViewerImpl,
  resolveTrichoscopyRouteAccessWithOptions,
} from "./trichoscopyRouteGateCore.server";

async function resolveTrichoscopyRouteAccessImpl(tenantId: string) {
  return resolveTrichoscopyRouteAccessWithOptions(tenantId);
}

/** Deduped per request — layout + page share one gate evaluation. */
export const resolveTrichoscopyRouteAccess = cache(resolveTrichoscopyRouteAccessImpl);

/** Deduped per request — used by tenant layout for sidebar visibility. */
export const loadTrichoscopyNavVisibleForViewer = cache(loadTrichoscopyNavVisibleForViewerImpl);
