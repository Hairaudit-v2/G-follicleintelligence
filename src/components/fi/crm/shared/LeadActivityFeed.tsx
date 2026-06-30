"use client";

import type { FiCrmActivityEventRow } from "@/src/lib/crm/types";
import { crmLeadCardClass } from "./crmSharedStyles";

export type LeadActivityFeedProps = {
  events: FiCrmActivityEventRow[];
  limit?: number;
  emptyMessage?: string;
};

export function LeadActivityFeed({
  events,
  limit = 8,
  emptyMessage = "No timeline events yet.",
}: LeadActivityFeedProps) {
  const items = events.slice(0, limit);

  return (
    <section className={crmLeadCardClass}>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Activity</h3>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">{emptyMessage}</p>
      ) : (
        <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
          {items.map((ev) => (
            <li key={ev.id} className="border-l-2 border-white/[0.06] pl-2">
              <span className="text-gray-500">{ev.occurred_at}</span>{" "}
              <span className="font-mono text-slate-400">{ev.activity_kind}</span>
              {ev.title ? <p className="font-medium text-slate-100">{ev.title}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
