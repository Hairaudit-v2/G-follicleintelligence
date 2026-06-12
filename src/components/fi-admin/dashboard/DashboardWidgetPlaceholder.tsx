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
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby={`dash-ph-${widgetKey}-heading`}>
      <SectionHeader
        id={`dash-ph-${widgetKey}-heading`}
        kicker="Preview"
        title={meta.title}
        description={meta.description}
      />
      <p className="mt-3 text-xs text-slate-500">
        This module is profile-suggested in Stage 3. Rich data and routing will tighten in Stage 4 — today it is a safe,
        read-only placeholder.
      </p>
      {href ? (
        <p className="mt-3">
          <Link href={href} className="text-sm font-semibold text-cyan-400/90 underline-offset-2 hover:underline">
            Open related area
          </Link>
        </p>
      ) : null}
    </DashboardCard>
  );
}
