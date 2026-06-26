import { notFound } from "next/navigation";

import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";
import { assertStaffModuleAccess } from "@/src/lib/staffAccess/staffAccessGuards.server";
import { canViewSecurityAuditNav } from "@/src/lib/tenantAdmin/tenantAdminProfile.server";

export const dynamic = "force-dynamic";

export default async function AuditOsSegmentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();
  await assertFiTenantPortalAccess(tenantId);
  if (!(await canViewSecurityAuditNav(tenantId))) {
    notFound();
  }
  await assertStaffModuleAccess(tenantId, "audit_os", "read");
  return children;
}
