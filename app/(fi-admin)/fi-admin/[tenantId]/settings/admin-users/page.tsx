import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { InfoNotice } from "@/src/components/fi-admin/dashboard-ui";
import { TenantAdminUsersSection } from "@/src/components/fi-admin/settings/TenantAdminUsersSection";
import {
  getTenantAdminUsersManageAllowed,
  loadAuthLastSignInAtForUserIds,
  loadTenantAdminUserRowsForTenant,
} from "@/src/lib/tenantAdmin/tenantAdminProfile.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const dynamic = "force-dynamic";

export default async function TenantAdminUsersSettingsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return (
      <InfoNotice variant="danger" title="Server misconfigured">
        <p className="text-sm">Supabase environment variables are missing.</p>
      </InfoNotice>
    );
  }

  const canManage = await getTenantAdminUsersManageAllowed(tenantId);
  if (!canManage) {
    notFound();
  }

  const supabase = supabaseAdmin();
  const { data: tenant, error: te } = await supabase.from("fi_tenants").select("id").eq("id", tenantId).maybeSingle();
  if (te || !tenant) notFound();

  const rows = await loadTenantAdminUserRowsForTenant(tenantId);
  const authIds = rows.map((r) => r.fiUserAuthUserId).filter((x): x is string => Boolean(x?.trim()));
  const lastMap = await loadAuthLastSignInAtForUserIds(authIds);
  const lastLoginByAuthUserId: Record<string, string | null> = {};
  lastMap.forEach((v, k) => {
    lastLoginByAuthUserId[k] = v;
  });

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-[#64748B]">
          <Link href={`/fi-admin/${tenantId}/configuration`} className="text-[#22C1FF] hover:underline">
            Configuration
          </Link>{" "}
          / Admin Users
        </p>
        <h1 className="mt-2 text-xl font-semibold tracking-tight text-[#F8FAFC] sm:text-2xl">Admin Users</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#94A3B8]">
          Give trusted backend users access to dashboards, reporting, clinic settings, and operational tools without adding
          them as active clinical staff. These users are not included in surgery rosters, calendar provider columns, or HR
          staff import unless they are separately linked as <span className="text-[#CBD5E1]">fi_staff</span>.
        </p>
      </div>
      <TenantAdminUsersSection tenantId={tenantId} rows={rows} lastLoginByAuthUserId={lastLoginByAuthUserId} />
    </div>
  );
}
