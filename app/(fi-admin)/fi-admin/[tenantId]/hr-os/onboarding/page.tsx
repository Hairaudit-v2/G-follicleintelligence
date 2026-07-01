import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { OnboardingCentreClient } from "@/src/components/fi-admin/hr/OnboardingCentreClient";
import { CrmAccessError } from "@/src/lib/crm/crmGate";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";
import { expireStaleOnboardingInvitations, loadOnboardingPageModel } from "@/src/lib/workforce/onboarding/onboardingPage.server";
import { WORKFORCE_HR_MANAGE_ROLES } from "@/src/lib/workforce/workforceHrManageGate.server";

export const metadata = {
  title: "Onboarding Centre · HR OS",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function HrOsOnboardingPage({
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

    await expireStaleOnboardingInvitations(tid);
    const model = await loadOnboardingPageModel(tid);
    const canManage =
      access.platformAdminPreview ||
      WORKFORCE_HR_MANAGE_ROLES.some((r) => r === access.userRole.trim().toLowerCase());

    return (
      <OnboardingCentreClient
        tenantId={tid}
        staff={model.staff}
        clinics={model.clinics}
        roleOptions={model.roleOptions}
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
