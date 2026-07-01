import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { OffboardingCentreClient } from "@/src/components/fi-admin/hr/OffboardingCentreClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { loadOffboardingPageModel } from "@/src/lib/workforce/offboardingPage.server";
import { WORKFORCE_HR_MANAGE_ROLES } from "@/src/lib/workforce/workforceHrManageGate.server";

export const metadata = {
  title: "Offboarding Centre · HR OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HrOsOffboardingPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  const tid = tenantId?.trim();
  if (!tid) notFound();

  try {
    const access = await resolveHrOsRouteAccess(tid);
    if (!access.ok) notFound();

    const model = await loadOffboardingPageModel(tid);
    const canManage =
      access.platformAdminPreview ||
      WORKFORCE_HR_MANAGE_ROLES.some((r) => r === access.userRole.trim().toLowerCase());

    return (
      <OffboardingCentreClient
        tenantId={tid}
        activeStaff={model.activeStaff}
        offboardedStaff={model.offboardedStaff}
        canManage={canManage}
      />
    );
  } catch (e) {
    if (e instanceof CrmAccessError && (e.status === 401 || e.status === 403)) {
      notFound();
    }
    throw e;
  }
}