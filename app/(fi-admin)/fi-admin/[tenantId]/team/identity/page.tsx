import Link from "next/link";
import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { StaffAccessCentreClient } from "@/src/components/fi/workforce/StaffAccessCentreClient";
import { loadStaffAccessCentrePage } from "@/src/lib/workforce/staffAccessCentre.server";
import { resolveStaffIdentityAuditAccess } from "@/src/lib/workforce-os/staffIdentityAuditAccess.server";
import { assertTeamTabAccessOrNotFound } from "@/src/lib/staffAccess/staffTeamTabRouteGate.server";
import { resolveWorkforceHrManageCapability } from "@/src/lib/workforce/workforceHrManageGate.server";
import { buildStaffIdentityAuditHref } from "@/src/lib/workforce/staffLifecycleCopy";

export const metadata = {
  title: "Identity & access",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTeamIdentityPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  await assertTeamTabAccessOrNotFound(tid, "identity");

  const [data, manage, identityAuditAccess] = await Promise.all([
    loadStaffAccessCentrePage(tid),
    resolveWorkforceHrManageCapability(tid),
    resolveStaffIdentityAuditAccess(tid),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      {identityAuditAccess.allowed ? (
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={buildStaffIdentityAuditHref(tid)}
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-slate-400 transition-colors hover:border-white/[0.14] hover:text-slate-200"
          >
            Identity readiness audit (direct)
          </Link>
        </div>
      ) : null}
      <StaffAccessCentreClient tenantId={tid} rows={data.rows} canManage={manage.canManage} />
    </div>
  );
}
