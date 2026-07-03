import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { RosterCommandCentreDiagnosticCard } from "@/src/components/fi/workforce/RosterCommandCentreDiagnosticCard";
import { RosterCommandCentreView } from "@/src/components/fi/workforce/RosterCommandCentreView";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadRosterCommandCentrePageData } from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.server";
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

  const [result, showTechnicalDetail] = await Promise.all([
    loadRosterCommandCentrePageData({
      tenantId: tenantId.trim(),
      dateRange,
      weekStart,
      clinicId: parsed.clinicId,
      staffId: parsed.staffId,
      eventType: parsed.eventType,
      statusFilter: parsed.status,
      preselectedEventKey,
    }),
    canViewDashboardSystemDiagnostics(tenantId.trim()),
  ]);

  if (!result.ok) {
    const showDetail =
      showTechnicalDetail || process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
    return (
      <div className={cn(fiOsChromeClasses.pageScrollRoot, fiOsChromeClasses.pageScrollContent, "p-4 sm:p-6")}>
        <RosterCommandCentreDiagnosticCard failure={result} showTechnicalDetail={showDetail} />
      </div>
    );
  }

  return (
    <div className={cn(fiOsChromeClasses.pageScrollRoot)}>
      <RosterCommandCentreView
        tenantId={tenantId.trim()}
        payload={result.payload}
        eventDetails={result.eventDetails}
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
