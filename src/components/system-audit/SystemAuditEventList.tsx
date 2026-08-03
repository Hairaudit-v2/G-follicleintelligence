"use client";

import type { SystemAuditEventRow } from "@/src/lib/systemAudit/systemAuditTypes";
import { SYSTEM_AUDIT_ACTION_LABELS, isSystemAuditAction } from "@/src/lib/systemAudit/systemAuditTypes";
import { cn } from "@/lib/utils";

function actionLabel(action: string): string {
  if (isSystemAuditAction(action)) return SYSTEM_AUDIT_ACTION_LABELS[action];
  return action;
}

export function SystemAuditEventList({
  events,
  emptyMessage = "No audit events yet.",
  compact = false,
}: {
  events: SystemAuditEventRow[];
  emptyMessage?: string;
  compact?: boolean;
}) {
  if (!events.length) {
    return (
      <div className="rounded-xl border border-dashed border-white/[0.12] p-8 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={cn("divide-y divide-white/[0.06]", compact ? "text-sm" : "")} data-testid="system-audit-list">
      {events.map((ev) => (
        <li key={ev.id} className="px-1 py-3 first:pt-0 last:pb-0">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-100">{ev.summary}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                <span className="text-cyan-300/90">{actionLabel(ev.action)}</span>
                {" · "}
                {ev.entity_type}
                {ev.entity_id ? ` · ${ev.entity_id.slice(0, 8)}…` : ""}
                {ev.actor_type ? ` · ${ev.actor_type}` : ""}
                {ev.actor_role ? ` (${ev.actor_role})` : ""}
              </p>
            </div>
            <time
              dateTime={ev.occurred_at}
              className="shrink-0 font-mono text-[11px] tabular-nums text-slate-500"
            >
              {new Date(ev.occurred_at).toLocaleString()}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}
