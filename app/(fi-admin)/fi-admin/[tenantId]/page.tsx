import { unstable_noStore as noStore } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Today",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Bare `/fi-admin/[tenantId]` → canonical Today surface (D6G primary rail).
 * All roles land on `/today`.
 */
export default async function FiAdminTenantHomePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();
  await assertFiTenantPortalAccess(tenantId);
  redirect(`/fi-admin/${tenantId.trim()}/today`);
}
