"use client";

import type { ReactNode } from "react";

export function CrmKanbanColumn({
  title,
  count,
  isDropActive,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  title: string;
  count: number;
  isDropActive: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  children: ReactNode;
}) {
  return (
    <section
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex min-h-[12rem] min-w-0 flex-1 flex-col rounded-lg border bg-white/[0.03] lg:min-w-[17rem] ${
        isDropActive ? "border-blue-400 bg-blue-500/10 ring-2 ring-blue-200" : "border-white/[0.08]"
      }`}
    >
      <header className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-white/[0.08] bg-white/[0.03] px-3 py-2 backdrop-blur-sm">
        <h2 className="truncate text-sm font-semibold text-slate-100">{title}</h2>
        <span className="shrink-0 rounded-full bg-white/[0.08] px-2 py-0.5 text-xs font-medium text-slate-200">
          {count}
        </span>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}
