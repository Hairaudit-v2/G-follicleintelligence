import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: number | string;
  /** Optional icon (e.g. lucide), shown in cyan */
  icon?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-4 py-3 shadow-inner shadow-black/20 backdrop-blur-sm",
        className
      )}
    >
      {icon ? (
        <div className="mt-0.5 shrink-0 text-[#22C1FF]" aria-hidden>
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[#F8FAFC] sm:text-[1.75rem]">
          {value}
        </div>
      </div>
    </div>
  );
}
