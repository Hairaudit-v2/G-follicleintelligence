/**
 * POST /api/fi/cases
 * Create case (tenant-scoped). Admin supabase client, no cookies.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateCaseCreate } from "@/lib/fi/validation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const tenant_id = typeof body.tenant_id === "string" ? body.tenant_id.trim() : null;
    if (!tenant_id)
      return NextResponse.json({ ok: false, error: "tenant_id is required." }, { status: 400 });

    const validated = validateCaseCreate(body);
    if (!validated.ok)
      return NextResponse.json({ ok: false, error: validated.error }, { status: 400 });

    const { full_name, email, dob, sex, primary_concern, country } = validated.data;
    const external_id =
      typeof body.external_id === "string" ? body.external_id.trim() || null : null;
    const referral_code =
      typeof body.referral_code === "string" ? body.referral_code.trim() || null : null;

    const supabase = supabaseAdmin();

    let partner_id: string | null = null;
    if (referral_code) {
      const { data: partner } = await supabase
        .from("fi_partners")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("reference_code", referral_code)
        .single();
      if (partner) partner_id = partner.id;
    }

    const { data: tenant } = await supabase
      .from("fi_tenants")
      .select("id")
      .eq("id", tenant_id)
      .single();
    if (!tenant)
      return NextResponse.json({ ok: false, error: "Tenant not found." }, { status: 404 });

    const caseRow = {
      tenant_id,
      external_id,
      partner_id: partner_id ?? null,
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
      tenant_id,
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

    const { error: intakeErr } = await supabase
      .from("fi_intakes")
      .upsert(intakeRow, { onConflict: "case_id", ignoreDuplicates: false });

    if (intakeErr)
      return NextResponse.json(
        {
          ok: false,
          error: `Case created but intake failed: ${intakeErr.message}`,
        },
        { status: 500 }
      );

    if (partner_id && referral_code) {
      await supabase.from("fi_referrals").upsert(
        { partner_id, case_id: caseData.id, referral_code },
        { onConflict: "case_id", ignoreDuplicates: true }
      );
    }

    return NextResponse.json({
      ok: true,
      case: {
        id: caseData.id,
        status: caseData.status,
        created_at: caseData.created_at,
      },
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
