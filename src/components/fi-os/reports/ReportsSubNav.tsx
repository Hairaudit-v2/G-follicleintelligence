"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  FI_OS_REPORTS_TABS,
  buildFiOsReportsBase,
  buildFiOsReportsTabHref,
  isReportsTabActive,
  type FiOsReportsTab,
} from "@/src/lib/fiOs/reports/reportsWorkspaceCore";

export function ReportsSubNav({
  tenantId,
  showAuditOsNav = true,
  showReportsAdminSurfaces = false,
}: {
  tenantId: string;
  showAuditOsNav?: boolean;
  showReportsAdminSurfaces?: boolean;
}) {
  const pathname = usePathname();
  const base = buildFiOsReportsBase(tenantId);
  const tabs = FI_OS_REPORTS_TABS.filter((tab) => {
    if (tab.id === "quality" && !showAuditOsNav) return false;
    if (tab.id === "admin" && !showReportsAdminSurfaces) return false;
    return true;
  });

  return (
    <nav
      aria-label="Reports navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {tabs.map((tab: FiOsReportsTab) => {
        const href = buildFiOsReportsTabHref(tenantId, tab);
        const active = isReportsTabActive(pathname, base, tab.segment);
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