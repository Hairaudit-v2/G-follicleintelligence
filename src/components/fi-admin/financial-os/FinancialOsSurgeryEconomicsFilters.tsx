"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { SurgeryEconomicsDashboardFilters } from "@/src/lib/financialOs/financialSurgeryEconomics.server";

type FilterOption = { value: string; label: string };

export function FinancialOsSurgeryEconomicsFilters(props: {
  tenantId: string;
  procedureTypes: string[];
  surgeonOptions: FilterOption[];
  clinicOptions: FilterOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = useMemo(
    (): SurgeryEconomicsDashboardFilters => ({
      dateFrom: searchParams.get("se_from") ?? null,
      dateTo: searchParams.get("se_to") ?? null,
      procedureType: searchParams.get("se_procedure") ?? null,
      surgeonUserId: searchParams.get("se_surgeon") ?? null,
      clinicId: searchParams.get("se_clinic") ?? null,
      snapshotStatus:
        (searchParams.get("se_status") as SurgeryEconomicsDashboardFilters["snapshotStatus"]) ??
        "all",
    }),
    [searchParams]
  );

  const apply = useCallback(
    (patch: Partial<SurgeryEconomicsDashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...current, ...patch };
      const setOrDelete = (key: string, value: string | null | undefined) => {
        if (value?.trim()) params.set(key, value.trim());
        else params.delete(key);
      };
      setOrDelete("se_from", merged.dateFrom);
      setOrDelete("se_to", merged.dateTo);
      setOrDelete("se_procedure", merged.procedureType);
      setOrDelete("se_surgeon", merged.surgeonUserId);
      setOrDelete("se_clinic", merged.clinicId);
      if (merged.snapshotStatus && merged.snapshotStatus !== "all")
        setOrDelete("se_status", merged.snapshotStatus);
      else params.delete("se_status");
      router.push(`/fi-admin/${props.tenantId}/financial-os?${params.toString()}`);
    },
    [current, props.tenantId, router, searchParams]
  );

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-white/[0.07] bg-[#0c1426]/80 p-3 backdrop-blur-md lg:grid-cols-3 xl:grid-cols-6">
      <label className={financialOsClasses.formLabel}>
        From
        <input
          type="date"
          value={current.dateFrom ?? ""}
          onChange={(e) => apply({ dateFrom: e.target.value || null })}
          className={financialOsClasses.input}
        />
      </label>
      <label className={financialOsClasses.formLabel}>
        To
        <input
          type="date"
          value={current.dateTo ?? ""}
          onChange={(e) => apply({ dateTo: e.target.value || null })}
          className={financialOsClasses.input}
        />
      </label>
      <label className={financialOsClasses.formLabel}>
        Procedure
        <select
          value={current.procedureType ?? ""}
          onChange={(e) => apply({ procedureType: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.procedureTypes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Surgeon
        <select
          value={current.surgeonUserId ?? ""}
          onChange={(e) => apply({ surgeonUserId: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.surgeonOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Clinic
        <select
          value={current.clinicId ?? ""}
          onChange={(e) => apply({ clinicId: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.clinicOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Balance status
        <select
          value={current.snapshotStatus ?? "all"}
          onChange={(e) =>
            apply({
              snapshotStatus: e.target.value as SurgeryEconomicsDashboardFilters["snapshotStatus"],
            })
          }
          className={financialOsClasses.select}
        >
          <option value="all">All snapshots</option>
          <option value="paid_in_full">Paid in full</option>
          <option value="outstanding">Outstanding balance</option>
        </select>
      </label>
    </div>
  );
}
