import type { ReactNode } from "react";

import type { TrafficLight } from "@/src/lib/systemStatus/systemStatusTypes";

const styles: Record<TrafficLight, string> = {
  green: "bg-emerald-500/15 text-emerald-300 ring-emerald-600/20",
  amber: "bg-amber-400/15 text-amber-200 ring-amber-600/20",
  red: "bg-rose-500/15 text-rose-300 ring-rose-600/20",
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
