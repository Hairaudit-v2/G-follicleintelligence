/**
 * GET /api/tenants/[tenantId]/foundation-integrity
 * Foundation integrity metrics plus FoundationOS dashboard aggregates (read-only).
 * Same trust model as other /api/tenants routes — `metrics` preserves the legacy integrity shape; `foundation_os` adds KPIs without duplicating previews.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadFoundationOsDashboard } from "@/src/lib/fi/foundation/foundationOsDashboardRead.server";
import { assertCrmTenantReadAllowed } from "@/src/lib/crm/crmGate";
import { extractAdminKeyFromRequest, mapCrmRouteError } from "@/src/lib/crm/crmHttp";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });
    }
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const adminKey = extractAdminKeyFromRequest(req);
    await assertCrmTenantReadAllowed({ tenantId, adminKey, request: req });

    const supabase = supabaseAdmin();
    const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
    if (te) return NextResponse.json({ ok: false, error: te.message }, { status: 500 });
    if (!tenant) return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });

    const dashboard = await loadFoundationOsDashboard(tenantId);
    const { integrity, ...foundation_os } = dashboard;
    return NextResponse.json({ ok: true, metrics: integrity, foundation_os });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}
