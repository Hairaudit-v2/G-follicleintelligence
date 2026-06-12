"use client";

import Link from "next/link";
import {
  Briefcase,
  Calendar,
  ClipboardCheck,
  Dna,
  GraduationCap,
  LayoutDashboard,
  LineChart,
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

function iconFor(id: string) {
  switch (id) {
    case "dashboard":
      return LayoutDashboard;
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
}) {
  const { item, activeId, pathname, onNavigate, dense } = props;
  const Icon = iconFor(item.id);
  const active = !item.disabled && activeId === item.id;
  const row = cn(
    "group relative flex items-center gap-2.5 rounded-lg border px-2.5 text-[13px] font-medium transition duration-150",
    dense ? "py-1.5" : "py-2",
    item.disabled
      ? "cursor-not-allowed border-transparent text-slate-600"
      : active
        ? "border-cyan-400/25 bg-cyan-500/[0.16] text-slate-50 shadow-[inset_3px_0_0_0_rgba(34,211,238,0.9)]"
        : "border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100",
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
            className={cn(
              "ml-6 block rounded-md border border-transparent py-1 pl-2 pr-2 text-[12px] font-medium transition",
              subActive
                ? "border-cyan-400/20 bg-cyan-500/15 text-cyan-100"
                : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-200",
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
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </span>
    );
  }

  return (
    <div key={item.id} className="flex flex-col gap-0.5">
      <Link href={item.href} className={row} title={item.hint} aria-current={active ? "page" : undefined} onClick={onNavigate}>
        <Icon
          className={cn(
            "h-[1.125rem] w-[1.125rem] shrink-0",
            active ? "text-cyan-300" : "text-slate-500 group-hover:text-slate-300",
          )}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
      {sub}
    </div>
  );
}

export function FiOsModuleNav({
  sections,
  activeId,
  pathname,
  onNavigate,
  dense,
  className,
}: {
  sections: FiOsSidebarWorkflowSection[];
  activeId: string | null;
  pathname?: string;
  onNavigate?: () => void;
  dense?: boolean;
  className?: string;
}) {
  const path = pathname ?? "";
  return (
    <nav className={cn("flex flex-1 flex-col gap-3 px-1.5 py-1.5", className)} aria-label="FI OS modules">
      {sections.map((section) => (
        <div key={section.groupId} className="space-y-1">
          <p className="px-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.2em] text-slate-500/95">{section.title}</p>
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => (
              <RowLink key={item.id} item={item} activeId={activeId} pathname={path} onNavigate={onNavigate} dense={dense} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
