import type { ReactNode } from "react";

export function SystemStatusMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border border-gray-100 bg-gray-50/80 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-gray-900">{value}</div>
    </div>
  );
}
