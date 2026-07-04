import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { WorkforceOsSubNav } from "@/src/components/fi/workforce/WorkforceOsSubNav";
import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { resolveStaffIdentityAuditAccess } from "@/src/lib/workforce-os/staffIdentityAuditAccess.server";

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
        moduleLabel="Team"
        reason={access.access.reason}
      />
    );
  }

  const identityAuditAccess = await resolveStaffIdentityAuditAccess(tid);

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <WorkforceOsSubNav tenantId={tid} showIdentityAudit={identityAuditAccess.allowed} />
      {children}
    </div>
  );
}