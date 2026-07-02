"use client";

import { useState } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { TodayFeedItem } from "@/src/lib/fiOs/todayFeedDerive";

const severityDot: Record<TodayFeedItem["severity"], string> = {
  critical: "bg-red-400",
  warning: "bg-amber-400",
  normal: "bg-sky-400/80",
};

/** Expandable group row for collapsed duplicate events. */
export function TodayFeedGroupRow({ item }: { item: TodayFeedItem }) {
  const [open, setOpen] = useState(false);
  const members = item.groupMembers ?? [];

  if (members.length === 0) {
    return null;
  }

  return (
    <li className="py-3.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 text-left"
        aria-expanded={open}
      >
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", severityDot[item.severity])} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-slate-100">{item.actionLabel}</span>
          {item.detailLine ? (
            <span className="mt-0.5 block text-sm text-slate-500">{item.detailLine}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-xs font-medium text-slate-500">{open ? "Hide" : "Expand"}</span>
      </button>
      {open ? (
        <ul className="ml-5 mt-3 space-y-1 border-l border-white/[0.06] pl-4">
          {members.map((member) => (
            <li key={member.id}>
              <Link
                href={member.href}
                className="block rounded-md py-1.5 text-sm text-slate-300 transition hover:text-slate-100"
              >
                {member.personLabel ? (
                  <>
                    <span className="font-medium">{member.personLabel}</span>
                    {member.detailLine ? (
                      <span className="text-slate-500"> — {member.detailLine}</span>
                    ) : null}
                  </>
                ) : (
                  member.actionLabel
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}
