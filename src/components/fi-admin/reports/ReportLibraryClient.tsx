"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  exportReportCsvAction,
  generateReportAction,
} from "@/lib/actions/fi-report-actions";
import { ReportCard } from "@/src/components/fi-admin/reports/ReportCard";
import { ReportResultPanel } from "@/src/components/fi-admin/reports/ReportResultPanel";
import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import {
  REPORT_CATEGORY_LABELS,
  listReports,
  type ReportCategory,
  type ReportDefinition,
  type ReportId,
} from "@/src/lib/reports/reportCatalog";
import {
  AR_RISK_OPTIONS,
  SNAPSHOT_STATUS_OPTIONS,
  buildReportLiveHrefWithPeriod,
  hasReportFilters,
  readStoredReportPeriod,
  reportFilterFields,
  writeStoredReportPeriod,
  type ReportFilterOptions,
  type ReportGenerateFilters,
} from "@/src/lib/reports/reportFilters";
import { periodFromPreset } from "@/src/lib/financialOs/expenses/expensePeriodCore";
import type { ReportGenerateResult } from "@/src/lib/reports/reportTypes";
import { cn } from "@/lib/utils";

const CATEGORY_FILTERS: Array<ReportCategory | "all"> = [
  "all",
  "financial",
  "revenue",
  "clinical",
  "ops",
];

