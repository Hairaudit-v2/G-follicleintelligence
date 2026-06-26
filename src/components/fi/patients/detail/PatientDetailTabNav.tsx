"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  PATIENT_DETAIL_TAB_LABELS,
  PATIENT_DETAIL_TABS,
  type PatientDetailTabId,
} from "@/src/lib/patients/patientDetailTabs";

export function PatientDetailTabNav({
  tenantId,
  patientId,
  activeTab,
}: {
  tenantId: string;
  patientId: string;
  activeTab: PatientDetailTabId;
}) {
  const searchParams = useSearchParams();
  const base = `/fi-admin/${tenantId}/patients/${patientId}`;

  function hrefFor(tab: PatientDetailTabId): string {
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
      className="flex flex-wrap gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-[#0c1220]/80 p-1 shadow-lg shadow-black/30"
      role="tablist"
      aria-label="Patient sections"
    >
      {PATIENT_DETAIL_TABS.map((tab) => {
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
            {PATIENT_DETAIL_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
