import type { ReactNode } from "react";

import { DashboardCard, SectionHeader } from "@/src/components/fi-admin/dashboard-ui";

export const patientTwinSectionClass =
  "rounded-2xl border border-white/[0.08] bg-[#0F1629]/75 p-4 shadow-lg shadow-black/25 backdrop-blur-md sm:p-5";

export function SummaryTile(props: {
  label: string;
  value: number | string;
  sub?: string;
  tone?: "neutral" | "warning" | "info";
}) {
  const valueClass =
    props.tone === "warning"
      ? "text-amber-200"
      : props.tone === "info"
        ? "text-cyan-200"
        : "text-slate-50";

  return (
    <div className="flex min-w-0 flex-col rounded-xl border border-white/[0.07] bg-[#0c1426]/70 px-3 py-3 shadow-inner shadow-black/25 backdrop-blur-sm">
      <p className="truncate text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {props.label}
      </p>
      <p
        className={`mt-2 font-mono text-xl font-semibold tabular-nums tracking-tight ${valueClass}`}
      >
        {props.value}
      </p>
      {props.sub ? (
        <p className="mt-1 text-[0.7rem] leading-snug text-slate-500">{props.sub}</p>
      ) : null}
    </div>
  );
}

export function TwinSectionCard({
  id,
  title,
  description,
  children,
  className = "",
}: {
  id?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DashboardCard
      className={`p-4 sm:p-5 ${className}`.trim()}
      role="region"
      aria-labelledby={id ? `${id}-heading` : undefined}
    >
      <SectionHeader
        id={id ? `${id}-heading` : undefined}
        title={title}
        description={description}
      />
      <div className="mt-4">{children}</div>
    </DashboardCard>
  );
}

export function TwinEmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-slate-500">
        {description}
      </p>
    </div>
  );
}

export function TwinListRow({
  primary,
  meta,
  actions,
}: {
  primary: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-2 border-b border-white/[0.06] px-3 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-100">{primary}</div>
        {meta ? <div className="mt-0.5 text-xs text-slate-500">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          {actions}
        </div>
      ) : null}
    </li>
  );
}

export function formatTwinWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function coveragePercentLabel(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}
