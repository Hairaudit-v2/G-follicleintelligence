"use client";

import { useEffect, useRef } from "react";

import type { ReceptionOsOperatingMode } from "@/src/lib/receptionOs/receptionOperatingMode";
import { trackReceptionWidgetViewed } from "@/src/components/fi-admin/reception-os/useReceptionOsUsageTracking";

type ReceptionOsWidgetTrackerProps = {
  tenantId: string;
  widgetKey: string;
  operatingMode: ReceptionOsOperatingMode;
  children: React.ReactNode;
};

/** Tracks widget_viewed once per widget key per dashboard session. */
export function ReceptionOsWidgetTracker({
  tenantId,
  widgetKey,
  operatingMode,
  children,
}: ReceptionOsWidgetTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackReceptionWidgetViewed(tenantId, widgetKey, operatingMode);
  }, [tenantId, widgetKey, operatingMode]);

  return <>{children}</>;
}
