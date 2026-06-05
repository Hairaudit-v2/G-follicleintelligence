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
      className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1 shadow-sm"
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
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              active ? "bg-gray-900 text-white" : "text-gray-700 hover:bg-gray-50"
            }`}
          >
            {PATIENT_DETAIL_TAB_LABELS[tab]}
          </Link>
        );
      })}
    </div>
  );
}
