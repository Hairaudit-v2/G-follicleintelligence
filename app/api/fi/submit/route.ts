/**
 * POST /api/fi/submit
 * Validate required uploads and move case to SIGNALS_READY (status=submitted). Tenant-scoped.
 */
import { NextResponse } from "next/server";
import { submitCaseIfReady } from "@/lib/fi/services/caseSubmission";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
    const case_id = typeof body.case_id === "string" ? body.case_id.trim() : null;

    if (!tenant_id || !case_id)
      return NextResponse.json(
        { ok: false, error: "tenant_id and case_id are required." },
        { status: 400 }
      );

    const result = await submitCaseIfReady(tenant_id, case_id);

    if (!result.ok)
      return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });

    if (result.reason === "already_not_draft")
      return NextResponse.json(
        {
          ok: false,
          error: `Case cannot be submitted. Current status: ${result.statusBefore}`,
        },
        { status: 400 }
      );

    if (result.reason === "requirements_not_met")
      return NextResponse.json(
        {
          ok: false,
          error: result.error ?? "Missing required uploads.",
          missing: result.missing ?? [],
        },
        { status: 400 }
      );

    return NextResponse.json({
      ok: true,
      case_id,
      status: result.statusAfter,
      stage: "signals_ready",
      message: "Case submitted. Ready for model run.",
    });
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
