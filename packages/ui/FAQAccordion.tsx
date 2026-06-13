"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

export type NetworkFaqItem = {
  id?: string;
  question: string;
  answer: React.ReactNode;
};

export type NetworkFAQAccordionProps = {
  items: readonly NetworkFaqItem[];
  className?: string;
  /** Allow multiple open panels */
  allowMultiple?: boolean;
};

export function NetworkFAQAccordion({ items, className, allowMultiple = false }: NetworkFAQAccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className={cn("divide-y divide-border/40 rounded-2xl border border-border/40 bg-background/20", className)}>
      {items.map((item, idx) => {
        const panelId = item.id ?? `${baseId}-${idx}`;
        const isOpen = open[panelId] ?? false;
        return (
          <div key={panelId} className="px-4 py-3 sm:px-5 sm:py-4">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 text-left"
              aria-expanded={isOpen}
              aria-controls={`${panelId}-content`}
              id={`${panelId}-trigger`}
              onClick={() =>
                setOpen((prev) => {
                  if (allowMultiple) return { ...prev, [panelId]: !prev[panelId] };
                  const next = !prev[panelId];
                  return next ? { [panelId]: true } : {};
                })
              }
            >
              <span className="font-display text-base font-semibold text-foreground">{item.question}</span>
              <ChevronDown
                className={cn("h-5 w-5 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                aria-hidden
              />
            </button>
            <div
              id={`${panelId}-content`}
              role="region"
              aria-labelledby={`${panelId}-trigger`}
              className={cn("grid transition-[grid-template-rows] duration-200", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <div className="pt-3 text-sm leading-relaxed text-muted-foreground">{item.answer}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
