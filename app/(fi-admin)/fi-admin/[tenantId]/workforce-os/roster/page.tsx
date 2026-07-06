import { unstable_noStore as noStore } from "next/cache";
import { notFound } from "next/navigation";

import { cn } from "@/lib/utils";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import { RosterCommandCentreDiagnosticCard } from "@/src/components/fi/workforce/RosterCommandCentreDiagnosticCard";
import { RosterCommandCentreView } from "@/src/components/fi/workforce/RosterCommandCentreView";
import { canViewDashboardSystemDiagnostics } from "@/src/lib/fi-os/dashboardSystemDiagnosticsAccess.server";
import { loadWorkforceRosterPlanningPolicy } from "@/src/lib/workforce/rosterCadencePolicy.server";
import { loadRosterCommandCentrePageData } from "@/src/lib/workforce-os/rosterCommandCentrePageLoader.server";
import { resolveStaffStandardHoursManageCapability } from "@/src/lib/workforce-os/staffStandardHoursManageGate.server";
import { ROSTER_MANAGE_DENIED_REASON } from "@/src/lib/workforce-os/staffStandardHoursRoutes";
import {
  defaultRosterCommandCentreDateRange,
  parseRosterCommandCentreSearchParams,
  resolveRosterPeriodStartFromParams,
  resolveRosterPreselectedEventKey,
  rosterDateRangeFromPeriodStartParam,
} from "@/src/lib/workforce-os/workforceRosterQueryParams";

export const metadata = {
  title: "Roster Command Centre",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkforceOsRosterPage({ params, searchParams }: PageProps) {
  noStore();
  const { tenantId } = await params;
  if (!tenantId?.trim()) notFound();

  const tid = tenantId.trim();

  try {
  const rawSearch = await searchParams;
  const parsed = parseRosterCommandCentreSearchParams(rawSearch);
  const rosterPlanning = await loadWorkforceRosterPlanningPolicy(tid);
  const defaultRange = defaultRosterCommandCentreDateRange(new Date(), rosterPlanning);
  const periodStart = resolveRosterPeriodStartFromParams(parsed, rosterPlanning);
  const dateRange = rosterDateRangeFromPeriodStartParam(periodStart, rosterPlanning);
  const preselectedEventKey = resolveRosterPreselectedEventKey(parsed);

  const [result, showTechnicalDetail, manageCapability] = await Promise.all([
    loadRosterCommandCentrePageData({
      tenantId: tid,
      dateRange: { startsAt: dateRange.startsAt, endsAt: dateRange.endsAt },
      periodStart,
      weekStart: defaultRange.weekStart,
      rosterPlanning,
      clinicId: parsed.clinicId,
      staffId: parsed.staffId,
      eventType: parsed.eventType,
      statusFilter: parsed.status,
      preselectedEventKey,
    }),
    canViewDashboardSystemDiagnostics(tid),
    resolveStaffStandardHoursManageCapability(tid),
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
        tenantId={tid}
        payload={result.payload}
        eventDetails={result.eventDetails}
        filters={{
          periodStart,
          weekStart: periodStart,
          clinicId: parsed.clinicId ?? "",
          staffId: parsed.staffId ?? "",
          eventType: parsed.eventType ?? "",
          status: parsed.status ?? "",
        }}
        useWorkforceOsRoute
        canManage={manageCapability.canManage}
        canManageStandardHours={manageCapability.canManage}
        manageDeniedReason={
          manageCapability.canManage ? "" : ROSTER_MANAGE_DENIED_REASON
        }
      />
    </div>
  );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Roster page failed to load.";
    const digest =
      e instanceof Error && "digest" in e
        ? String((e as Error & { digest?: string }).digest ?? "").trim() || undefined
        : undefined;
    const showDetail =
      process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
    return (
      <div className={cn(fiOsChromeClasses.pageScrollRoot, fiOsChromeClasses.pageScrollContent, "p-4 sm:p-6")}>
        <RosterCommandCentreDiagnosticCard
          failure={{
            ok: false,
            failedStep: "load_roster_payload",
            message,
            digest,
            schemaCheckPassed: true,
            counts: {},
          }}
          showTechnicalDetail={showDetail}
        />
      </div>
    );
  }
}
