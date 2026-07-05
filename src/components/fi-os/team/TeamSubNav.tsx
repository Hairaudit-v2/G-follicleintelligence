"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  FI_OS_TEAM_TABS,
  buildFiOsTeamBase,
  buildFiOsTeamTabHref,
  isTeamTabActive,
  type FiOsTeamTab,
} from "@/src/lib/fiOs/team/teamWorkspaceCore";

export function TeamSubNav({
  tenantId,
  showHrOsNav = false,
}: {
  tenantId: string;
  showHrOsNav?: boolean;
}) {
  const pathname = usePathname();
  const base = buildFiOsTeamBase(tenantId);
  const tabs = FI_OS_TEAM_TABS.filter(
    (tab) => tab.id === "overview" || tab.id === "staff" || showHrOsNav
  );

  return (
    <nav
      aria-label="Team navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {tabs.map((tab: FiOsTeamTab) => {
        const href = buildFiOsTeamTabHref(tenantId, tab);
        const active = isTeamTabActive(pathname, base, tab.segment);
        return (
          <Link
            key={tab.id}
            href={href}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
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