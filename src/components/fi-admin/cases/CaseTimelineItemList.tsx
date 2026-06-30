"use client";

import type { CaseTimelineItem } from "@/src/lib/cases/caseTimelineTypes";
import { caseTimelineKindLabel } from "@/src/lib/cases/caseTimelineLabels";
import Link from "next/link";

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.slice(0, 16);
  return new Date(t).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CaseTimelineItemList({ items }: { items: CaseTimelineItem[] }) {
  if (items.length === 0) {
    return <p className="text-xs text-gray-500">No timeline entries yet for this patient.</p>;
  }

  return (
    <ol className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="relative rounded border border-white/[0.06] bg-white/[0.03] p-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-100">{it.title}</p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                {caseTimelineKindLabel(it.kind)}
                <span className="text-gray-300"> · </span>
                <span className="font-mono text-[10px]">{it.source}</span>
                {it.is_sensitive ? (
                  <span className="ml-2 rounded bg-amber-400/15 px-1 py-0.5 text-[10px] font-medium text-amber-200">
                    Sensitive
                  </span>
                ) : null}
              </p>
            </div>
            <time className="shrink-0 text-[11px] text-gray-500" dateTime={it.occurred_at}>
              {formatWhen(it.occurred_at)}
            </time>
          </div>
          {it.description ? <p className="mt-2 text-xs text-slate-300">{it.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
            {it.status ? (
              <span>
                Status: <span className="font-medium text-slate-200">{it.status}</span>
              </span>
            ) : null}
            {it.metadata_summary ? (
              <span className="max-w-md truncate">{it.metadata_summary}</span>
            ) : null}
          </div>
          {it.href ? (
            <p className="mt-2 text-right text-[11px]">
              <Link href={it.href} className="text-blue-300 hover:underline">
                Open in CRM
              </Link>
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
