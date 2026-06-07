import { NextResponse } from "next/server";

import { checkFiTenantPortalApiAccess } from "@/src/lib/fiAdmin/clinicOsGlobalSearchApiAccess.server";
import { loadClinicOsGlobalSearchResults } from "@/src/lib/fiAdmin/clinicOsGlobalSearchLoader.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId?.trim()) {
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });
    }

    if (process.env.NEXT_PUBLIC_FI_CLINIC_OS_SHELL !== "true") {
      return NextResponse.json(
        {
          ok: false,
          code: "FI_CLINIC_OS_SHELL_DISABLED",
          error: "Clinic OS workspace search is not enabled for this deployment.",
        },
        { status: 404 }
      );
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

    const payload = await loadClinicOsGlobalSearchResults(tenantId, q);
    return NextResponse.json({ ok: true, ...payload });
  } catch (e: unknown) {
    const safeMessage =
      process.env.NODE_ENV === "production"
        ? "Search could not be completed."
        : e instanceof Error
          ? e.message
          : "Unexpected error.";
    return NextResponse.json({ ok: false, code: "SEARCH_INTERNAL_ERROR", error: safeMessage }, { status: 500 });
  }
}
