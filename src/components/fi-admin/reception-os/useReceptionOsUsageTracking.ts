"use client";

import { useEffect, useRef } from "react";

import { trackReceptionUsageEventAction } from "@/lib/actions/fi-reception-pilot-actions";
import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";

type UseReceptionOsUsageTrackingOptions = {
  tenantId: string;
  operatingMode: ReceptionOsOperatingMode;
  enabled?: boolean;
};

/**
 * Fire dashboard_viewed once per mount. Failures are swallowed — tracking must not break the UI.
 */
export function useReceptionOsDashboardViewTracking(opts: UseReceptionOsUsageTrackingOptions): void {
  const fired = useRef(false);
  const { tenantId, operatingMode, enabled = true } = opts;

  useEffect(() => {
    if (!enabled || fired.current || !tenantId.trim()) return;
    fired.current = true;
    void trackReceptionUsageEventAction(tenantId, {
      eventKind: "dashboard_viewed",
      context: { operatingMode },
    }).catch(() => undefined);
  }, [enabled, tenantId, operatingMode]);
}

export function trackReceptionWidgetViewed(
  tenantId: string,
  widgetKey: string,
  operatingMode: ReceptionOsOperatingMode,
): void {
  if (!tenantId.trim() || !widgetKey.trim()) return;
  void trackReceptionUsageEventAction(tenantId, {
    eventKind: "widget_viewed",
    context: { widgetKey, operatingMode },
  }).catch(() => undefined);
}

export function trackReceptionRefreshFailed(
  tenantId: string,
  operatingMode: ReceptionOsOperatingMode,
  metadata?: Record<string, unknown>,
): void {
  if (!tenantId.trim()) return;
  void trackReceptionUsageEventAction(tenantId, {
    eventKind: "refresh_failed",
    context: { operatingMode, metadata },
  }).catch(() => undefined);
}
