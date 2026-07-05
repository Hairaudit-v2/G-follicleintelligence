import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { ReportsSubNav } from "@/src/components/fi-os/reports/ReportsSubNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { canViewFiOsNavigationAudit } from "@/src/lib/fiOs/navigation/fiOsNavigationAuditAccess.server";
import { canViewSecurityAuditNav } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const dynamic = "force-dynamic";

export default async function ReportsLayout({
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

  const [showAuditOsNav, showReportsAdminSurfaces] = await Promise.all([
    canViewSecurityAuditNav(tid),
    canViewFiOsNavigationAudit(tid),
  ]);

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <ReportsSubNav
        tenantId={tid}
        showAuditOsNav={showAuditOsNav}
        showReportsAdminSurfaces={showReportsAdminSurfaces}
      />
      {children}
    </div>
  );
}