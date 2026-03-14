/**
 * GET /api/tenants/[tenantId]/cases - List cases, optional status filter.
 * POST - Create case + intake.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateCaseCreate } from "@/lib/fi/validation";

export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || null;

    const supabase = supabaseAdmin();

    let query = supabase
      .from("fi_cases")
      .select("id, external_id, status, partner_id, created_at")
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false });

    if (status)
      query = query.eq("status", status);

    const { data: cases, error } = await query;

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

    if (!cases?.length)
      return NextResponse.json({ ok: true, cases: [] });

    const caseIds = cases.map((c) => c.id);
    const { data: intakes } = await supabase
      .from("fi_intakes")
      .select("case_id, full_name, email")
      .in("case_id", caseIds);

    const intakeByCase = new Map(
      (intakes ?? []).map((i) => [i.case_id, { full_name: i.full_name, email: i.email }])
    );

    const list = cases.map((c) => ({
      id: c.id,
      external_id: c.external_id,
      status: c.status,
      partner_id: c.partner_id,
      created_at: c.created_at,
      intake: intakeByCase.get(c.id) ?? null,
    }));

    return NextResponse.json({ ok: true, cases: list });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ tenantId: string }> }) {
  try {
    const { tenantId } = await params;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing tenantId." }, { status: 400 });

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const validated = validateCaseCreate(body);
    if (!validated.ok)
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });

    const { full_name, email, dob, sex, primary_concern, country } = validated.data;
    const external_id =
      typeof body.external_id === "string" ? body.external_id.trim() || null : null;

    const supabase = supabaseAdmin();

    const { data: tenant } = await supabase
      .from("fi_tenants")
      .select("id")
      .eq("id", tenantId)
      .single();
    if (!tenant)
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });

    const caseRow = {
      tenant_id: tenantId,
      external_id,
      status: "draft",
      metadata: body.metadata ?? {},
    };

    let caseData: { id: string; status: string; created_at: string } | null = null;
    let err: { message: string; code?: string } | null = null;

    if (external_id) {
      const result = await supabase
        .from("fi_cases")
        .upsert(caseRow, {
          onConflict: "tenant_id,external_id",
          ignoreDuplicates: false,
        })
        .select("id, status, created_at")
        .single();
      caseData = result.data;
      err = result.error;
    } else {
      const result = await supabase
        .from("fi_cases")
        .insert(caseRow)
        .select("id, status, created_at")
        .single();
      caseData = result.data;
      err = result.error;
    }

    if (err) {
      if (err.code === "23505") {
        return NextResponse.json(
          { ok: false, error: "Case with this external_id already exists." },
          { status: 409 }
        );
      }
      return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }

    if (!caseData)
      return NextResponse.json({ ok: false, error: "Failed to create case." }, { status: 500 });

    const intakeRow = {
      tenant_id: tenantId,
      case_id: caseData.id,
      full_name,
      email,
      dob,
      sex,
      country: country ?? null,
      primary_concern: primary_concern ?? null,
      selections: body.selections ?? {},
      notes: body.notes ?? null,
    };

    const { error: intakeErr } = await supabase.from("fi_intakes").upsert(intakeRow, {
      onConflict: "case_id",
      ignoreDuplicates: false,
    });

    if (intakeErr) {
      return NextResponse.json(
        { ok: false, error: `Case created but intake failed: ${intakeErr.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      case: { id: caseData.id, status: caseData.status, created_at: caseData.created_at },
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
