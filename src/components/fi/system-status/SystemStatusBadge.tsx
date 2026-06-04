import type { ReactNode } from "react";

import type { TrafficLight } from "@/src/lib/systemStatus/systemStatusTypes";

const styles: Record<TrafficLight, string> = {
  green: "bg-emerald-100 text-emerald-900 ring-emerald-600/20",
  amber: "bg-amber-100 text-amber-900 ring-amber-600/20",
  red: "bg-rose-100 text-rose-900 ring-rose-600/20",
};

export function SystemStatusBadge({
  traffic,
  children,
}: {
  traffic: TrafficLight;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[traffic]}`}
    >
      {children}
    </span>
  );
}
