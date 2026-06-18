/**
 * GET /api/tenants/[tenantId]/reception-os/export
 * Safe JSON/CSV export for pilot review and owner value metrics (no patient content).
 */
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { crmJsonError, extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";
import { resolveReceptionOsViewerContext } from "@/src/lib/receptionOs/receptionOsAccess.server";
import { loadReceptionOsCommandCentrePayload } from "@/src/lib/receptionOs/receptionOsCommandCentreLoader.server";
import {
  buildReceptionPilotExportBundle,
  parseReceptionPilotExportFormat,
  serializeReceptionPilotExportCsv,
  serializeReceptionPilotExportJson,
} from "@/src/lib/receptionOs/receptionPilotExportModel";
import { receptionPilotReviewVisible } from "@/src/lib/receptionOs/receptionPilotReviewModel";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) return crmJsonError(400, "Missing tenantId.");

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const viewer = await resolveReceptionOsViewerContext(tenantId.trim());
    if (!viewer.canAccessReceptionOs) {
      return crmJsonError(403, "ReceptionOS access requires an active staff or CRM shell role for this tenant.");
    }
    if (!receptionPilotReviewVisible(viewer.receptionOsRole)) {
      return crmJsonError(403, "Pilot export requires admin or clinic manager access.");
    }

    const url = new URL(req.url);
    const format = parseReceptionPilotExportFormat(url.searchParams.get("format"));
    const demoModeRequested = url.searchParams.get("demo") === "1";

    const data = await loadReceptionOsCommandCentrePayload(tenantId.trim(), new Date(), {
      demoModeRequested,
    });

    const bundle = buildReceptionPilotExportBundle({
      tenantId: data.tenantId,
      tenantName: data.tenantName,
      periodDays: data.pilotReview.periodDays,
      pilotReview: data.pilotReview.report,
      ownerValue: data.ownerValue.dashboard,
      managerScores: data.pilotMetrics.managerScores,
    });

    const filenameBase = `reception-os-pilot-${data.operationalDay.todayYmd}`;

    if (format === "csv") {
      const body = serializeReceptionPilotExportCsv(bundle);
      return new Response(body, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filenameBase}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const body = serializeReceptionPilotExportJson(bundle);
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filenameBase}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return mapCrmRouteError(e);
  }
}
