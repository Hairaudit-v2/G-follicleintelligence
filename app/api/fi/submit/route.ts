/**
 * POST /api/fi/submit
 * Validate required uploads and move case to SIGNALS_READY (status=submitted). Tenant-scoped.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateIntakeRequirements } from "@/src/lib/fi/requirements";

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

    const supabase = supabaseAdmin();

    const { data: caseRow } = await supabase
      .from("fi_cases")
      .select("id, status")
      .eq("id", case_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (!caseRow)
      return NextResponse.json({ ok: false, error: "Case not found." }, { status: 404 });

    if (caseRow.status !== "draft")
      return NextResponse.json(
        {
          ok: false,
          error: `Case cannot be submitted. Current status: ${caseRow.status}`,
        },
        { status: 400 }
      );

    const { data: uploads } = await supabase
      .from("fi_uploads")
      .select("type")
      .eq("case_id", case_id)
      .eq("tenant_id", tenant_id);

    const uploadTypes = (uploads ?? []).map((u) => u.type);
    const validated = validateIntakeRequirements(uploadTypes);

    if (!validated.ok)
      return NextResponse.json(
        {
          ok: false,
          error: validated.error,
          missing: validated.missing,
        },
        { status: 400 }
      );

    const { error: updateErr } = await supabase
      .from("fi_cases")
      .update({
        status: "submitted",
        updated_at: new Date().toISOString(),
      })
      .eq("id", case_id)
      .eq("tenant_id", tenant_id);

    if (updateErr)
      return NextResponse.json({ ok: false, error: updateErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      case_id,
      status: "submitted",
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
