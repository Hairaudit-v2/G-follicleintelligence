import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { FiModuleAccessDenied } from "@/src/components/fi-os/FiModuleAccessDenied";
import { StaffStandardHoursEditorClient } from "@/src/components/fi/workforce/StaffStandardHoursPageClient";
import { loadStaffStandardHoursEditorPage } from "@/src/lib/workforce-os/staffStandardHoursPage.server";
import { resolveHrOsRouteAccess } from "@/src/lib/platform/entitlements/hrOsRouteGate.server";

export const metadata = {
  title: "Edit standard hours · Roster",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string; staffId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
};

export default async function StaffStandardHoursEditorPage({ params, searchParams }: PageProps) {
  noStore();
  const { tenantId, staffId } = await params;
  const { returnTo } = await searchParams;
  if (!tenantId?.trim() || !staffId?.trim()) notFound();

  const tid = tenantId.trim();
  const access = await resolveHrOsRouteAccess(tid);
  if (!access.ok) {
    return <FiModuleAccessDenied tenantId={tid} moduleLabel="Team" reason={access.access.reason} />;
  }

  const data = await loadStaffStandardHoursEditorPage(tid, staffId.trim());
  if (!data) notFound();

  return (
    <StaffStandardHoursEditorClient
      tenantId={tid}
      staffId={data.staff.id}
      staffName={data.staff.name}
      canManage={data.canManage}
      manageDeniedReason={data.manageDeniedReason}
      initialDays={data.initialDays}
      clinics={data.clinics}
      rosterCadence={data.rosterCadence}
      defaultFullTimePattern={data.defaultFullTimePattern}
      returnTo={returnTo}
    />
  );
}
