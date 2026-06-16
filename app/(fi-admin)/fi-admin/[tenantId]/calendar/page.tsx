import { notFound, redirect } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { Suspense } from "react";

import { OperationalCalendarPage } from "@/src/components/fi-admin/calendar/OperationalCalendarPage";
import {
  loadOperationalCalendarShellData,
} from "@/src/lib/calendar/operationalCalendarLoader.server";
import { getClinicFloorSessionIfAllowed } from "@/src/lib/staffPin/clinicFloorAccess";
import { CalendarBookingsSection } from "./CalendarBookingsSection";
import { FiOsCalendarGridSkeleton } from "@/src/components/fi-admin/calendar/FiOsCalendarGridSkeleton";

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
  const [shell, session] = await Promise.all([
    loadOperationalCalendarShellData(tenantId.trim(), sp, { route: "fi-admin" }),
    getClinicFloorSessionIfAllowed(tenantId.trim()),
  ]);

  if (shell.canonicalRedirectHref) redirect(shell.canonicalRedirectHref);

  return (
    <OperationalCalendarPage session={session} shell={shell}>
      <Suspense fallback={<FiOsCalendarGridSkeleton />}>
        <CalendarBookingsSection tenantId={tenantId.trim()} searchParams={sp} route="fi-admin" />
      </Suspense>
    </OperationalCalendarPage>
  );
}
