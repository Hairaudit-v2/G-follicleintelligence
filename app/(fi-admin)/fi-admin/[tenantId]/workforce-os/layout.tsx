import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { WorkforceOsSubNav } from "@/src/components/fi/workforce/WorkforceOsSubNav";
import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { isFiAdminTokenPublicRoute } from "@/src/lib/fiOs/fiAdminPublicRoutesCore";
import { assertFiTenantPortalAccessUnlessStaffPinSession } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { logLegacyWorkforceRouteAccess } from "@/src/lib/workforce/legacyRouteTelemetry.server";
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

  // Staff-access invite accept + PIN setup live under this prefix but are
  // token-authenticated and public: the tenant layout already exempts them, and
  // applying the portal gate here would bounce logged-out invitees to login.
  // These routes are preserved permanently (never redirected in A2), so they are
  // also excluded from legacy-route telemetry.
  const pathname = (await headers()).get("x-pathname") ?? "";
  if (isFiAdminTokenPublicRoute(pathname)) {
    return <>{children}</>;
  }

  await assertFiTenantPortalAccessUnlessStaffPinSession(tid);

  const access = await resolveHrOsRouteAccess(tid);
  await logLegacyWorkforceRouteAccess("workforce-os", tid, {
    viewerRole: access.ok ? access.userRole : null,
  });
  if (!access.ok) {
    return <FiModuleAccessDenied tenantId={tid} moduleLabel="Team" reason={access.access.reason} />;
  }

  const identityAuditAccess = await resolveStaffIdentityAuditAccess(tid);

  return (
    <div className={cn(fiOsChromeClasses.pageScrollContent, "px-4 pt-8")}>
      <WorkforceOsSubNav tenantId={tid} showIdentityAudit={identityAuditAccess.allowed} />
      {children}
    </div>
  );
}
