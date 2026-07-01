import { notFound } from "next/navigation";

import { WorkforceOsSubNav } from "@/src/components/fi/workforce/WorkforceOsSubNav";
import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const dynamic = "force-dynamic";

export default async function WorkforceOsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);

  const access = await resolveHrOsRouteAccess(tid);
  if (!access.ok) {
    return (
      <FiModuleAccessDenied
        tenantId={tid}
        moduleLabel="WorkforceOS"
        reason={access.access.reason}
      />
    );
  }

  return (
    <div className="mx-auto max-w-[88rem] px-4 pt-8">
      <WorkforceOsSubNav tenantId={tid} />
      {children}
    </div>
  );
}