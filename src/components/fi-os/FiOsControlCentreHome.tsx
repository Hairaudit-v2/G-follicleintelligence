import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { getWorkspaceProfileLabel } from "@/src/config/fiWorkspaceProfiles";
import { DashboardClinicalIntelligenceSummary } from "@/src/components/fi-admin/dashboard/DashboardClinicalIntelligenceSummary";
import { DashboardOutcomeIntelligenceSummary } from "@/src/components/fi-admin/dashboard/DashboardOutcomeIntelligenceSummary";
import { DashboardPlatformDevelopmentProgress } from "@/src/components/fi-admin/dashboard/DashboardPlatformDevelopmentProgress";
import { DashboardRecentPlatformReleases } from "@/src/components/fi-admin/dashboard/DashboardRecentPlatformReleases";
import {
  ClinicCommandCentreHeader,
  ClinicSnapshotCards,
  DashboardAttentionPriorities,
  DashboardModuleNavigation,
  DashboardPerformanceKpis,
  DashboardSystemDiagnostics,
  DashboardTodayTimeline,
  DashboardTomorrowPreview,
} from "@/src/components/fi-admin/dashboard/commandCentre";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import {
  buildAttentionPriorities,
  buildClinicSnapshotCards,
  buildPerformanceKpis,
  buildTodayTimeline,
  buildTomorrowPreview,
} from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import { filterResolvedQuickActionsByFeatureAccess } from "@/src/lib/fi-os/stage2FeatureVisibility";
import {
  EMPTY_TENANT_CLINICAL_INTELLIGENCE_SUMMARY,
  type TenantClinicalIntelligenceSummary,
} from "@/src/lib/fi-os/clinicalIntelligence.server";
import {
  EMPTY_TENANT_OUTCOME_INTELLIGENCE_SUMMARY,
  type TenantOutcomeIntelligenceSummary,
} from "@/src/lib/fi-os/outcomeIntelligence.server";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";

/**
 * FI OS tenant home — Clinic Command Center.
 *
 * Consolidated operational overview: snapshot, priorities, timeline, performance,
 * module navigation, and tomorrow preview. Technical platform diagnostics are
 * collapsed and admin-only.
 */
export function FiOsControlCentreHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
  quickActionItems?: readonly ResolvedDashboardQuickAction[];
  workspaceProfile?: FiWorkspaceProfileKey;
  clinicalIntelligenceSummary?: TenantClinicalIntelligenceSummary | null;
  outcomeIntelligenceSummary?: TenantOutcomeIntelligenceSummary | null;
  showSystemDiagnostics?: boolean;
}) {
  const {
    data,
    showCrmNav,
    showBookingsBoard,
    featureAccess = null,
    quickActionItems,
    workspaceProfile,
    clinicalIntelligenceSummary = null,
    outcomeIntelligenceSummary = null,
    showSystemDiagnostics = false,
  } = props;

  const base = `/fi-admin/${data.tenantId}`;
  const baseResolved = resolveDashboardQuickActions(base, { showCrmNav, showBookingsBoard });
  const resolvedQuick =
    quickActionItems ?? filterResolvedQuickActionsByFeatureAccess(baseResolved, featureAccess);

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const showCalendarShortcut = !featureAccess || featureAccess.get("calendar") !== false;
  const showWorkspaceBadge = Boolean(workspaceProfile && workspaceProfile !== "default");

  const snapshotCards = buildClinicSnapshotCards({
    base,
    clinicToday: data.clinicToday,
    receptionCards: data.receptionBoard.cards,
    paymentCommercialKpis: data.paymentCommercialKpis,
    revenueCollections: data.revenueCollections,
    quickStats: data.quickStats,
    actionCentre: data.actionCentre,
  });

  const attentionItems = buildAttentionPriorities({
    base,
    actionCentre: data.actionCentre,
    showCrmNav,
  });

  const timelineEntries = buildTodayTimeline({
    base,
    operationalDay: data.operationalDay,
    agendaByBucket: data.agendaByBucket,
    paymentCommercialKpis: data.paymentCommercialKpis,
  });

  const performanceKpis = buildPerformanceKpis({
    base,
    quickStats: data.quickStats,
    launchControl: data.launchControl,
    actionCentre: data.actionCentre,
    paymentCommercialKpis: data.paymentCommercialKpis,
  });

  const tomorrowLines = buildTomorrowPreview({
    operationalDay: data.operationalDay,
    agendaByBucket: data.agendaByBucket,
    paymentCommercialKpis: data.paymentCommercialKpis,
    now,
  });

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <ClinicCommandCentreHeader
        tenantName={data.tenantName}
        dateLine={dateLine}
        base={base}
        canQuickCallIn={data.canQuickCallIn}
        calendarTimezone={data.operationalDay.calendarTimezone}
        tenantId={data.tenantId}
        showCalendarShortcut={showCalendarShortcut}
        quickActions={resolvedQuick}
        workspaceBadge={showWorkspaceBadge ? getWorkspaceProfileLabel(workspaceProfile!) : null}
      />

      <ClinicSnapshotCards cards={snapshotCards} />

      <DashboardAttentionPriorities items={attentionItems} base={base} />

      <DashboardTodayTimeline entries={timelineEntries} base={base} />

      <DashboardPerformanceKpis kpis={performanceKpis} />

      <DashboardModuleNavigation
        base={base}
        showCrmNav={showCrmNav}
        showBookingsBoard={showBookingsBoard}
      />

      <DashboardTomorrowPreview base={base} lines={tomorrowLines} />

      {showSystemDiagnostics ? (
        <DashboardSystemDiagnostics>
          <DashboardPlatformDevelopmentProgress />
          <DashboardRecentPlatformReleases />
          {clinicalIntelligenceSummary ? (
            <DashboardClinicalIntelligenceSummary
              tenantBase={base}
              summary={clinicalIntelligenceSummary ?? EMPTY_TENANT_CLINICAL_INTELLIGENCE_SUMMARY}
            />
          ) : null}
          {outcomeIntelligenceSummary ? (
            <DashboardOutcomeIntelligenceSummary
              tenantBase={base}
              summary={outcomeIntelligenceSummary ?? EMPTY_TENANT_OUTCOME_INTELLIGENCE_SUMMARY}
            />
          ) : null}
        </DashboardSystemDiagnostics>
      ) : null}
    </div>
  );
}
