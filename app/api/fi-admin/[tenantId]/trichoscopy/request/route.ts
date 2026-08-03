import "server-only";

import { NextResponse } from "next/server";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requestTrichoscopy } from "@/src/lib/integrations/hliTrichoscopy/commands";
import type { FiosTrichoscopyPurpose, HliEntitlementContext } from "@/src/lib/integrations/hliTrichoscopy/types";
import { resolveFiosTrichoscopyAccess } from "@/src/lib/platform/entitlements/resolveFiosTrichoscopyAccess.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PURPOSES = new Set<string>([
  "consultation",
  "treatment_baseline",
  "treatment_followup",
  "donor_assessment",
  "recipient_assessment",
  "pre_surgery",
  "revision_review",
  "procedure_day",
  "post_surgery",
  "scalp_review",
  "custom",
]);

export async function POST(
  request: Request,
  ctx: { params: Promise<{ tenantId: string }> }
): Promise<NextResponse> {
  const { tenantId: rawTenantId } = await ctx.params;
  const tenantId = rawTenantId?.trim();
  if (!tenantId) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const { data: fiUser } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!fiUser) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fiosPatientId = String(body.fiosPatientId ?? "").trim();
  const purpose = String(body.purpose ?? "").trim();
  if (!fiosPatientId || !PURPOSES.has(purpose)) {
    return NextResponse.json({ error: "patient and purpose are required" }, { status: 400 });
  }

  const access = await resolveFiosTrichoscopyAccess({
    tenantId,
    userId: String((fiUser as { id: string }).id),
    capability: "trichoscopy.request",
    patientId: fiosPatientId,
    caseId: body.fiosCaseId ? String(body.fiosCaseId) : null,
  });

  if (!access.allowed) {
    const conceal =
      access.denialReason === "platform_disabled" ||
      access.denialReason === "subscription_not_included" ||
      access.denialReason === "tenant_module_disabled";
    return NextResponse.json(
      { error: conceal ? "Not found." : "Trichoscopy request not permitted.", code: access.denialReason },
      { status: conceal ? 404 : 403 }
    );
  }

  const entitlementContext: HliEntitlementContext = {
    moduleKey: "hli_trichoscopy",
    capability: "trichoscopy.request",
    entitlementTier: access.capabilityTier ?? "capture",
    entitlementStatus:
      access.entitlementStatus === "trial" || access.entitlementStatus === "grace_period"
        ? access.entitlementStatus
        : "active",
    tenantId,
  };

  try {
    const result = await requestTrichoscopy({
      request: {
        tenantId,
        fiosPatientId,
        fiosCaseId: body.fiosCaseId ? String(body.fiosCaseId) : undefined,
        consultationId: body.consultationId ? String(body.consultationId) : undefined,
        treatmentPlanId: body.treatmentPlanId ? String(body.treatmentPlanId) : undefined,
        surgeryCaseId: body.surgeryCaseId ? String(body.surgeryCaseId) : undefined,
        purpose: purpose as FiosTrichoscopyPurpose,
        requestedSites: Array.isArray(body.requestedSites)
          ? (body.requestedSites as string[])
          : undefined,
        clinicalQuestion: body.clinicalQuestion ? String(body.clinicalQuestion) : undefined,
        targetDate: body.targetDate ? String(body.targetDate) : undefined,
        urgency: body.urgency === "priority" ? "priority" : "routine",
        requestedByUserId: String((fiUser as { id: string }).id),
      },
      entitlementContext,
    });

    return NextResponse.json({
      ok: true,
      requestRowId: result.requestRowId,
      linkId: result.linkId,
      episodeId: result.hli.episodeId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 502 }
    );
  }
}
