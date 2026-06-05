import { notFound } from "next/navigation";
import { unstable_noStore as noStore } from "next/cache";

import { CalendarPage } from "@/components/calendar/CalendarPage";
import { loadOperationalCalendarPageData } from "@/src/lib/calendar/operationalCalendarLoader.server";
import { assertFiTenantPortalAccess } from "@/src/lib/fiOs/fiOsPortalGate.server";

export const metadata = {
  title: "Calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

function firstParam(v: string | string[] | undefined): string {
  if (v == null) return "";
  return Array.isArray(v) ? String(v[0] ?? "") : String(v);
}

export default async function DashboardCalendarPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  noStore();
  const sp = (await searchParams) ?? {};
  const tenantId = firstParam(sp.tenantId).trim();
  if (!tenantId) notFound();

  await assertFiTenantPortalAccess(tenantId);
  const data = await loadOperationalCalendarPageData(tenantId, sp);

  return <CalendarPage data={data} route="dashboard" />;
}
