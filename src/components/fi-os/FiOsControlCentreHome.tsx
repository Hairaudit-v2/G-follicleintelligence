import Link from "next/link";
import { Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FI_DASHBOARD_HOME_WIDGET_ORDER } from "@/src/config/fiDashboardRegistry";
import type { FiFeatureKey } from "@/src/config/fiFeatureAccessRegistry";
import { DashboardActionCentre } from "@/src/components/fi-admin/dashboard/DashboardActionCentre";
import { DashboardClinicMetrics } from "@/src/components/fi-admin/dashboard/DashboardClinicMetrics";
import { DashboardMyWorkspace } from "@/src/components/fi-admin/dashboard/DashboardMyWorkspace";
import { DashboardOperationalWorkspace } from "@/src/components/fi-admin/dashboard/DashboardOperationalWorkspace";
import { DashboardQuickActionsBar } from "@/src/components/fi-admin/dashboard/DashboardQuickActionsBar";
import { DashboardSurgeryPipeline } from "@/src/components/fi-admin/dashboard/DashboardSurgeryPipeline";
import { TenantHomeQuickCallIn } from "@/src/components/fi-admin/TenantHomeQuickCallIn";
import type { ResolvedDashboardQuickAction } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import { resolveDashboardQuickActions } from "@/src/lib/fiAdmin/dashboardQuickActionsConfig";
import {
  fiDashboardWidgetVisibleByFeatureAccess,
  filterResolvedQuickActionsByFeatureAccess,
} from "@/src/lib/fi-os/stage2FeatureVisibility";
import type { TenantOperationalDashboard } from "@/src/lib/fiOs/tenantOperationalDashboardLoader.server";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

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
}) {
  const { data, showCrmNav, showBookingsBoard, featureAccess = null, homeWidgetOrder, quickActionItems } = props;
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
          />
        );
      case "attention_centre":
        return <DashboardActionCentre base={base} actionCentre={data.actionCentre} showCrmNav={showCrmNav} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 pb-8 sm:space-y-7">
      <header className="flex flex-col gap-3 border-b border-white/[0.07] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400/85">Clinic operating centre</p>
          <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">{data.tenantName}</h1>
          <p className="mt-1 text-sm text-slate-500">{dateLine}</p>
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
