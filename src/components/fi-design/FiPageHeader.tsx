import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FiPageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  primaryAction?: ReactNode;
  secondaryAction?: ReactNode;
  /** Renders before the title block (e.g. calendar icon). */
  leading?: ReactNode;
  className?: string;
  /** Optional `id` for the `<h1>` (landmark labelling). */
  titleId?: string;
};

/**
 * Presentational page title row for Clinic OS / FI admin surfaces.
 */
export function FiPageHeader({
  eyebrow,
  title,
  description,
  primaryAction,
  secondaryAction,
  leading,
  className,
  titleId,
}: FiPageHeaderProps) {
  const hasActions = primaryAction != null || secondaryAction != null;

  return (
    <div className={cn("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1 space-y-1">
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">{eyebrow}</p>
          ) : null}
          <h1 id={titleId} className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">{description}</p>
          ) : null}
        </div>
      </div>
      {hasActions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">{secondaryAction}{primaryAction}</div>
      ) : null}
    </div>
  );
}
