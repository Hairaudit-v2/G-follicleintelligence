"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Keyboard, X } from "lucide-react";

import { calendarEaseOut } from "@/lib/calendar/calendarMotion";
import { cn } from "@/lib/utils";

const SHORTCUTS = [
  { keys: ["N"], label: "New appointment" },
  { keys: ["T"], label: "Jump to today" },
  { keys: ["←", "→"], label: "Previous / next period" },
  { keys: ["Shift", "←", "→"], label: "Previous / next column" },
  { keys: ["↑", "↓"], label: "Scroll time grid" },
  { keys: ["1", "2", "3"], label: "Day / 3-day / week" },
  { keys: ["?"], label: "Toggle this panel" },
] as const;

export function CalendarKeyboardHints({
  open,
  onClose,
  className,
}: {
  open: boolean;
  onClose: () => void;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 12 }}
          transition={calendarEaseOut}
          className={cn(
            "fixed bottom-4 left-4 z-50 w-[min(100vw-2rem,18rem)] rounded-2xl border border-slate-200/90 bg-white/95 p-4 shadow-xl backdrop-blur-md",
            className
          )}
          aria-label="Keyboard shortcuts"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Keyboard className="h-4 w-4 text-slate-500" aria-hidden />
              Shortcuts
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close shortcuts"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-2">
            {SHORTCUTS.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-600">{row.label}</span>
                <span className="flex shrink-0 gap-1">
                  {row.keys.map((k) => (
                    <kbd
                      key={k}
                      className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-700"
                    >
                      {k}
                    </kbd>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
