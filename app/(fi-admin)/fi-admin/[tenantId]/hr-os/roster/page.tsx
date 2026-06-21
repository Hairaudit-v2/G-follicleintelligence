import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { RosterCommandCentreView } from "@/src/components/fi/workforce/RosterCommandCentreView";
import {
  loadRosterCommandCentre,
  loadRosterEventDetail,
} from "@/src/lib/workforce-os/workforceRosterCommandCentre.server";
import {
  defaultRosterCommandCentreDateRange,
  parseRosterCommandCentreSearchParams,
  resolveRosterPreselectedEventKey,
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

export default async function RosterCommandCentrePage({ params, searchParams }: PageProps) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const rawSearch = await searchParams;
  const parsed = parseRosterCommandCentreSearchParams(rawSearch);
  const defaultRange = defaultRosterCommandCentreDateRange();
  const dateRange = {
    startsAt: parsed.dateFrom ? new Date(parsed.dateFrom).toISOString() : defaultRange.startsAt,
    endsAt: parsed.dateTo ? new Date(parsed.dateTo).toISOString() : defaultRange.endsAt,
  };
  const preselectedEventKey = resolveRosterPreselectedEventKey(parsed);

  const payload = await loadRosterCommandCentre({
    tenantId: tenantId.trim(),
    dateRange,
    clinicId: parsed.clinicId,
    eventType: parsed.eventType,
    statusFilter: parsed.status,
    preselectedEventKey,
  });

  const eventDetails: Record<
    string,
    { candidatesByRole: Record<string, import("@/src/lib/workforce-os/workforceRosterCandidates").RosterAssignableCandidate[]> }
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
    <div className="relative z-[1] mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <RosterCommandCentreView
        tenantId={tenantId.trim()}
        payload={{ ...payload, preselectedEventKey }}
        eventDetails={eventDetails}
        filters={{
          dateFrom: dateRange.startsAt,
          dateTo: dateRange.endsAt,
          clinicId: parsed.clinicId ?? "",
          eventType: parsed.eventType ?? "",
          status: parsed.status ?? "",
        }}
      />
    </div>
  );
}
