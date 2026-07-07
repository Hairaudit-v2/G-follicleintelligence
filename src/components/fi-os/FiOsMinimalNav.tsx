"use client";

import Link from "next/link";
import {
  BarChart3,
  Calendar,
  LayoutGrid,
  Loader2,
  MoreHorizontal,
  Users,
  UsersRound,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  type FiOsMinimalNavItem,
  type FiOsMinimalNavItemId,
} from "@/src/lib/fiAdmin/fiOsMinimalNav";
import { TenantBrandMark } from "@/src/components/brand/TenantBrandMark";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import type { NormalizedTenantBranding } from "@/src/lib/fi/foundation/tenantBrandingCore";
import {
  FI_OS_NAV_PENDING_ATTR,
  useFiOsNavigationPending,
} from "@/src/components/fi-os/FiOsNavigationPendingProvider";

function iconFor(id: FiOsMinimalNavItemId) {
  switch (id) {
    case "today":
      return LayoutGrid;
    case "calendar":
      return Calendar;
    case "patients":
      return Users;
    case "team":
      return UsersRound;
    case "reports":
      return BarChart3;
    case "more":
      return MoreHorizontal;
  }
}

function MinimalNavButton({
  item,
  active,
  onClick,
  className,
  navPending,
}: {
  item: FiOsMinimalNavItem;
  active?: boolean;
  onClick?: () => void;
  className?: string;
  navPending?: boolean;
}) {
  const Icon = iconFor(item.id);
  const row = cn(
    "group flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold transition duration-150",
    active
      ? "fi-tenant-nav-active text-slate-50"
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
        aria-busy={navPending || undefined}
        aria-label={item.label}
        {...{ [FI_OS_NAV_PENDING_ATTR]: item.id }}
      >
        {navPending ? (
          <Loader2
            className="fi-tenant-accent-text h-5 w-5 shrink-0 motion-safe:animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : (
          <Icon
            className={cn(
              "h-5 w-5 shrink-0",
              active ? "fi-tenant-accent-text" : "text-slate-500"
            )}
            aria-hidden
          />
        )}
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

function FiOsMinimalNavBrandBlock({
  branding,
  brandName,
}: {
  branding: NormalizedTenantBranding;
  brandName: string;
}) {
  return (
    <div
      className="fi-tenant-card-accent mb-2 flex shrink-0 flex-col items-center gap-1.5 border-b border-white/[0.06] px-1.5 pb-2.5 pt-2"
      style={{ backgroundColor: "var(--fi-tenant-brand-bg)" }}
    >
      <TenantBrandMark branding={branding} size="sm" />
      <p
        className="w-full truncate text-center text-[9px] font-semibold leading-tight text-slate-300"
        title={brandName}
      >
        {brandName}
      </p>
    </div>
  );
}

export function FiOsMinimalNavRail({
  items,
  activeId,
  onMore,
  branding,
  brandName,
}: {
  items: FiOsMinimalNavItem[];
  activeId: FiOsMinimalNavItemId | null;
  onMore: () => void;
  branding: NormalizedTenantBranding;
  brandName: string;
}) {
  const { pendingNavId } = useFiOsNavigationPending();

  function onAction(id: FiOsMinimalNavItemId) {
    if (id === "more") onMore();
  }

  return (
    <aside className={fiOsChromeClasses.minimalNavRail} aria-label="FI OS primary navigation">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(360px 180px at 0% 0%, color-mix(in srgb, var(--fi-tenant-accent) 12%, transparent), transparent 55%), radial-gradient(280px 140px at 100% 100%, rgba(124, 58, 237, 0.05), transparent 45%)",
        }}
        aria-hidden
      />
      <FiOsMinimalNavBrandBlock branding={branding} brandName={brandName} />
      <nav className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-2 py-1 [overflow-scrolling:touch]">
        {items.map((item) => (
          <MinimalNavButton
            key={item.id}
            item={item}
            active={item.kind === "link" && activeId === item.id}
            navPending={item.kind === "link" && pendingNavId === item.id}
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
  onMore,
}: {
  items: FiOsMinimalNavItem[];
  activeId: FiOsMinimalNavItemId | null;
  onMore: () => void;
}) {
  const { pendingNavId } = useFiOsNavigationPending();

  function onAction(id: FiOsMinimalNavItemId) {
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
          navPending={item.kind === "link" && pendingNavId === item.id}
          onClick={item.kind === "action" ? () => onAction(item.id) : undefined}
          className="min-w-0 flex-1 rounded-lg px-0.5 py-1.5"
        />
      ))}
    </nav>
  );
}
