import { BookingCalendarPage } from "@/src/components/fi/bookings/calendar/BookingCalendarPage";
import { loadCalendarViewData } from "@/src/lib/bookings/calendarLoader";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";

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
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { tenantId } = await params;
  await assertCrmShellPageAccess(tenantId);
  const data = await loadCalendarViewData(tenantId, searchParams ?? {});

  return <BookingCalendarPage data={data} />;
}
