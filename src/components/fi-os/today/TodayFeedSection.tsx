import type { ReactNode } from "react";

import { TodayFeedRow } from "@/src/components/fi-os/today/TodayFeedRow";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** P0C — section wrapper for the living operational feed (no dashboard card chrome). */
export function TodayFeedSection(props: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
  items: readonly TodayFeedItem[];
  emptyText: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const { id, kicker, title, description, items, emptyText, footer, children } = props;

  return (
    <section className="space-y-1" role="region" aria-labelledby={id}>
      <div className="pb-2">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">{kicker}</p>
        <h2 id={id} className="mt-1 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
          {title}
        </h2>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>

      {children ?? (
        items.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => (
              <TodayFeedRow key={item.id} item={item} />
            ))}
          </ul>
        )
      )}
      {footer}
    </section>
  );
}
