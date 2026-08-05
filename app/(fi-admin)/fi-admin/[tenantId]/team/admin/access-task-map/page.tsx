import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffHrTaskMapClient } from "@/src/components/fi/workforce/StaffHrTaskMapClient";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { HR_OS_ROUTE_REQUIRED_ROLES } from "@/src/lib/platform/entitlements/hrOsRouteGateCore.server";

export const metadata = {
  title: "Access task map · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * FI-WORKFORCE-COHESION-A2 — Team admin diagnostics namespace. Moved from
 * /workforce-os/hr-task-map. Access gate and query params are unchanged.
 */
export default async function TeamAdminAccessTaskMapPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ staffId?: string; category?: string; task?: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const { staffId, category, task } = await searchParams;
  if (!tenantId?.trim()) notFound();

  const access = await resolveHrOsRouteAccess(tenantId.trim());
  if (!access.ok) notFound();
  if (!access.platformAdminPreview) {
    const role = access.userRole.trim().toLowerCase();
    if (!HR_OS_ROUTE_REQUIRED_ROLES.some((allowed) => allowed === role)) {
      notFound();
    }
  }

  return (
    <div className="mx-auto max-w-4xl pb-8">
      <StaffHrTaskMapClient
        tenantId={tenantId.trim()}
        staffId={staffId?.trim() ?? null}
        initialCategory={category?.trim() ?? null}
        initialTaskId={task?.trim() ?? null}
      />
    </div>
  );
}
