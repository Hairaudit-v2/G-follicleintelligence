import "server-only";

import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { assertNonEmptyUuid } from "@/src/lib/crm/validation";
import { readFiProcedureDayEnabled } from "./procedureDayEnv.server";
import { enrichProcedureDayBoardWithLiveWorkflow } from "./procedureDayLiveLoader.server";
import {
  loadProcedureDayBoardPayload,
  loadProcedureDayBoardShellPayload,
} from "@/src/lib/surgery/procedureDayBoardLoader.server";

import type { ProcedureDayLiveBoardPayload } from "./procedureDayTypes";

export type LoadProcedureDayBoardOptions = {
  /** When set, enforces CRM tenant read gate (API routes). Page loader uses portal gate separately. */
  enforceCrmReadGate?: boolean;
  adminKey?: string;
  request?: Request;
  now?: Date;
  /** shell = first paint; full = post-hydrate enrichment */
  tier?: "shell" | "full";
};

/**
 * Procedure Day Board orchestrator — reads from existing SurgeryOS / CalendarOS loaders only.
 */
export async function loadProcedureDayBoardForTenant(
  tenantId: string,
  options: LoadProcedureDayBoardOptions = {}
): Promise<ProcedureDayLiveBoardPayload> {
  const tid = assertNonEmptyUuid(tenantId, "tenantId").trim();

  if (options.enforceCrmReadGate) {
    await assertCrmTenantReadAllowed({
      tenantId: tid,
      adminKey: options.adminKey,
      request: options.request,
    });
  }

  const tier = options.tier ?? "full";
  const base =
    tier === "shell"
      ? await loadProcedureDayBoardShellPayload(tid, options.now)
      : await loadProcedureDayBoardPayload(tid, options.now);

  if (tier === "shell" || !readFiProcedureDayEnabled()) {
    return {
      ...base,
      liveWorkflowEnabled: false,
      liveByBooking: {},
      liveSummary: { activeSessions: 0, completedToday: 0, dischargedToday: 0 },
    };
  }
  return enrichProcedureDayBoardWithLiveWorkflow(base);
}