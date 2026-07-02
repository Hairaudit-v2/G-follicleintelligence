import type { ReactNode } from "react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import { TodayActionCard } from "@/src/components/fi-os/today/TodayActionCard";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** Shared list/empty-state rendering used by RightNowSection / UpNextSection / ComingUpSection. */
export function TodayFeedItemList(props: {
  id: string;
  kicker: string;
  title: string;
  description: string;
  items: readonly TodayFeedItem[];
  emptyText: string;
  footer?: ReactNode;
}) {
  const { id, kicker, title, description, items, emptyText, footer } = props;

  return (
    <DashboardCard className="p-4 sm:p-5" role="region" aria-labelledby={id}>
      <SectionHeader id={id} kicker={kicker} title={title} description={description} />
      {items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-5 text-sm text-slate-500">
          {emptyText}
        </p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <TodayActionCard key={item.id} item={item} />
          ))}
        </div>
      )}
      {footer}
    </DashboardCard>
  );
}
