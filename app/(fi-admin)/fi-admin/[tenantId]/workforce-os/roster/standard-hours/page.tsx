import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { StaffStandardHoursIndexClient } from "@/src/components/fi/workforce/StaffStandardHoursPageClient";
import { loadStaffStandardHoursSetupIndexPage } from "@/src/lib/workforce-os/staffStandardHoursPage.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const metadata = {
  title: "Standard hours · Roster",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function StaffStandardHoursSetupIndexPage({ params }: PageProps) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();
  const access = await resolveHrOsRouteAccess(tid);
  if (!access.ok) {
    return (
      <FiModuleAccessDenied tenantId={tid} moduleLabel="Team" reason={access.access.reason} />
    );
  }

  const data = await loadStaffStandardHoursSetupIndexPage(tid);
  if (!data) notFound();

  return (
    <StaffStandardHoursIndexClient
      tenantId={tid}
      canManage={data.canManage}
      manageDeniedReason={data.manageDeniedReason}
      staffOptions={data.staffOptions}
      staffMissingStandardHours={data.staffMissingStandardHours}
    />
  );
}