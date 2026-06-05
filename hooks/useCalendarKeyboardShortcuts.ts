"use client";

import { useEffect } from "react";

export type CalendarViewMode = "day" | "3day" | "week" | "month";

export type CalendarKeyboardActions = {
  onNewAppointment?: () => void;
  onToday?: () => void;
  onPreviousPeriod?: () => void;
  onNextPeriod?: () => void;
  onViewChange?: (view: CalendarViewMode) => void;
  onColumnPrevious?: () => void;
  onColumnNext?: () => void;
  onScrollGridUp?: () => void;
  onScrollGridDown?: () => void;
  onToggleShortcutsHelp?: () => void;
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

export function useCalendarKeyboardShortcuts(actions: CalendarKeyboardActions, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key;

      if (key === "?" || (key === "/" && e.shiftKey)) {
        e.preventDefault();
        actions.onToggleShortcutsHelp?.();
        return;
      }

      if (key === "n" || key === "N") {
        e.preventDefault();
        actions.onNewAppointment?.();
        return;
      }

      if (key === "t" || key === "T") {
        e.preventDefault();
        actions.onToday?.();
        return;
      }

      if (key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) actions.onColumnPrevious?.();
        else actions.onPreviousPeriod?.();
        return;
      }

      if (key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) actions.onColumnNext?.();
        else actions.onNextPeriod?.();
        return;
      }

      if (key === "ArrowUp") {
        e.preventDefault();
        actions.onScrollGridUp?.();
        return;
      }

      if (key === "ArrowDown") {
        e.preventDefault();
        actions.onScrollGridDown?.();
        return;
      }

      if (key === "1") {
        e.preventDefault();
        actions.onViewChange?.("day");
        return;
      }

      if (key === "2") {
        e.preventDefault();
        actions.onViewChange?.("3day");
        return;
      }

      if (key === "3") {
        e.preventDefault();
        actions.onViewChange?.("week");
        return;
      }

      if (key === "4") {
        e.preventDefault();
        actions.onViewChange?.("month");
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions, enabled]);
}
