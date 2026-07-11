import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffIdentityReadinessAuditClient } from "@/src/components/fi/workforce/StaffIdentityReadinessAuditClient";
import { resolveStaffIdentityAuditAccess } from "@/src/lib/workforce-os/staffIdentityAuditAccess.server";
import { runStaffIdentityReadinessAudit } from "@/src/lib/workforce-os/staffIdentityReadinessAudit.server";

export const metadata = {
  title: "Identity readiness · Team",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function StaffIdentityAuditPage({
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
