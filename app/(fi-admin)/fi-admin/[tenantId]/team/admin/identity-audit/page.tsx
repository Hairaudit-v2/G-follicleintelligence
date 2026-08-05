import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffIdentityReadinessAuditClient } from "@/src/components/fi/workforce/StaffIdentityReadinessAuditClient";
import {
  resolveStaffIdentityAuditAccess,
  runStaffIdentityReadinessAudit,
} from "@/src/lib/team/identity/server";

export const metadata = {
  title: "Identity readiness · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * FI-WORKFORCE-COHESION-A2 — Team admin diagnostics namespace. Moved from
 * /workforce-os/staff-identity-audit so admin tooling lives under the canonical
 * /team prefix instead of a retired one. Access gate is unchanged.
 */
export default async function TeamAdminIdentityAuditPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const { allowed } = await resolveStaffIdentityAuditAccess(tenantId.trim());
  if (!allowed) notFound();

  const audit = await runStaffIdentityReadinessAudit(tenantId.trim());

  return (
    <div className="mx-auto max-w-6xl pb-8">
      <StaffIdentityReadinessAuditClient tenantId={tenantId.trim()} audit={audit} />
    </div>
  );
}
