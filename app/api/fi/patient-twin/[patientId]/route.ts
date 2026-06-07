/**
 * GET /api/fi/patient-twin/[patientId]?tenant_id=...
 *
 * Read-only PatientTwin V1 projection for a foundation `fi_patients.id`. Requires the same FI
 * tenant portal gate as other `/api/fi/*` read endpoints.
 */
import { NextResponse } from "next/server";
import { checkFiTenantPortalApiAccess } from "@/src/lib/fiAdmin/clinicOsGlobalSearchApiAccess.server";
import { loadPatientTwinV1 } from "@/src/lib/patientTwin/patientTwinLoader.server";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const { patientId } = await params;
    const pid = patientId?.trim();
    if (!pid) {
      return NextResponse.json({ ok: false, error: "Missing patient id." }, { status: 400 });
    }

    const url = new URL(request.url);
    const tenant_id = url.searchParams.get("tenant_id");
    if (!tenant_id?.trim()) {
      return NextResponse.json({ ok: false, error: "tenant_id query param is required." }, { status: 400 });
    }

    const access = await checkFiTenantPortalApiAccess(request, tenant_id);
    if (!access.ok) {
      return NextResponse.json({ ok: false, error: access.message }, { status: access.status });
    }

    const twin = await loadPatientTwinV1({ tenantId: tenant_id, foundationPatientId: pid });
    if (!twin) {
      return NextResponse.json({ ok: false, error: "Patient not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, twin });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
