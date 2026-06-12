import Link from "next/link";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FI_DASHBOARD_HOME_WIDGET_ORDER } from "@/src/config/fiDashboardRegistry";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import type { FiWorkspaceProfileKey } from "@/src/config/fiWorkspaceProfiles";
import { getWorkspaceProfileLabel } from "@/src/config/fiWorkspaceProfiles";
import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicMetrics } from "@/src/components/fi-admin/dashboard/DashboardClinicMetrics";
import { DashboardMyWorkspace } from "@/src/components/fi-admin/dashboard/DashboardMyWorkspace";
import { DashboardOperationalWorkspace } from "@/src/components/fi-admin/dashboard/DashboardOperationalWorkspace";
import { DashboardQuickActionsBar } from "@/src/components/fi-admin/dashboard/DashboardQuickActionsBar";
import { DashboardSurgeryPipeline } from "@/src/components/fi-admin/dashboard/DashboardSurgeryPipeline";
import { DashboardStaffIntelligenceSummary } from "@/src/components/fi-admin/dashboard/DashboardStaffIntelligenceSummary";
import { DashboardWidgetPlaceholder } from "@/src/components/fi-admin/dashboard/DashboardWidgetPlaceholder";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import {
  fiDashboardWidgetVisibleByFeatureAccess,
  filterResolvedQuickActionsByFeatureAccess,
} from "@/src/lib/fi-os/stage2FeatureVisibility";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

function resolveDashboardPlaceholderHref(tenantBase: string, key: FiDashboardWidgetKey): string | null {
  const b = tenantBase.replace(/\/+$/, "");
  switch (key) {
    case "analytics_summary":
      return `${b}/analytics`;
    case "audit_summary":
      return `${b}/audit`;
    case "imaging_summary":
      return `${b}/foundation-integrity`;
    case "pathology_summary":
      return `${b}/cases`;
    case "crm_pipeline":
      return `${b}/crm`;
    case "consultation_queue":
      return `${b}/consultations`;
    case "procedure_day_queue":
      return `${b}/procedure-day`;
    case "follow_up_queue":
      return `${b}/crm`;
    case "imaging_uploads":
      return `${b}/foundation-integrity#fi-os-foundation-media`;
    case "booking_queue":
      return `${b}/calendar`;
    case "staff_intelligence_summary":
      return `${b}/staff`;
    default:
      return null;
  }
}

/**
 * FI OS tenant home — clinic operating centre.
 *
 * Section order follows `homeWidgetOrder` (defaults to `FI_DASHBOARD_HOME_WIDGET_ORDER`).
 */
export function FiOsControlCentreHome(props: {
  data: TenantOperationalDashboard;
  showCrmNav: boolean;
  showBookingsBoard: boolean;
  /** Stage 2: when null, full dashboard (legacy behaviour). */
  featureAccess?: ReadonlyMap<FiFeatureKey, boolean> | null;
  homeWidgetOrder?: readonly FiDashboardWidgetKey[];
  quickActionItems?: readonly ResolvedDashboardQuickAction[];
  /** Stage 3: resolved persona for copy and optional badge (defaults omitted). */
  workspaceProfile?: FiWorkspaceProfileKey;
}) {
  const {
    data,
    showCrmNav,
    showBookingsBoard,
    featureAccess = null,
    homeWidgetOrder,
    quickActionItems,
    workspaceProfile,
  } = props;
  const base = `/fi-admin/${data.tenantId}`;
  const baseResolved = resolveDashboardQuickActions(base, { showCrmNav, showBookingsBoard });
  const resolvedQuick =
    quickActionItems ?? filterResolvedQuickActionsByFeatureAccess(baseResolved, featureAccess);
  const order =
    homeWidgetOrder ??
    FI_DASHBOARD_HOME_WIDGET_ORDER.filter((w) => fiDashboardWidgetVisibleByFeatureAccess(w, featureAccess));

  const readyForSurgeryApprox = Math.max(0, data.launchControl.surgeriesThisWeek - data.actionCentre.surgeryReadinessAlerts);

  const now = new Date();
  const dateLine = new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(now);

  const showCalendarShortcut = !featureAccess || featureAccess.get("calendar") !== false;

  const widgetBody = (key: FiDashboardWidgetKey) => {
    switch (key) {
      case "quick_actions":
        return <DashboardQuickActionsBar items={resolvedQuick} />;
      case "clinic_metrics":
        return <DashboardClinicMetrics base={base} quickStats={data.quickStats} launchControl={data.launchControl} />;
      case "operational_workspace":
        return (
          <DashboardOperationalWorkspace
            tenantId={data.tenantId}
            base={base}
            operationalDay={data.operationalDay}
            agendaByBucket={data.agendaByBucket}
            receptionCards={data.receptionBoard.cards}
          />
        );
      case "surgery_pipeline":
        return (
          <DashboardSurgeryPipeline
            base={base}
            planningProxyCount={data.actionCentre.consultationsAwaitingCompletion}
            readyForSurgeryApprox={readyForSurgeryApprox}
            postOpProxyCount={data.medicationReorderReviewsPending}
            followUpsDue={data.actionCentre.followUpsDue}
          />
        );
      case "my_workspace":
        return (
          <DashboardMyWorkspace
            base={base}
            viewerFiUserId={data.viewerFiUserId}
            tasksDue={data.tasksDue}
            upcomingReminders={data.upcomingReminders}
            workspaceProfile={workspaceProfile}
          />
        );
      case "attention_centre":
        return <DashboardActionCentre base={base} actionCentre={data.actionCentre} showCrmNav={showCrmNav} />;
      case "staff_intelligence_summary":
        return <DashboardStaffIntelligenceSummary tenantBase={base} />;
      case "analytics_summary":
      case "audit_summary":
      case "imaging_summary":
      case "pathology_summary":
      case "crm_pipeline":
      case "consultation_queue":
      case "procedure_day_queue":
      case "follow_up_queue":
      case "imaging_uploads":
      case "booking_queue":
        return (
          <DashboardWidgetPlaceholder widgetKey={key} relatedHref={resolveDashboardPlaceholderHref(base, key)} />
        );
      default: {
        const _exhaustive: never = key;
        return _exhaustive;
      }
    }
  };

  const showWorkspaceBadge = Boolean(workspaceProfile && workspaceProfile !== "default");

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Clinic operating centre</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{data.tenantName}</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
          {showWorkspaceBadge ? (
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">
              Workspace: <span className="text-cyan-400/90">{getWorkspaceProfileLabel(workspaceProfile!)}</span>
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data.canQuickCallIn ? <TenantHomeQuickCallIn tenantId={data.tenantId} /> : null}
          {showCalendarShortcut ? (
            <Link
              href={`${base}/calendar`}
              className={cn(
                fiOsChromeClasses.toolbarControlSurface,
                "inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50",
              )}
            >
              <Calendar className="h-4 w-4 text-cyan-400" aria-hidden />
              Full calendar
            </Link>
          ) : null}
        </div>
      </header>

      {order.map((key) => (
        <div key={key}>{widgetBody(key)}</div>
      ))}
    </div>
  );
}
