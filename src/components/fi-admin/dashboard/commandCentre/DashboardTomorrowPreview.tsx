import Link from "next/link";
import { Sunrise } from "lucide-react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { TomorrowPreviewLine } from "@/src/lib/fiAdmin/dashboardCommandCentreDerive";
import { cn } from "@/lib/utils";

export function DashboardTomorrowPreview(props: {
  base: string;
  lines: readonly TomorrowPreviewLine[];
}) {
  const { base, lines } = props;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="tomorrow-preview-heading">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <SectionHeader
          id="tomorrow-preview-heading"
          kicker="Tomorrow"
          title="Readiness preview"
          description="A brief look ahead — open Tomorrow Board for the full preparation view."
        />
        <Link
          href={`${base}/tomorrow`}
          className={cn(
            fiOsChromeClasses.toolbarControlSurface,
            "inline-flex shrink-0 items-center gap-2 px-3 py-2 text-sm font-semibold text-cyan-50"
          )}
        >
          <Sunrise className="h-4 w-4 text-cyan-400" aria-hidden />
          Open Tomorrow Board
        </Link>
      </div>
      <ul className="mt-4 space-y-2">
        {lines.map((line) => (
          <li
            key={line.id}
            className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-sm text-slate-300"
          >
            {line.text}
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
