/**
 * GET /api/tenants
 * FI Admin home: tenants visible to the signed-in FI user (`fi_users` membership).
 *
 * **Production:** requires Supabase Auth session (or Bearer); returns only linked tenants.
 *
 * **Local development:** if there is no session, optional bypass lists all `fi_tenants` when
 * `FI_ENABLE_DEV_ADMIN_ACCESS=true` and `NODE_ENV !== 'production'` (see `docs/dev-local-fi-admin.md`).
 */
import { NextResponse } from "next/server";
import { resolveFiAdminTenantDirectory } from "@/src/lib/fiAdmin/fiAdminTenantDirectory";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      return NextResponse.json({ ok: false, error: "Server misconfigured." }, { status: 500 });
    }

    const result = await resolveFiAdminTenantDirectory(request);
    if (result.kind === "error") {
      return NextResponse.json(
        { ok: false, error: result.message, code: result.code },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      tenants: result.tenants,
      devTenantListFallback: result.devTenantListFallback,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Unexpected error." },
      { status: 500 }
    );
  }
}
