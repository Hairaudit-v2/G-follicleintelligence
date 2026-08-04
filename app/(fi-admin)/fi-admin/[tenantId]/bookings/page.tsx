import { BookingOperatorPage } from "@/src/components/fi/bookings/operator/BookingOperatorPage";
import { loadBookingsOperatorPageData } from "@/src/lib/bookings/bookingOperatorLoader";
import { assertBookingsOperatorPageAccess } from "@/src/lib/crm/crmShellAccess";

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
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await params;
  await assertBookingsOperatorPageAccess(tenantId);
  const sp = (await searchParams) ?? {};
  const data = await loadBookingsOperatorPageData(tenantId, sp);

  return <BookingOperatorPage data={data} />;
}
