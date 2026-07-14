"use client";

import Link from "next/link";

import { financialOsClasses } from "@/src/components/fi-admin/financial-os/financialOsUi";
import { REPORT_CATEGORY_LABELS, type ReportDefinition } from "@/src/lib/reports/reportCatalog";
import { cn } from "@/lib/utils";

export function ReportCard(props: {
  definition: ReportDefinition;
  liveHref: string | null;
  onGenerate: () => void;
  onSchedule?: () => void;
  scheduleBusy?: boolean;
}) {
  const { definition: def, liveHref, onGenerate, onSchedule, scheduleBusy } = props;
  const enabled = def.generateEnabled;

  return (
    <article
      className={cn(
        financialOsClasses.subPanel,
        "flex h-full flex-col gap-3 border border-white/[0.07] bg-[#0c1426]/70 p-4 shadow-sm shadow-black/20"
      )}
      data-testid={`report-card-${def.id}`}
      data-report-id={def.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-cyan-200/90">
          {REPORT_CATEGORY_LABELS[def.category]}
        </span>
        {def.badges?.length ? (
          <div className="flex flex-wrap gap-1">
            {def.badges.map((b) => (
              <span
                key={b}
                className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slate-400"
              >
                {b}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <h3 className="text-sm font-semibold text-slate-50">{def.title}</h3>
        <p className={cn(financialOsClasses.bodyTextXs, "leading-relaxed")}>{def.description}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          className={financialOsClasses.primaryButton}
          disabled={!enabled}
          onClick={onGenerate}
          title={enabled ? "Generate report" : "Coming soon"}
        >
          {enabled ? "Generate" : "Coming soon"}
        </button>
        {enabled && onSchedule ? (
          <button
            type="button"
            className={financialOsClasses.secondaryButton}
            disabled={scheduleBusy}
            onClick={onSchedule}
            title="Enable daily scheduled snapshot for this report"
          >
            Schedule
          </button>
        ) : null}
        {liveHref ? (
          <Link href={liveHref} className={financialOsClasses.secondaryButton}>
            Open live view
          </Link>
        ) : null}
      </div>
    </article>
  );
}
