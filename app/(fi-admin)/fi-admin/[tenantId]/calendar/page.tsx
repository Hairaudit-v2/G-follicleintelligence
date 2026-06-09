import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { OperationalCalendarPage } from "@/src/components/fi-admin/calendar/OperationalCalendarPage";
import { loadOperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarLoader.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";

export const metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function TenantCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const sp = (await searchParams) ?? {};
  const [data, session] = await Promise.all([
    loadOperationalCalendarPageData(tenantId.trim(), sp),
    getClinicFloorSessionIfAllowed(tenantId.trim()),
  ]);

  return <OperationalCalendarPage data={data} session={session} />;
}
