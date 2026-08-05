import Link from "next/link";
import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { StaffCertificationClient } from "@/src/components/fi-admin/hr/StaffCertificationClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { loadCertificationsPageModel } from "@/src/lib/workforce/certificationsPage.server";
import { WORKFORCE_HR_MANAGE_ROLES } from "@/src/lib/workforce/workforceHrManageGate.server";

export const metadata = {
  title: "Training",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FiAdminTeamTrainingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  const base = `/fi-admin/${tid}`;

  try {
    const access = await resolveHrOsRouteAccess(tid);
    if (!access.ok) notFound();

    const model = await loadCertificationsPageModel(tid);
    const canManage =
      access.platformAdminPreview ||
      WORKFORCE_HR_MANAGE_ROLES.some((r) => r === access.userRole.trim().toLowerCase());

    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap gap-3 text-xs">
          <Link
            href={`${base}/hr-os/credentials`}
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-slate-400 transition-colors hover:border-white/[0.14] hover:text-slate-200"
          >
            Credentials
          </Link>
          <Link
            href={`${base}/academy`}
            className="rounded-full border border-white/[0.08] px-3 py-1.5 text-slate-400 transition-colors hover:border-white/[0.14] hover:text-slate-200"
          >
            Academy
          </Link>
        </div>
        <StaffCertificationClient
          tenantId={tid}
          staffRows={model.staffRows}
          canManage={canManage}
        />
      </div>
    );
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}
