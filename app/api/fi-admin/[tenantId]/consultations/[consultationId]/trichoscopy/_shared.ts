import "server-only";

import { NextResponse } from "next/server";

import { resolveAuthUserId } from "@/src/lib/crm/crmGate";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function resolveConsultationTrichoscopyActor(opts: {
  tenantId: string;
}): Promise<{ userId: string } | { error: NextResponse }> {
  const tenantId = opts.tenantId.trim();
  if (!tenantId) {
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }

  const authUserId = await resolveAuthUserId(null);
  if (!authUserId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const supabase = supabaseAdmin();
  const { data: fiUser } = await supabase
    .from("fi_users")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("auth_user_id", authUserId)
    .maybeSingle();

  if (!fiUser) {
    return { error: NextResponse.json({ error: "Not found." }, { status: 404 }) };
  }

  return { userId: String((fiUser as { id: string }).id) };
}

export function mapTrichoscopyRouteError(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : "Request failed";
  const lower = message.toLowerCase();
  if (
    lower.includes("not entitled") ||
    lower.includes("not_entitled") ||
    lower.includes("platform_disabled") ||
    lower.includes("subscription")
  ) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  if (
    lower.includes("not permitted") ||
    lower.includes("capability") ||
    lower.includes("role does not")
  ) {
    return NextResponse.json({ error: message }, { status: 403 });
  }
  if (
    lower.includes("required") ||
    lower.includes("consent") ||
    lower.includes("not found") ||
    lower.includes("invalid") ||
    lower.includes("cannot transition") ||
    lower.includes("diagnosis")
  ) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ error: message }, { status: 502 });
}
