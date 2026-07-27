"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import {
  FI_OS_FRONT_DESK_TABS,
  buildFiOsFrontDeskBase,
  buildFiOsFrontDeskTabHref,
  isFrontDeskTabActive,
} from "@/src/lib/fiOs/frontDesk/frontDeskWorkspaceCore";
import { FRONT_DESK_PATIENT_MESSAGE_POLL_MS } from "@/src/lib/fiOs/frontDesk/frontDeskPatientMessagesCore";

export function FrontDeskSubNav({ tenantId }: { tenantId: string }) {
  const pathname = usePathname();
  const base = buildFiOsFrontDeskBase(tenantId);
  const [unreadCount, setUnreadCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(
          `/api/tenants/${encodeURIComponent(tenantId.trim())}/front-desk/patient-messages?filter=unread`,
          { cache: "no-store", credentials: "same-origin" }
        );
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { unreadCount?: number } };
        if (!cancelled && typeof json.data?.unreadCount === "number") {
          setUnreadCount(json.data.unreadCount);
        }
      } catch {
        /* badge is best-effort */
      }
    };
    void load();
    const id = window.setInterval(() => void load(), FRONT_DESK_PATIENT_MESSAGE_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [tenantId]);

  return (
    <nav
      aria-label="Front desk navigation"
      className="mb-6 flex flex-wrap gap-2 border-b border-white/[0.08] pb-4"
    >
      {FI_OS_FRONT_DESK_TABS.map((tab) => {
        const href = buildFiOsFrontDeskTabHref(tenantId, tab);
        const active = isFrontDeskTabActive(pathname, base, tab.segment);
        const showBadge = tab.id === "messages" && unreadCount != null && unreadCount > 0;
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
            {showBadge ? (
              <span className="ml-1.5 inline-flex min-w-[1.1rem] justify-center rounded-full bg-[#22C1FF]/25 px-1.5 text-[10px] font-semibold text-[#22C1FF]">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
