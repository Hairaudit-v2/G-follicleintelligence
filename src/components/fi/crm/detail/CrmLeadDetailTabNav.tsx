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
      className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
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
              active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {CRM_LEAD_DETAIL_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
