"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import type { ExecutiveFinanceDashboardFilters } from "@/src/lib/financialOs/financialExecutiveIntelligence.server";

const PREFIX = "ex_";

export function FinancialOsExecutiveFilters(props: {
  tenantId: string;
  filters: ExecutiveFinanceDashboardFilters;
  clinicOptions: Array<{ value: string; label: string }>;
  procedureTypes: string[];
  sources: string[];
  consultantOptions: Array<{ value: string; label: string }>;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      const fullKey = `${PREFIX}${key}`;
      if (value?.trim()) params.set(fullKey, value.trim());
      else params.delete(fullKey);
      router.push(`/fi-admin/${props.tenantId}/financial-os/executive?${params.toString()}`);
    },
    [router, searchParams, props.tenantId],
  );

  return (
    <div className={financialOsClasses.formPanel}>
      <p className={financialOsClasses.formTitle}>Filters</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <label className={financialOsClasses.formLabel}>
          From
          <input
            type="date"
            className={financialOsClasses.input}
            defaultValue={props.filters.dateFrom ?? ""}
            onChange={(e) => setParam("from", e.target.value || null)}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          To
          <input
            type="date"
            className={financialOsClasses.input}
            defaultValue={props.filters.dateTo ?? ""}
            onChange={(e) => setParam("to", e.target.value || null)}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          Clinic
          <select
            className={financialOsClasses.select}
            value={props.filters.clinicId ?? ""}
            onChange={(e) => setParam("clinic", e.target.value || null)}
          >
            <option value="">All clinics</option>
            {props.clinicOptions.map((o) => (
              <option key={o.value} value={o.value} className={financialOsClasses.selectOption}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Procedure type
          <select
            className={financialOsClasses.select}
            value={props.filters.procedureType ?? ""}
            onChange={(e) => setParam("procedure", e.target.value || null)}
          >
            <option value="">All procedures</option>
            {props.procedureTypes.map((p) => (
              <option key={p} value={p} className={financialOsClasses.selectOption}>
                {p.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Source
          <select
            className={financialOsClasses.select}
            value={props.filters.source ?? ""}
            onChange={(e) => setParam("source", e.target.value || null)}
          >
            <option value="">All sources</option>
            {props.sources.map((s) => (
              <option key={s} value={s} className={financialOsClasses.selectOption}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className={financialOsClasses.formLabel}>
          Consultant
          <select
            className={financialOsClasses.select}
            value={props.filters.consultantFiUserId ?? ""}
            onChange={(e) => setParam("consultant", e.target.value || null)}
          >
            <option value="">All consultants</option>
            {props.consultantOptions.map((o) => (
              <option key={o.value} value={o.value} className={financialOsClasses.selectOption}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
