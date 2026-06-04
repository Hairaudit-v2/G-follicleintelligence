import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";
import { FiHomeDashboard } from "@/src/components/fi-admin/FiHomeDashboard";
import { getCrmShellNavAllowed } from "@/src/lib/crm/crmShellAccess";
import { loadFiHomeDashboardPayload } from "@/src/lib/fiOs/fiHomeDashboardLoader.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Home",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTenantHomePage({ params }: { params: Promise<{ tenantId: string }> }) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccess(tenantId);

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || !process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return <p className="text-sm text-red-600">Server misconfigured (Supabase).</p>;
  }

  const showCrmShellExtras = await getCrmShellNavAllowed(tenantId);

  let data;
  try {
    data = await loadFiHomeDashboardPayload(tenantId, { showCrmShellChecklistItems: showCrmShellExtras });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "Tenant not found") notFound();
    throw e;
  }

  return <FiHomeDashboard data={data} showCrmShellExtras={showCrmShellExtras} />;
}
