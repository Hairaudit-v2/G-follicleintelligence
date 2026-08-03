"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Dna,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LineChart,
  Loader2,
  MessageSquare,
  Microscope,
  PieChart,
  Settings2,
  Stethoscope,
  Users,
  UserCog,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { FiOsPrimarySidebarItem } from "@/src/lib/fiAdmin/fiOsShellPrimaryNav";
import type { FiOsSidebarWorkflowSection } from "@/src/lib/fi-os/fiOsSidebarWorkflow";
import type { FiOsD6gWorkflowGroupId } from "@/src/lib/fiOs/navigation/fiOsNavigationRegroupingCore";
import {
  buildNavExpandedGroupsStorageKey,
  mergeExpandedNavGroups,
  parsePersistedExpandedNavGroups,
  resolveActiveWorkflowGroupForNav,
  serializeExpandedNavGroups,
  toggleNavGroupExpansion,
  workflowGroupHasActiveRoute,
} from "@/src/lib/fiOs/navigation/fiOsNavigationCompactCore";
import { fiOsChromeClasses } from "@/src/components/fi-os/fiOsChromeTokens";
import {
  FI_OS_NAV_PENDING_ATTR,
  useFiOsNavigationPending,
} from "@/src/components/fi-os/FiOsNavigationPendingProvider";

function iconFor(id: string) {
  switch (id) {
    case "dashboard":
      return LayoutDashboard;
    case "inbox":
      return Inbox;
    case "calendar":
      return Calendar;
    case "patients":
      return Users;
    case "crm":
    case "follow-up-queue":
      return id === "follow-up-queue" ? MessageSquare : PieChart;
    case "cases":
      return Briefcase;
    case "patient-twin":
      return Dna;
    case "pathology-nav":
      return Microscope;
    case "auditos":
      return ClipboardCheck;
    case "academyos":
      return GraduationCap;
    case "analytics":
      return LineChart;
    case "settings":
      return Settings2;
    case "staff":
      return UserCog;
    case "doctor-workspace":
      return Stethoscope;
    default:
      return LayoutDashboard;
  }
}

function normalizePath(p: string): string {
  const t = p.replace(/\/+$/, "");
  return t.length === 0 ? "/" : t;
}

