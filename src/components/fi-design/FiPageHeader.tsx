import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { fiPageHeaderVariantClassNames, type FiPageHeaderVariant } from "./fiDesignTokens";

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
  /** Typography + tone family; default preserves historical Clinic OS light header. */
  variant?: FiPageHeaderVariant;
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
  variant = "clinicLight",
}: FiPageHeaderProps) {
  const hasActions = primaryAction != null || secondaryAction != null;
  const t = fiPageHeaderVariantClassNames[variant];

  return (
    <div
      className={cn("flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", className)}
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-start gap-3">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className={cn("flex-1", t.root)}>
          {eyebrow ? <p className={t.eyebrow}>{eyebrow}</p> : null}
          <h1 id={titleId} className={t.title}>
            {title}
          </h1>
          {description ? <p className={t.description}>{description}</p> : null}
        </div>
      </div>
      {hasActions ? (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
          {secondaryAction}
          {primaryAction}
        </div>
      ) : null}
    </div>
  );
}
