import { notFound } from "next/navigation";

import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const dynamic = "force-dynamic";

export default async function HrOsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertFiTenantPortalAccessUnlessStaffPinSession(tenantId);

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) {
    return (
      <FiModuleAccessDenied tenantId={tenantId.trim()} moduleLabel="HR OS" reason={access.access.reason} />
    );
  }

  return <>{children}</>;
}
