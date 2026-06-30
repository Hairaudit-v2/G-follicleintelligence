"use client";

import { cn } from "@/lib/utils";

export function ConsultationFormSectionNav({
  sections,
  activeSectionId,
  onSelect,
}: {
  sections: { id: string; title: string }[];
  activeSectionId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav aria-label="Form sections" className="flex flex-col gap-1">
      {sections.map((s) => {
        const active = s.id === activeSectionId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={cn(
              "w-full min-h-[44px] touch-manipulation rounded-lg px-3 py-2.5 text-left text-sm font-medium transition",
              active
                ? "bg-sky-600 text-white shadow-sm"
                : "bg-white/[0.06] text-slate-200 hover:bg-white/[0.08] dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            )}
          >
            {s.title}
          </button>
        );
      })}
    </nav>
  );
}
