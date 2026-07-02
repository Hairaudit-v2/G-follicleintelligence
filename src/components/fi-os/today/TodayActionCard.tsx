import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

const severityTone: Record<TodayFeedItem["severity"], { row: string; dot: string }> = {
  critical: {
    row: "border-red-400/35 bg-red-950/35 hover:border-red-300/50 hover:bg-red-950/45",
    dot: "bg-red-400",
  },
  warning: {
    row: "border-orange-400/35 bg-orange-950/25 hover:border-orange-300/45 hover:bg-orange-950/35",
    dot: "bg-orange-400",
  },
  normal: {
    row: "border-sky-500/20 bg-sky-950/20 hover:border-cyan-400/35 hover:bg-cyan-950/25",
    dot: "bg-sky-400",
  },
};

/** One named human task or aggregate fallback item on the Today surface. */
export function TodayActionCard({ item }: { item: TodayFeedItem }) {
  const tone = severityTone[item.severity];

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3 py-3 transition sm:px-4",
        tone.row
      )}
    >
      <span className={cn("h-2 w-2 shrink-0 rounded-full", tone.dot)} aria-hidden />
      <span className="min-w-0 flex-1 truncate text-sm">
        {item.personLabel ? (
          <>
            <span className="font-semibold text-slate-100">{item.personLabel}</span>{" "}
            <span className="text-slate-400">— {item.actionLabel}</span>
          </>
        ) : (
          <span className="font-medium text-slate-200">{item.actionLabel}</span>
        )}
      </span>
    </Link>
  );
}
