"use client";

import Link from "next/link";
import { Calendar, LayoutGrid, MoreHorizontal, Plus, Search } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type FiOsMinimalNavItem,
  type FiOsMinimalNavItemId,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";

function iconFor(id: FiOsMinimalNavItemId) {
  switch (id) {
    case "today":
      return LayoutGrid;
    case "calendar":
      return Calendar;
    case "search":
      return Search;
    case "new":
      return Plus;
    case "more":
      return MoreHorizontal;
  }
}

function MinimalNavButton({
  item,
  active,
  onClick,
  className,
}: {
  item: FiOsMinimalNavItem;
  active?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const Icon = iconFor(item.id);
  const row = cn(
    "group flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition duration-150",
    active
      ? "border-cyan-400/25 bg-cyan-500/[0.16] text-slate-50"
      : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
    className
  );

  if (item.kind === "link") {
    if (item.disabled) {
      return (
        <span className={cn(row, "cursor-not-allowed opacity-60")} title={item.hint}>
          <Icon className="h-5 w-5 shrink-0" aria-hidden />
          <span className="truncate">{item.label}</span>
        </span>
      );
    }

    return (
      <Link
        href={item.href}
        className={row}
        title={item.hint}
        aria-current={active ? "page" : undefined}
        aria-label={item.label}
      >
        <Icon className={cn("h-5 w-5 shrink-0", active ? "text-cyan-300" : "text-slate-500")} aria-hidden />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <button type="button" className={row} onClick={onClick} aria-label={item.label}>
      <Icon className="h-5 w-5 shrink-0 text-slate-500 group-hover:text-slate-300" aria-hidden />
      <span className="truncate">{item.label}</span>
    </button>
  );
}

export function FiOsMinimalNavRail({
  items,
  activeId,
  onSearch,
  onNew,
  onMore,
}: {
  items: FiOsMinimalNavItem[];
  activeId: FiOsMinimalNavItemId | null;
  onSearch: () => void;
  onNew: () => void;
  onMore: () => void;
}) {
  function onAction(id: FiOsMinimalNavItemId) {
    if (id === "search") onSearch();
    if (id === "new") onNew();
    if (id === "more") onMore();
  }

  return (
    <aside className={fiOsChromeClasses.minimalNavRail} aria-label="FI OS primary navigation">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(360px 180px at 0% 0%, rgba(34, 193, 255, 0.08), transparent 55%), radial-gradient(280px 140px at 100% 100%, rgba(124, 58, 237, 0.05), transparent 45%)",
        }}
        aria-hidden
      />
      <nav className="relative flex min-h-0 flex-1 flex-col gap-1 px-2 py-3">
        {items.map((item) => (
          <MinimalNavButton
            key={item.id}
            item={item}
            active={item.kind === "link" && activeId === item.id}
            onClick={item.kind === "action" ? () => onAction(item.id) : undefined}
          />
        ))}
      </nav>
    </aside>
  );
}

export function FiOsMobileBottomNav({
  items,
  activeId,
  onSearch,
  onNew,
  onMore,
}: {
  items: FiOsMinimalNavItem[];
  activeId: FiOsMinimalNavItemId | null;
  onSearch: () => void;
  onNew: () => void;
  onMore: () => void;
}) {
  function onAction(id: FiOsMinimalNavItemId) {
    if (id === "search") onSearch();
    if (id === "new") onNew();
    if (id === "more") onMore();
  }

  return (
    <nav
      className={fiOsChromeClasses.mobileBottomNav}
      aria-label="FI OS mobile navigation"
    >
      {items.map((item) => (
        <MinimalNavButton
          key={item.id}
          item={item}
          active={item.kind === "link" && activeId === item.id}
          onClick={item.kind === "action" ? () => onAction(item.id) : undefined}
          className="min-w-0 flex-1 rounded-lg px-0.5 py-1.5"
        />
      ))}
    </nav>
  );
}
