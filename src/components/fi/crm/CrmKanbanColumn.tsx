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
      className={`flex min-h-[12rem] min-w-0 flex-1 flex-col rounded-lg border bg-gray-50/80 lg:min-w-[17rem] ${
        isDropActive ? "border-blue-400 bg-blue-50/60 ring-2 ring-blue-200" : "border-gray-200"
      }`}
    >
      <header className="sticky top-0 z-[1] flex items-center justify-between gap-2 border-b border-gray-200 bg-gray-50/95 px-3 py-2 backdrop-blur-sm">
        <h2 className="truncate text-sm font-semibold text-gray-900">{title}</h2>
        <span className="shrink-0 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-800">{count}</span>
      </header>
      <div className="flex flex-1 flex-col gap-2 p-2">{children}</div>
    </section>
  );
}
