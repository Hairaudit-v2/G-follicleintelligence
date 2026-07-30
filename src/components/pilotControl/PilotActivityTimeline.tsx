"use client";

import { SectionHeader } from "@/src/components/fi-admin/dashboard-ui";
import type { PilotControlActivityItem } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import type { PilotControlPagination } from "@/src/lib/pilotControl/api/pilotControlApiTypes";
import { formatDateTime } from "@/src/lib/pilotControl/ui/pilotControlFormatters";

export function PilotActivityTimeline({
  items,
  pagination,
  preset,
  onPresetChange,
  onPageChange,
}: {
  items: PilotControlActivityItem[];
  pagination: PilotControlPagination | null;
  preset: "today" | "7d" | "30d";
  onPresetChange: (p: "today" | "7d" | "30d") => void;
  onPageChange?: (page: number) => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="pilot-activity-heading">
      <SectionHeader
        id="pilot-activity-heading"
        title="Adoption and activity"
        description="Safe summaries only — no message bodies, clinical free text, or payment instruments. Max 31-day range."
      />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Activity date range">
        {(
          [
            ["today", "Today"],
            ["7d", "7 days"],
            ["30d", "30 days"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => onPresetChange(id)}
            className={`rounded-md px-3 py-1.5 text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              preset === id ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.length === 0 ? (
          <li className="text-sm text-slate-400">No activity events in this range.</li>
        ) : (
          items.map((ev) => (
            <li
              key={ev.eventId}
              className="rounded-lg border border-white/[0.06] bg-[#141C33]/40 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2 text-slate-300">
                <span className="font-medium text-slate-100">{ev.eventType}</span>
                <span>· Actor: {ev.actorType}</span>
                <span>· {formatDateTime(ev.occurredAt)}</span>
              </div>
              <p className="mt-1 text-slate-300">{ev.safeSummary}</p>
              {ev.correlationId ? (
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  {ev.correlationId}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
      {pagination && onPageChange ? (
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage}
            onClick={() => onPageChange(pagination.page - 1)}
            className="rounded border border-white/15 px-2 py-1 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={!pagination.hasNextPage}
            onClick={() => onPageChange(pagination.page + 1)}
            className="rounded border border-white/15 px-2 py-1 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </section>
  );
}
