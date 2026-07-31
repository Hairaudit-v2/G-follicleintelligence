"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  FI_OS_SURGERY_TABS,
  buildFiOsSurgeryTabHref,
  buildFiOsSurgeryTenantBase,
  isSurgeryTabActive,
  type FiOsSurgeryTab,
} from "@/src/lib/fiOs/surgery/surgeryWorkspaceCore";

export function SurgerySubNav({
  tenantId,
  showProcedureDayNav = false,
}: {
  tenantId: string;
  showProcedureDayNav?: boolean;
}) {
  const pathname = usePathname();
  const tenantBase = buildFiOsSurgeryTenantBase(tenantId);
  const tabs = FI_OS_SURGERY_TABS.filter(
    (tab) => tab.id !== "procedure-day" || showProcedureDayNav
  );

  return (
    <nav
      aria-label="Surgery navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {tabs.map((tab: FiOsSurgeryTab) => {
        const href = buildFiOsSurgeryTabHref(tenantId, tab);
        const active = isSurgeryTabActive(pathname, tenantBase, tab.segment);
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
