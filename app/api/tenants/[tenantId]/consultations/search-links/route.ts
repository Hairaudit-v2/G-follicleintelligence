import { NextResponse } from "next/server";

import { checkFiTenantPortalApiAccess } from "@/src/lib/fiAdmin/clinicOsGlobalSearchApiAccess.server";
import { loadConsultationLinkSearchResults } from "@/src/lib/consultations/consultationLinkSearchLoader.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });
    }

    const gate = await checkFiTenantPortalApiAccess(request, tenantId);
    if (!gate.ok) {
      return NextResponse.json({ ok: false, error: gate.message }, { status: gate.status });
    }

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return NextResponse.json({ ok: false, error: "Search is not configured on this server." }, { status: 503 });
    }

    const url = new URL(request.url);
    const q = url.searchParams.get("q") ?? "";
    const payload = await loadConsultationLinkSearchResults(tenantId, q);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
