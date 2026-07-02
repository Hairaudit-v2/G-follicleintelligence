"use client";

import { useState } from "react";
import { ChevronDown, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  STAFF_UAT_SCREEN_GUIDES,
  type StaffUatScreenKey,
} from "@/src/lib/fiOs/staffUatScreenGuide";
import { useStaffUat } from "./StaffUatContext";

export function StaffUatScreenGuide({ screenKey }: { screenKey: StaffUatScreenKey }) {
  const { enabled } = useStaffUat();
  const [open, setOpen] = useState(true);
  if (!enabled) return null;

  const guide = STAFF_UAT_SCREEN_GUIDES[screenKey];

  return (
    <section
      className="mb-6 rounded-xl border border-violet-500/25 bg-violet-950/20"
      aria-label="UAT screen guide"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-violet-100">
          <Info className="h-4 w-4 shrink-0" aria-hidden />
          UAT guide — what this screen is for
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-violet-300 transition", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-violet-500/15 px-4 pb-4 pt-3 text-sm sm:px-5">
          <p className="text-slate-200">{guide.purpose}</p>
          <p>
            <span className="font-semibold text-cyan-200">Next best action: </span>
            <span className="text-slate-300">{guide.nextBestAction}</span>
          </p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">
              Common mistakes
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-400">
              {guide.commonMistakes.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}