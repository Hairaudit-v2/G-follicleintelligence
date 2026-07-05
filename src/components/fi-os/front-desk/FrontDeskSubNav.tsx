"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  FI_OS_FRONT_DESK_TABS,
  buildFiOsFrontDeskBase,
  buildFiOsFrontDeskTabHref,
  isFrontDeskTabActive,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";

export function FrontDeskSubNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = buildFiOsFrontDeskBase(tenantId);

  return (
    <nav
      aria-label="Front desk navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {FI_OS_FRONT_DESK_TABS.map((tab) => {
        const href = buildFiOsFrontDeskTabHref(tenantId, tab);
        const active = isFrontDeskTabActive(pathname, base, tab.segment);
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