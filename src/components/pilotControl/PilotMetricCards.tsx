"use client";

import { StatCard } from "@/src/components/fi-admin/dashboard-ui";
import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PilotControlOverview } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { buildOverviewMetricCards } from "@/src/lib/pilotControl/ui/pilotControlMetrics";
import { READINESS_DISTRIBUTION_DISCLAIMER } from "@/src/lib/pilotControl/ui/pilotControlUiConstants";

export function PilotMetricCards({ overview }: { overview: PilotControlOverview }) {
  const cards = buildOverviewMetricCards(overview);
  return (
    <section className="space-y-3" aria-labelledby="pilot-metrics-heading">
      <SectionHeader
        id="pilot-metrics-heading"
        title="Executive metrics"
        description={READINESS_DISTRIBUTION_DISCLAIMER}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <div key={c.key} title={c.tooltip}>
            <StatCard
              label={c.approximate ? `${c.label} (approx.)` : c.label}
              value={c.value}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