export function ReportLibraryClient(props: {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  catalog: readonly ReportDefinition[];
  filterOptions?: ReportFilterOptions;
}) {
  const { tenantId, filterOptions } = props;
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ReportCategory | "all">("all");
  const [from, setFrom] = useState(props.periodStart);
  const [to, setTo] = useState(props.periodEnd);
  const [procedureType, setProcedureType] = useState("");
  const [attributionSource, setAttributionSource] = useState("");
  const [campaign, setCampaign] = useState("");
  const [arRisk, setArRisk] = useState("all");
  const [snapshotStatus, setSnapshotStatus] = useState<"all" | "paid_in_full" | "outstanding">(
    "all"
  );
  const [busy, startTransition] = useTransition();
  const [exportBusy, startExport] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReportGenerateResult | null>(null);
  const [activeReportId, setActiveReportId] = useState<ReportId | null>(null);

  // Prefer stored period when URL has no explicit override (server default 30d).
  useEffect(() => {
    const stored = readStoredReportPeriod();
    if (!stored) return;
    // Only apply storage when URL period matches initial server default window loosely.
    setFrom((prev) => (prev === props.periodStart ? stored.from : prev));
    setTo((prev) => (prev === props.periodEnd ? stored.to : prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate once on mount
  }, []);

  const filtered = useMemo(() => {
    return listReports({ category, query, phaseMax: 1 });
  }, [category, query]);

  const activeFilterFields = activeReportId ? reportFilterFields(activeReportId) : [];

  function currentFilters(): ReportGenerateFilters {
    return {
      procedureType: procedureType.trim() || null,
      attributionSource: attributionSource.trim() || null,
      campaign: campaign.trim() || null,
      arRisk: arRisk === "all" ? null : arRisk,
      snapshotStatus,
    };
  }

  function liveHrefFor(def: ReportDefinition): string | null {
    return buildReportLiveHrefWithPeriod(
      tenantId,
      def.livePathSuffix,
      { from, to },
      def.id
    );
  }

  function pushPeriod(nextFrom: string, nextTo: string) {
    writeStoredReportPeriod(nextFrom, nextTo);
    const base = `/fi-admin/${tenantId}/reports/library`;
    const qs = new URLSearchParams();
    if (nextFrom) qs.set("from", nextFrom);
    if (nextTo) qs.set("to", nextTo);
    const q = qs.toString();
    router.push(q ? `${base}?${q}` : base);
    router.refresh();
  }

  function applyPreset(preset: "30d" | "90d" | "ytd") {
    const { period_start, period_end } = periodFromPreset(preset);
    setFrom(period_start);
    setTo(period_end);
    pushPeriod(period_start, period_end);
  }

  function runGenerate(def: ReportDefinition) {
    if (!def.generateEnabled) return;
    setError(null);
    setActiveReportId(def.id);
    const filters = currentFilters();
    startTransition(async () => {
      const r = await generateReportAction({
        tenantId,
        reportId: def.id,
        periodStart: from,
        periodEnd: to,
        procedureType: filters.procedureType,
        attributionSource: filters.attributionSource,
        campaign: filters.campaign,
        arRisk: filters.arRisk,
        snapshotStatus: filters.snapshotStatus,
      });
      if (!r.ok) {
        setResult(null);
        setError(r.error);
        return;
      }
      setResult(r.result);
      setError(null);
    });
  }

  function downloadCsvBlob(filename: string, csv: string) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function runExport() {
    if (!activeReportId) return;
    const filters = currentFilters();
    startExport(async () => {
      const r = await exportReportCsvAction({
        tenantId,
        reportId: activeReportId,
        periodStart: from,
        periodEnd: to,
        procedureType: filters.procedureType,
        attributionSource: filters.attributionSource,
        campaign: filters.campaign,
        arRisk: filters.arRisk,
        snapshotStatus: filters.snapshotStatus,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      if (r.files && r.files.length > 0) {
        for (const file of r.files) {
          downloadCsvBlob(file.filename, file.csv);
        }
        return;
      }
      downloadCsvBlob(r.filename, r.csv);
    });
  }

  const showFilterBar =
    activeReportId != null
      ? hasReportFilters(activeReportId)
      : filtered.some((r) => hasReportFilters(r.id));

  return (
    <div className={cn(financialOsClasses.pageSection)} data-testid="report-library">
      <div className="space-y-1">
        <p className={financialOsClasses.metricLabel}>Reports library</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">
          Generate clinic reports
        </h1>
        <p className={cn(financialOsClasses.bodyText, "max-w-3xl")}>
          Searchable catalog of high-value financial reports. Period is remembered for this browser.
          Optional filters apply to surgery, attribution, and AR generators.
        </p>
      </div>

      <div
        className={`${financialOsClasses.formPanel} flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end`}
      >
        <label className={financialOsClasses.formLabel}>
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={financialOsClasses.input}
            disabled={busy}
          />
        </label>
        <label className={financialOsClasses.formLabel}>
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={financialOsClasses.input}
            disabled={busy}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={financialOsClasses.primaryButton}
            disabled={busy}
            onClick={() => pushPeriod(from, to)}
          >
            Apply range
          </button>
          <button
            type="button"
            className={financialOsClasses.secondaryButton}
            disabled={busy}
            onClick={() => applyPreset("30d")}
          >
            30d
          </button>
          <button
            type="button"
            className={financialOsClasses.secondaryButton}
            disabled={busy}
            onClick={() => applyPreset("90d")}
          >
            90d
          </button>
          <button
            type="button"
            className={financialOsClasses.secondaryButton}
            disabled={busy}
            onClick={() => applyPreset("ytd")}
          >
            YTD
          </button>
        </div>
      </div>

      {showFilterBar ? (
        <div
          className={`${financialOsClasses.formPanel} grid gap-3 sm:grid-cols-2 lg:grid-cols-4`}
          data-testid="report-optional-filters"
        >
          {(activeFilterFields.length === 0 || activeFilterFields.includes("procedureType")) &&
          (filterOptions?.procedureTypes.length ?? 0) > 0 ? (
            <label className={financialOsClasses.formLabel}>
              Procedure type
              <select
                className={financialOsClasses.select}
                value={procedureType}
                onChange={(e) => setProcedureType(e.target.value)}
              >
                <option value="" className={financialOsClasses.selectOption}>
                  All procedures
                </option>
                {(filterOptions?.procedureTypes ?? []).map((p) => (
                  <option key={p} value={p} className={financialOsClasses.selectOption}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {(activeFilterFields.length === 0 || activeFilterFields.includes("attributionSource")) &&
          (filterOptions?.attributionSources.length ?? 0) > 0 ? (
            <label className={financialOsClasses.formLabel}>
              Attribution source
              <select
                className={financialOsClasses.select}
                value={attributionSource}
                onChange={(e) => setAttributionSource(e.target.value)}
              >
                <option value="" className={financialOsClasses.selectOption}>
                  All sources
                </option>
                {(filterOptions?.attributionSources ?? []).map((s) => (
                  <option key={s} value={s} className={financialOsClasses.selectOption}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {(activeFilterFields.length === 0 || activeFilterFields.includes("campaign")) &&
          (filterOptions?.campaigns.length ?? 0) > 0 ? (
            <label className={financialOsClasses.formLabel}>
              Campaign
              <select
                className={financialOsClasses.select}
                value={campaign}
                onChange={(e) => setCampaign(e.target.value)}
              >
                <option value="" className={financialOsClasses.selectOption}>
                  All campaigns
                </option>
                {(filterOptions?.campaigns ?? []).map((c) => (
                  <option key={c} value={c} className={financialOsClasses.selectOption}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeFilterFields.length === 0 || activeFilterFields.includes("arRisk") ? (
            <label className={financialOsClasses.formLabel}>
              AR risk
              <select
                className={financialOsClasses.select}
                value={arRisk}
                onChange={(e) => setArRisk(e.target.value)}
              >
                {AR_RISK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className={financialOsClasses.selectOption}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {activeFilterFields.length === 0 || activeFilterFields.includes("snapshotStatus") ? (
            <label className={financialOsClasses.formLabel}>
              Snapshot status
              <select
                className={financialOsClasses.select}
                value={snapshotStatus}
                onChange={(e) =>
                  setSnapshotStatus(e.target.value as "all" | "paid_in_full" | "outstanding")
                }
              >
                {SNAPSHOT_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className={financialOsClasses.selectOption}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className={cn(financialOsClasses.formLabel, "min-w-0 flex-1")}>
          Search
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Expense, CPL, margin…"
            className={financialOsClasses.input}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_FILTERS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                category === c
                  ? "border-[#22C1FF]/40 bg-[#22C1FF]/15 text-[#22C1FF]"
                  : "border-white/[0.08] bg-[#0F1629]/60 text-slate-400 hover:border-white/[0.14] hover:text-slate-200"
              )}
            >
              {c === "all" ? "All" : REPORT_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className={financialOsClasses.errorText} role="alert">
          {error}
        </p>
      ) : null}

      {busy ? (
        <p className={financialOsClasses.infoText} aria-live="polite">
          Generating report…
        </p>
      ) : null}

      {result ? (
        <ReportResultPanel
          result={result}
          liveHref={
            activeReportId
              ? liveHrefFor(
                  props.catalog.find((c) => c.id === activeReportId) ??
                    ({ livePathSuffix: undefined } as ReportDefinition)
                )
              : null
          }
          onExportCsv={runExport}
          exportBusy={exportBusy}
          onClose={() => {
            setResult(null);
            setActiveReportId(null);
          }}
        />
      ) : null}

      {filtered.length === 0 ? (
        <div className={financialOsClasses.emptyStatePanel}>
          <p className={financialOsClasses.emptyState}>No reports match your filters.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filtered.map((def) => (
            <ReportCard
              key={def.id}
              definition={def}
              liveHref={liveHrefFor(def)}
              onGenerate={() => runGenerate(def)}
            />
          ))}
        </div>
      )}

      <p className={financialOsClasses.mutedMeta}>
        Showing {filtered.length} of {props.catalog.length} catalog reports · Period {from} → {to}
      </p>
    </div>
  );
}
