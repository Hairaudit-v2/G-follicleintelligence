"use client";

import { useDroppable } from "@dnd-kit/core";
import type { ReactNode } from "react";

import { calendarOsWeekDropId } from "@/src/lib/calendar-os/calendarOsBookingInteractionCore";
import { providerColumnDropId } from "@/components/calendar/ProviderColumn";
import { cn } from "@/lib/utils";

export function CalendarOsDayColumnDropZone({
  dayKey,
  columnId,
  heightPx,
  className,
  children,
}: {
  dayKey: string;
  columnId: string;
  heightPx: number;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: providerColumnDropId(dayKey, columnId),
    data: { dayKey, columnId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "ring-1 ring-inset ring-cyan-400/40")}
      style={{ height: heightPx }}
      data-testid="calendar-drop-zone"
      data-calendar-drop-day={dayKey}
      data-calendar-drop-column={columnId}
    >
      {children}
    </div>
  );
}

export function CalendarOsWeekCellDropZone({
  dayKey,
  resourceId,
  className,
  children,
}: {
  dayKey: string;
  resourceId: string;
  className?: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: calendarOsWeekDropId(dayKey, resourceId),
    data: { dayKey, resourceId },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(className, isOver && "ring-1 ring-inset ring-cyan-400/35")}
      data-testid="calendar-drop-zone"
      data-calendar-drop-day={dayKey}
      data-calendar-drop-resource={resourceId}
    >
      {children}
    </div>
  );
}