function RowLink(props: {
  item: FiOsPrimarySidebarItem;
  activeId: string | null;
  pathname: string;
  onNavigate?: () => void;
  dense?: boolean;
  pendingNavId: string | null;
}) {
  const { item, activeId, pathname, onNavigate, dense, pendingNavId } = props;
  const Icon = iconFor(item.id);
  const active = !item.disabled && activeId === item.id;
  const navPending = pendingNavId === item.id;
  const row = cn(
    "group relative flex shrink-0 items-center gap-2.5 rounded-lg border px-2.5 text-[13px] font-medium transition duration-150",
    dense ? "py-1.5" : "py-2",
    item.disabled
      ? "cursor-not-allowed border-transparent text-slate-600"
      : active
        ? "border-transparent text-slate-50 fi-tenant-nav-active"
        : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
  );

  const path = pathname ?? "";
  const sub = item.subItems?.length
    ? item.subItems.map((subItem) => {
        const subActive = normalizePath(path) === normalizePath(subItem.href);
        return (
          <Link
            key={subItem.id}
            href={subItem.href}
            onClick={onNavigate}
            aria-current={subActive ? "page" : undefined}
            {...{ [FI_OS_NAV_PENDING_ATTR]: subItem.id }}
            className={cn(
              "ml-6 block rounded-md border border-transparent py-1 pl-2 pr-2 text-[12px] font-medium transition",
              subActive
                ? "fi-tenant-nav-sub-active text-slate-100"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200"
            )}
          >
            {subItem.label}
          </Link>
        );
      })
    : null;

  if (item.disabled) {
    return (
      <span key={item.id} className={row} title={item.hint}>
        <Icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-50" aria-hidden />
        <span className="min-w-0 flex-1 leading-snug break-words">{item.label}</span>
      </span>
    );
  }

  return (
    <div key={item.id} className="flex flex-col gap-0.5">
      <Link
        href={item.href}
        className={row}
        title={item.hint}
        aria-current={active ? "page" : undefined}
        aria-busy={navPending || undefined}
        onClick={onNavigate}
        {...{ [FI_OS_NAV_PENDING_ATTR]: item.id }}
      >
        <Icon
          className={cn(
            "h-[1.125rem] w-[1.125rem] shrink-0",
            active ? "fi-tenant-accent-text" : "text-slate-500 group-hover:text-slate-300"
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 leading-snug break-words">{item.label}</span>
        {item.badgeCount != null && item.badgeCount > 0 && !navPending ? (
          <span
            className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-cyan-200"
            aria-label={`${item.badgeCount} pending`}
          >
            {item.badgeCount > 99 ? "99+" : item.badgeCount}
          </span>
        ) : null}
        {navPending ? (
          <Loader2
            className="h-3.5 w-3.5 shrink-0 text-cyan-300 motion-safe:animate-spin motion-reduce:animate-none"
            aria-hidden
          />
        ) : null}
      </Link>
      {sub}
    </div>
  );
}

function useCompactNavExpandedGroups({
  compactExpandable,
  storageKey,
  activeGroupId,
}: {
  compactExpandable: boolean;
  storageKey: string | null;
  activeGroupId: FiOsD6gWorkflowGroupId | null;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<FiOsD6gWorkflowGroupId>>(() => {
    if (!compactExpandable || !storageKey || typeof window === "undefined") {
      return activeGroupId ? new Set([activeGroupId]) : new Set();
    }
    try {
      const persisted = parsePersistedExpandedNavGroups(window.localStorage.getItem(storageKey));
      return mergeExpandedNavGroups(persisted, activeGroupId);
    } catch {
      return activeGroupId ? new Set([activeGroupId]) : new Set();
    }
  });

  useEffect(() => {
    if (!compactExpandable) return;
    setExpandedGroups((prev) => mergeExpandedNavGroups(prev, activeGroupId));
  }, [compactExpandable, activeGroupId]);

  useEffect(() => {
    if (!compactExpandable || !storageKey || typeof window === "undefined") return;
    try {
      const persisted = parsePersistedExpandedNavGroups(window.localStorage.getItem(storageKey));
      setExpandedGroups(mergeExpandedNavGroups(persisted, activeGroupId));
    } catch {
      /* ignore */
    }
  }, [compactExpandable, storageKey, activeGroupId]);

  const toggleGroup = useCallback(
    (groupId: FiOsD6gWorkflowGroupId) => {
      setExpandedGroups((prev) => {
        const next = toggleNavGroupExpansion(prev, groupId);
        if (storageKey && typeof window !== "undefined") {
          try {
            window.localStorage.setItem(storageKey, serializeExpandedNavGroups(next));
          } catch {
            /* ignore */
          }
        }
        return next;
      });
    },
    [storageKey]
  );

  return { expandedGroups, toggleGroup };
}

export function FiOsModuleNav({
  sections,
  activeId,
  pathname,
  onNavigate,
  dense,
  className,
  compactExpandable = false,
  navPersistenceScope,
}: {
  sections: FiOsSidebarWorkflowSection[];
  activeId: string | null;
  pathname?: string;
  onNavigate?: () => void;
  dense?: boolean;
  className?: string;
  /** Collapsed workflow groups with click-to-expand (desktop rail + All areas drawer). */
  compactExpandable?: boolean;
  navPersistenceScope?: { tenantId: string; userEmail?: string | null };
}) {
  const path = pathname ?? "";
  const { pendingNavId } = useFiOsNavigationPending();
  const activeGroupId = useMemo(() => resolveActiveWorkflowGroupForNav(activeId), [activeId]);
  const storageKey = useMemo(() => {
    if (!compactExpandable || !navPersistenceScope) return null;
    return buildNavExpandedGroupsStorageKey(navPersistenceScope);
  }, [compactExpandable, navPersistenceScope]);

  const { expandedGroups, toggleGroup } = useCompactNavExpandedGroups({
    compactExpandable,
    storageKey,
    activeGroupId,
  });

  return (
    <nav
      className={cn(fiOsChromeClasses.sidebarNavScroll, className)}
      aria-label="Clinic navigation"
    >
      {sections.map((section) => {
        const isExpanded =
          !compactExpandable ||
          expandedGroups.has(section.groupId) ||
          workflowGroupHasActiveRoute(section, activeId, path);
        const groupActive = workflowGroupHasActiveRoute(section, activeId, path);
        const sectionPanelId = `fi-os-nav-group-${section.groupId}`;

        if (!compactExpandable) {
          return (
            <div key={section.groupId} className="space-y-1">
              <p className="px-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500/95">
                {section.title}
              </p>
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => (
                  <RowLink
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    pathname={path}
                    onNavigate={onNavigate}
                    dense={dense}
                    pendingNavId={pendingNavId}
                  />
                ))}
              </div>
            </div>
          );
        }

        return (
          <div key={section.groupId} className="space-y-0.5">
            <button
              type="button"
              className={cn(
                "flex w-full items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1.5 text-left text-[0.6rem] font-semibold uppercase tracking-[0.2em] transition",
                groupActive
                  ? "fi-tenant-accent-text"
                  : "text-slate-500/95 hover:bg-white/[0.04] hover:text-slate-300"
              )}
              aria-expanded={isExpanded}
              aria-controls={sectionPanelId}
              onClick={() => toggleGroup(section.groupId)}
            >
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 transition-transform duration-150",
                  isExpanded ? "rotate-0" : "-rotate-90"
                )}
                aria-hidden
              />
              <span className="min-w-0 flex-1 truncate">{section.title}</span>
            </button>
            {isExpanded ? (
              <div id={sectionPanelId} className="flex flex-col gap-0.5 pb-1">
                {section.items.map((item) => (
                  <RowLink
                    key={item.id}
                    item={item}
                    activeId={activeId}
                    pathname={path}
                    onNavigate={onNavigate}
                    dense={dense}
                    pendingNavId={pendingNavId}
                  />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
