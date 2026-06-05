/**
 * GET /api/tenants/[tenantId]/foundation-integrity
 * Foundation integrity metrics (internal admin; same trust model as other /api/tenants routes).
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { loadFoundationIntegrityMetrics } from "@/src/lib/fi/foundation/integrity";
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

    const metrics = await loadFoundationIntegrityMetrics(tenantId);
    return NextResponse.json({ ok: true, metrics });
  } catch (e: unknown) {
    return mapCrmRouteError(e);
  }
}
