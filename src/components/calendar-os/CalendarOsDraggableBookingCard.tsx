"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

import { CalendarOsBookingCard } from "@/src/components/calendar-os/CalendarOsBookingCard";
import type { CalendarOsBookingCardModel } from "@/src/lib/calendar-os/calendarBookingCardModel";
import { cn } from "@/lib/utils";

export type CalendarOsDraggableBookingCardProps = {
  model: CalendarOsBookingCardModel;
  bookingId: string;
  draggable: boolean;
  compact?: boolean;
  ultraCompact?: boolean;
  showHoverDetail?: boolean;
  onSelect?: () => void;
  highlighted?: boolean;
  isPendingSave?: boolean;
};

export function CalendarOsDraggableBookingCard({
  model,
  bookingId,
  draggable,
  compact,
  ultraCompact,
  showHoverDetail,
  onSelect,
  highlighted,
  isPendingSave,
}: CalendarOsDraggableBookingCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: bookingId,
    disabled: !draggable,
    data: { bookingId, model },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 20 : undefined,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={draggable ? "calendar-booking-drag-handle" : undefined}
      className={cn(
        "h-full",
        draggable && "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-60",
        isPendingSave && "opacity-70"
      )}
      {...(draggable ? listeners : {})}
      {...(draggable ? attributes : {})}
    >
      <CalendarOsBookingCard
        model={model}
        compact={compact}
        ultraCompact={ultraCompact}
        showHoverDetail={showHoverDetail}
        onSelect={onSelect}
        highlighted={highlighted}
        draggable={draggable}
      />
    </div>
  );
}
