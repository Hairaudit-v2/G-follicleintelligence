import { notFound } from "next/navigation";
import { Suspense } from "react";

import { cn } from "@/lib/utils";
import { TeamSubNav } from "@/src/components/fi-os/team/TeamSubNav";
import { TeamWorkspacePageFallback } from "@/src/components/fi-os/team/TeamWorkspacePageFallback";
import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveTeamWorkspaceAccessForViewer } from "@/src/lib/staffAccess/staffTeamAccess.server";

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

  const teamAccess = await resolveTeamWorkspaceAccessForViewer(tid);
  if (!teamAccess.allowed) {
    return (
      <FiModuleAccessDenied
        tenantId={tid}
        moduleLabel="Team"
        reason={teamAccess.deniedReason}
      />
    );
  }

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <TeamSubNav
        tenantId={tid}
        visibleTabIds={teamAccess.tabAccess.visibleTabIds}
      />
      <Suspense fallback={<TeamWorkspacePageFallback />}>{children}</Suspense>
    </div>
  );
}