"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

export function DashboardSystemDiagnostics(props: { children: ReactNode }) {
  const { children } = props;

  return (
    <DashboardCard className="overflow-hidden p-0" role="region" aria-labelledby="system-diagnostics-heading">
      <details className="group">
        <summary
          className={cn(
            "flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 sm:px-5",
            "[&::-webkit-details-marker]:hidden",
          )}
        >
          <div>
            <SectionHeader
              id="system-diagnostics-heading"
              kicker="Platform"
              title="System diagnostics"
              description="For platform operators only. These checks support platform integrity and do not affect day-to-day clinic operations."
            />
          </div>
          <ChevronDown
            className="h-5 w-5 shrink-0 text-slate-500 transition group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="space-y-4 border-t border-white/[0.07] px-4 py-4 sm:px-5 sm:py-5">{children}</div>
      </details>
    </DashboardCard>
  );
}
