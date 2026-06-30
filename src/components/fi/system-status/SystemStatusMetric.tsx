import type { ReactNode } from "react";

export function SystemStatusMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-0.5 text-sm font-medium text-slate-100">{value}</div>
    </div>
  );
}
