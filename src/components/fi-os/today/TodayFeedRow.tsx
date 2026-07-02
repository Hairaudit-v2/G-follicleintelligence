import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

import { TodayFeedGroupRow } from "@/src/components/fi-os/today/TodayFeedGroupRow";

const severityDot: Record<TodayFeedItem["severity"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  normal: "bg-sky-400/80",
};

/** P0C — living operational feed row (not a dashboard card). */
export function TodayFeedRow({ item }: { item: TodayFeedItem }) {
  if (item.groupMembers && item.groupMembers.length > 1) {
    return <TodayFeedGroupRow item={item} />;
  }

  const primaryLine = item.personLabel
    ? item.actionLabel.startsWith(firstName(item.personLabel)) ||
      item.actionLabel.startsWith("Call ") ||
      item.actionLabel.startsWith("Follow up")
      ? item.actionLabel
      : `${firstName(item.personLabel)} — ${item.actionLabel}`
    : item.actionLabel;

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot[item.severity])} aria-hidden />
        <div className="min-w-0 flex-1">
          <Link href={item.href} className="group block">
            <span className="block text-sm font-medium text-slate-100 transition group-hover:text-white">
              {primaryLine}
            </span>
            {item.detailLine ? (
              <span className="mt-0.5 block text-sm text-slate-500">{item.detailLine}</span>
            ) : null}
          </Link>
        </div>
        {item.actionHint ? (
          <Link
            href={item.href}
            className="shrink-0 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:border-cyan-500/30 hover:bg-cyan-950/20 hover:text-cyan-200"
          >
            {item.actionHint}
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function firstName(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return "Patient";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}
