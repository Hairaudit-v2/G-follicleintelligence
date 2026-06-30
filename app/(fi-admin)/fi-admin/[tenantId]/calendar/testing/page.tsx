import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { CalendarTestingPanel } from "@/src/components/fi-admin/calendar/CalendarTestingPanel";
import { loadCalendarTestingPageData } from "@/src/lib/calendar/calendarTestingReadiness.server";
import {
  assertBookingsOperatorPageAccess,
  getCrmShellNavAllowed,
} from "@/src/lib/crm/crmShellAccess";

export const metadata = {
  title: "Calendar UAT",
  description: "ClinicOS calendar UAT checklist for real clinic testing (FI Admin).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function CalendarTestingRoutePage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  await assertBookingsOperatorPageAccess(tenantId);
  const [data, showCrmNav] = await Promise.all([
    loadCalendarTestingPageData(tenantId.trim()),
    getCrmShellNavAllowed(tenantId.trim()),
  ]);

  const uatSeedEnabled =
    process.env.NODE_ENV === "development" || process.env.FI_ALLOW_CALENDAR_UAT_SEED === "true";

  return (
    <div className="mx-auto max-w-[88rem] min-w-0 space-y-6">
      <CalendarTestingPanel
        tenantId={tenantId.trim()}
        payload={data}
        showCrmNav={showCrmNav}
        uatSeedEnabled={uatSeedEnabled}
      />
    </div>
  );
}
