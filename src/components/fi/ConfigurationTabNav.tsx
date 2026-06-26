"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import {
  CONFIGURATION_TAB_LABELS,
  CONFIGURATION_TABS,
  type ConfigurationTabId,
} from "@/src/lib/fi/configurationTabs";

export function ConfigurationTabNav({
  tenantId,
  activeTab,
}: {
  tenantId: string;
  activeTab: ConfigurationTabId;
}) {
  const searchParams = useSearchParams();
  const base = `/fi-admin/${tenantId.trim()}/configuration`;

  function hrefFor(tab: ConfigurationTabId): string {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "branding") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  }

  return (
    <div
      className="flex flex-wrap gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0c1220]/80 p-1 shadow-lg shadow-black/30"
      role="tablist"
      aria-label="Configuration sections"
    >
      {CONFIGURATION_TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <Link
            key={tab}
            href={hrefFor(tab)}
            role="tab"
            aria-selected={active}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-white/[0.12] text-slate-100 shadow-sm"
                : "text-slate-500 hover:bg-white/[0.06] hover:text-slate-300"
            }`}
          >
            {CONFIGURATION_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
