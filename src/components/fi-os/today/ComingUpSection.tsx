import { TodayFeedRow } from "@/src/components/fi-os/today/TodayFeedRow";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

/** Collapsed by default — later-today/tomorrow preview, not urgent enough to compete for attention. */
export function ComingUpSection({ items }: { items: readonly TodayFeedItem[] }) {
  return (
    <section className="space-y-1" role="region" aria-labelledby="today-coming-up-heading">
      <details className="group">
        <summary className="cursor-pointer list-none pb-2 [&::-webkit-details-marker]:hidden">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-slate-500">Coming up</p>
          <h2 id="today-coming-up-heading" className="mt-1 text-base font-semibold tracking-tight text-slate-100 sm:text-lg">
            Later and tomorrow{items.length > 0 ? ` (${items.length})` : ""}
          </h2>
          <p className="mt-1 text-sm text-slate-500">Preview only — nothing here needs action yet.</p>
        </summary>
        {items.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">Nothing else scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06]">
            {items.map((item) => (
              <TodayFeedRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </details>
    </section>
  );
}
