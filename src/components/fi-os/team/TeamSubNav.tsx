"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import {
  FI_OS_TEAM_TABS,
  buildFiOsTeamTabHref,
  buildFiOsTeamTenantBase,
  isTeamTabActive,
  type FiOsTeamTab,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

export function TeamSubNav({
  tenantId,
  visibleTabIds,
  /** @deprecated Use visibleTabIds from resolveTeamWorkspaceAccessForViewer. */
  showHrOsNav = false,
}: {
  tenantId: string;
  visibleTabIds?: readonly FiOsTeamTab["id"][];
  showHrOsNav?: boolean;
}) {
  const pathname = usePathname() ?? "";
  const tenantBase = buildFiOsTeamTenantBase(tenantId);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allowedIds = visibleTabIds
    ? new Set(visibleTabIds)
    : new Set(
        FI_OS_TEAM_TABS.filter(
          (tab) => tab.id === "overview" || tab.id === "staff" || showHrOsNav
        ).map((tab) => tab.id)
      );
  const tabs = FI_OS_TEAM_TABS.filter((tab) => allowedIds.has(tab.id));

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  return (
    <nav
      aria-label="Team navigation"
      data-testid="team-sub-nav"
      className="relative z-20 mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4 pointer-events-auto"
    >
      {tabs.map((tab: FiOsTeamTab) => {
        const href = buildFiOsTeamTabHref(tenantId, tab);
        const active = isTeamTabActive(pathname, tenantBase, tab.segment);
        const pending = pendingHref === href && !active;
        return (
          <Link
            key={tab.id}
            href={href}
            prefetch
            scroll
            aria-current={active ? "page" : undefined}
            data-testid={`team-tab-${tab.id}`}
            data-pending={pending ? "true" : undefined}
            data-fi-os-nav-id={tab.navSubItemId}
            onClick={() => setPendingHref(href)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                : pending
                  ? "border-[#22C1FF]/30 bg-[#22C1FF]/10 text-[#94A3B8]"
                  : "border-white/[0.08] bg-[#0F1629]/60 text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}