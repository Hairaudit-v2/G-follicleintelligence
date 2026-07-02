import "server-only";

import { notFound } from "next/navigation";

import { readFiProcedureDayEnabled } from "./procedureDayEnv.server";

/** Route gate — returns 404 when the deployment flag is off (additive module hidden). */
export function assertFiProcedureDayRouteAllowed(): void {
  if (!readFiProcedureDayEnabled()) {
    notFound();
  }
}