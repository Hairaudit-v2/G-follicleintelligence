/**
 * GET /api/fi/audit/dashboard
 * Read-only AuditOS dashboard snapshot: KPIs, queue, recent fi_audits, pipeline counts.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkFiTenantPortalApiAccess } from "@/src/lib/fiAdmin/clinicOsGlobalSearchApiAccess.server";
import { loadAuditDashboardSnapshot } from "@/src/lib/fiAdmin/auditDashboardRead.server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const url = new URL(req.url);
    const tenant_id = url.searchParams.get("tenant_id");
    if (!tenant_id) {
      return NextResponse.json(
        { ok: false, error: "tenant_id query param is required." },
        { status: 400 }
      );
    }

    const access = await checkFiTenantPortalApiAccess(req, tenant_id);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
    }

    const snapshot = await loadAuditDashboardSnapshot(supabaseAdmin(), tenant_id);

    return NextResponse.json({ ok: true, ...snapshot });
  } catch (e: unknown) {
    return NextResponse.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : "Unexpected error.",
      },
      { status: 500 }
    );
  }
}
