/**
 * GET /api/tenants/[tenantId]/workforce-os/payroll-export
 * CSV export of approved timesheet entries for the active pay period.
 *
 * Query params:
 *   period  — YYYY-MM-DD anchor date (defaults to today in clinic timezone)
 *   scope   — approved (default) | all
 *   view    — summary (default) | detail
 */
import { NextRequest, NextResponse } from "next/server";

import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { buildPayPeriodPayrollExport } from "@/src/lib/workforce/payPeriodExport.server";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) {
    return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });
  }

  // Thin defence-in-depth gate at the route boundary. `buildPayPeriodPayrollExport` also enforces
  // the HR-manager role internally; this guard ensures the endpoint stays protected even if that
  // internal check is ever refactored, and blocks unauthenticated/cross-tenant callers early.
  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: "WorkforceOS access denied." },
      { status: 403 }
    );
  }

  const url = new URL(req.url);
  const result = await buildPayPeriodPayrollExport({
    tenantId: tenantId.trim(),
    periodDate: url.searchParams.get("period"),
    scopeRaw: url.searchParams.get("scope"),
    viewRaw: url.searchParams.get("view"),
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return new NextResponse(result.body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}