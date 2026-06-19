"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { RevenueAttributionDashboardFilters } from "@/src/lib/financialOs/financialRevenueAttributionCore";

type FilterOption = { value: string; label: string };

export function FinancialOsRevenueAttributionFilters(props: {
  tenantId: string;
  sources: string[];
  campaigns: string[];
  consultantOptions: FilterOption[];
  clinicOptions: FilterOption[];
  procedureTypes: string[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const current = useMemo(
    (): RevenueAttributionDashboardFilters => ({
      dateFrom: searchParams.get("ra_from") ?? null,
      dateTo: searchParams.get("ra_to") ?? null,
      source: searchParams.get("ra_source") ?? null,
      campaign: searchParams.get("ra_campaign") ?? null,
      consultantFiUserId: searchParams.get("ra_consultant") ?? null,
      clinicId: searchParams.get("ra_clinic") ?? null,
      procedureType: searchParams.get("ra_procedure") ?? null,
    }),
    [searchParams]
  );

  const apply = useCallback(
    (patch: Partial<RevenueAttributionDashboardFilters>) => {
      const params = new URLSearchParams(searchParams.toString());
      const merged = { ...current, ...patch };
      const setOrDelete = (key: string, value: string | null | undefined) => {
        if (value?.trim()) params.set(key, value.trim());
        else params.delete(key);
      };
      setOrDelete("ra_from", merged.dateFrom);
      setOrDelete("ra_to", merged.dateTo);
      setOrDelete("ra_source", merged.source);
      setOrDelete("ra_campaign", merged.campaign);
      setOrDelete("ra_consultant", merged.consultantFiUserId);
      setOrDelete("ra_clinic", merged.clinicId);
      setOrDelete("ra_procedure", merged.procedureType);
      router.push(`/fi-admin/${props.tenantId}/financial-os?${params.toString()}`);
    },
    [current, props.tenantId, router, searchParams]
  );

  return (
    <div className="mb-4 grid gap-3 rounded-xl border border-white/[0.07] bg-[#0c1426]/80 p-3 backdrop-blur-md lg:grid-cols-3 xl:grid-cols-7">
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
        Source
        <select
          value={current.source ?? ""}
          onChange={(e) => apply({ source: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.sources.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Campaign
        <select
          value={current.campaign ?? ""}
          onChange={(e) => apply({ campaign: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.campaigns.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>
      <label className={financialOsClasses.formLabel}>
        Consultant
        <select
          value={current.consultantFiUserId ?? ""}
          onChange={(e) => apply({ consultantFiUserId: e.target.value || null })}
          className={financialOsClasses.select}
        >
          <option value="">All</option>
          {props.consultantOptions.map((o) => (
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
    </div>
  );
}
