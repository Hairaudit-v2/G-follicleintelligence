import {
  loadOperationalCalendarGridData,
  type OperationalCalendarGridPatch,
} from "@/src/lib/calendar/operationalCalendarLoader.server";
import type { CalendarRoute } from "@/src/lib/bookings/calendarQuery";
import { OperationalCalendarGridPatchBridge } from "@/src/components/fi-admin/calendar/OperationalCalendarGridPatchBridge";

export async function CalendarBookingsSection({
  tenantId,
  searchParams,
  route = "fi-admin",
}: {
  tenantId: string;
  searchParams: Record<string, string | string[] | undefined>;
  route?: CalendarRoute;
}) {
  const patch: OperationalCalendarGridPatch = await loadOperationalCalendarGridData(tenantId, searchParams, {
    route,
  });
  return <OperationalCalendarGridPatchBridge patch={patch} />;
}
