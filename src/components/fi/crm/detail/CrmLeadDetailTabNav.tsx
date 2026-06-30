"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CRM_LEAD_DETAIL_TAB_LABELS,
  CRM_LEAD_DETAIL_TABS,
  type CrmLeadDetailTabId,
} from "@/src/lib/crm/crmLeadDetailTabs";

export function CrmLeadDetailTabNav({
  tenantId,
  leadId,
  activeTab,
}: {
  tenantId: string;
  leadId: string;
  activeTab: CrmLeadDetailTabId;
}) {
  const searchParams = useSearchParams();
  const base = `/fi-admin/${tenantId}/crm/leads/${leadId}`;

  function hrefFor(tab: CrmLeadDetailTabId): string {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  }

  return (
    <div
      className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] bg-[#0F1629]/80 backdrop-blur-md p-1 shadow-lg shadow-black/40"
      role="tablist"
      aria-label="Lead sections"
    >
      {CRM_LEAD_DETAIL_TABS.map((tab) => {
        const active = tab === activeTab;
        return (
          <Link
            key={tab}
            href={hrefFor(tab)}
            role="tab"
            aria-selected={active}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-gray-900 text-white" : "text-slate-300 hover:bg-white/[0.03]"
            }`}
          >
            {CRM_LEAD_DETAIL_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
