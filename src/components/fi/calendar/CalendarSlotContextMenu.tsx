"use client";

import { useEffect, useRef } from "react";

import { fiSurfaceVariantClassNames } from "@/src/components/fi-design/fiDesignTokens";
import { cn } from "@/lib/utils";

export type CalendarSlotContextMenuItem = {
  id: string;
  label: string;
  onSelect: () => void;
};

export function CalendarSlotContextMenu({
  open,
  x,
  y,
  items,
  onClose,
}: {
  open: boolean;
  x: number;
  y: number;
  items: CalendarSlotContextMenuItem[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent | PointerEvent) => {
      const el = ref.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };
    window.addEventListener("pointerdown", onPointer, true);
    return () => window.removeEventListener("pointerdown", onPointer, true);
  }, [open, onClose]);

  if (!open) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const menuW = 200;
  const menuH = items.length * 40 + 16;
  const left = Math.min(x, vw - menuW - 8);
  const top = Math.min(y, vh - menuH - 8);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Calendar slot actions"
      className={cn(
        fiSurfaceVariantClassNames.darkGlass,
        "fixed z-[122] min-w-[11.5rem] py-1.5 text-sm text-slate-100 shadow-2xl"
      )}
      style={{ left, top }}
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="menuitem"
          className="flex w-full items-center px-3 py-2 text-left text-sm text-slate-100 transition hover:bg-white/[0.06]"
          onClick={() => {
            item.onSelect();
            onClose();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
