import { NextResponse } from "next/server";

import { assertCrmTenantReadAllowed, CrmAccessError } from "@/src/lib/crm/crmGate";
import { computeTodaySignalRevision } from "@/src/lib/fiOs/todaySignal/todaySignalEngine";
import { loadTenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { deriveWorkspaceSignalsFromOperationalDashboard } from "@/src/lib/fiOs/workspaceSignal/workspaceSignalRegistry.server";

/**
 * GET /api/tenants/[tenantId]/today-signal/revision
 * Non-PHI fingerprint — client polls to trigger router.refresh() only when changed.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ tenantId: string }> }
): Promise<Response> {
  const { tenantId } = await context.params;
  const tid = tenantId?.trim();
  if (!tid) {
    return NextResponse.json({ error: "tenantId required" }, { status: 400 });
  }

  try {
    await assertCrmTenantReadAllowed({ tenantId: tid, request: _request });
  } catch (e) {
    if (e instanceof CrmAccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }

  const dashboard = await loadTenantOperationalDashboard(tid, { includeReceptionBoard: true });
  const revision = computeTodaySignalRevision(dashboard);
  const workspaceSignals = deriveWorkspaceSignalsFromOperationalDashboard({
    receptionBoard: dashboard.receptionBoard,
    staleLeads: dashboard.staleLeads,
    entityAttention: dashboard.entityAttention,
  });
  return NextResponse.json(
    { revision, workspaceSignals },
    { headers: { "Cache-Control": "no-store, private" } }
  );
}
