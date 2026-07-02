import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { TodayActionCard } from "@/src/components/fi-os/today/TodayActionCard";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** Collapsed by default — later-today/tomorrow preview, not urgent enough to compete for attention. */
export function ComingUpSection({ items }: { items: readonly TodayFeedItem[] }) {
  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby="today-coming-up-heading">
      <details>
        <summary className="cursor-pointer list-none">
          <SectionHeader
            id="today-coming-up-heading"
            kicker="Coming up"
            title={`Later and tomorrow${items.length > 0 ? ` (${items.length})` : ""}`}
            description="Preview only — nothing here needs action yet."
          />
        </summary>
        {items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-slate-500">
            Nothing else scheduled yet.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => (
              <TodayActionCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </details>
    </DashboardCard>
  );
}
