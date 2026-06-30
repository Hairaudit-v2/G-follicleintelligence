import Link from "next/link";

import type { FiDashboardWidgetKey } from "@/src/config/fiDashboardRegistry";
import { FI_DASHBOARD_WIDGET_LABELS } from "@/src/config/fiDashboardRegistry";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

type Props = {
  widgetKey: FiDashboardWidgetKey;
  /** Optional absolute path (may include `#hash`). */
  relatedHref?: string | null;
};

/**
 * Stage 3 lightweight shell for dashboard modules that do not yet have dedicated loaders.
 */
export function DashboardWidgetPlaceholder(props: Props) {
  const { widgetKey, relatedHref } = props;
  const meta = FI_DASHBOARD_WIDGET_LABELS[widgetKey];
  const href = relatedHref?.trim() || null;

  return (
    <DashboardCard
      className="p-4 sm:p-5"
      role="region"
      aria-labelledby={`dash-ph-${widgetKey}-heading`}
    >
      <SectionHeader
        id={`dash-ph-${widgetKey}-heading`}
        kicker="Coming into focus"
        title={meta.title}
        description={meta.description}
      />
      <p className="mt-3 text-xs text-slate-500">
        Data will appear as this workflow becomes active in your clinic. The module stays read-only
        until live signals are wired — nothing here changes permissions or routing.
      </p>
      {href ? (
        <p className="mt-3">
          <Link
            href={href}
            className="text-sm font-semibold text-cyan-400/90 underline-offset-2 hover:underline"
          >
            Open related area
          </Link>
        </p>
      ) : null}
    </DashboardCard>
  );
}
