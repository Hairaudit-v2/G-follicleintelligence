import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { RosterCommandCentreView } from "@/src/components/fi/workforce/RosterCommandCentreView";
import {
  loadRosterCommandCentre,
  loadRosterEventDetail,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  defaultRosterCommandCentreDateRange,
  parseRosterCommandCentreSearchParams,
  resolveRosterPreselectedEventKey,
  rosterDateRangeFromWeekStart,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";

export const metadata = {
  title: "Roster Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkforceOsRosterPage({ params, searchParams }: PageProps) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const rawSearch = await searchParams;
  const parsed = parseRosterCommandCentreSearchParams(rawSearch);
  const defaultRange = defaultRosterCommandCentreDateRange();
  const weekStart = parsed.weekStart ?? defaultRange.weekStart;
  const dateRange = parsed.weekStart
    ? rosterDateRangeFromWeekStart(parsed.weekStart)
    : { startsAt: defaultRange.startsAt, endsAt: defaultRange.endsAt };
  const preselectedEventKey = resolveRosterPreselectedEventKey(parsed);

  const payload = await loadRosterCommandCentre({
    tenantId: tenantId.trim(),
    dateRange,
    weekStart,
    clinicId: parsed.clinicId,
    staffId: parsed.staffId,
    eventType: parsed.eventType,
    statusFilter: parsed.status,
    preselectedEventKey,
  });

  const eventDetails: Record<
    string,
    {
      candidatesByRole: Record<
        string,
        import("@/src/lib/workforce-os/workforceRosterCandidates").RosterAssignableCandidate[]
      >;
    }
  > = {};

  const keysToHydrate = new Set<string>();
  if (preselectedEventKey) keysToHydrate.add(preselectedEventKey);
  for (const event of payload.events) {
    if (event.staffing.displayStatus === "missing_roles") keysToHydrate.add(event.eventKey);
  }

  for (const key of keysToHydrate) {
    const [eventSource, eventId] = key.split(":");
    if (!eventSource || !eventId) continue;
    if (eventSource !== "booking") continue;
    const detail = await loadRosterEventDetail({
      tenantId: tenantId.trim(),
      eventSource: "booking",
      eventId,
    });
    if (detail.event) {
      eventDetails[key] = { candidatesByRole: detail.candidatesByRole };
    }
  }

  return (
    <div className={cn(fiOsChromeClasses.pageScrollRoot)}>
      <RosterCommandCentreView
        tenantId={tenantId.trim()}
        payload={{ ...payload, preselectedEventKey }}
        eventDetails={eventDetails}
        filters={{
          weekStart,
          clinicId: parsed.clinicId ?? "",
          staffId: parsed.staffId ?? "",
          eventType: parsed.eventType ?? "",
          status: parsed.status ?? "",
        }}
        useWorkforceOsRoute
      />
    </div>
  );
}
