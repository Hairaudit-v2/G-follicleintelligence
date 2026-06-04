import { BookingOperatorPage } from "@/src/components/fi/bookings/operator/BookingOperatorPage";
import { loadBookingsOperatorPageData } from "@/src/lib/bookings/bookingOperatorLoader";
import { assertCrmShellPageAccess } from "@/src/lib/crm/crmShellAccess";

export const metadata = {
  title: "Bookings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function BookingsOperatorRoutePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantId: string }>;
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const { tenantId } = await params;
  await assertCrmShellPageAccess(tenantId);
  const data = await loadBookingsOperatorPageData(tenantId, searchParams ?? {});

  return <BookingOperatorPage data={data} />;
}
