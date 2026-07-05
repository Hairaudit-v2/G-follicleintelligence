import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { TeamSubNav } from "@/src/components/fi-os/team/TeamSubNav";
import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import {
  loadHrOsNavVisibleForViewer,
  resolveHrOsRouteAccess,
} from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const dynamic = "force-dynamic";

export default async function TeamLayout({
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

  const [access, showHrOsNav] = await Promise.all([
    resolveHrOsRouteAccess(tid),
    loadHrOsNavVisibleForViewer(tid),
  ]);
  if (!access.ok) {
    return (
      <FiModuleAccessDenied
        tenantId={tid}
        moduleLabel="Team"
        reason={access.access.reason}
      />
    );
  }

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <TeamSubNav tenantId={tid} showHrOsNav={showHrOsNav} />
      {children}
    </div>
  );
}