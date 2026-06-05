import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

import { fiSurfaceVariantClassNames, type FiSurfaceVariant } from "./fiDesignTokens";

export type FiSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Sets `id` on the section heading for `aria-labelledby`. */
  headingId?: string;
  /** Outer section surface; default matches historical white Clinic panel. */
  surfaceVariant?: FiSurfaceVariant;
};

const SURFACE_WITH_BUILTIN_PADDING = new Set<FiSurfaceVariant>(["clinicLight", "auditDark"]);

/**
 * Titled block with optional trailing action — wraps content in a Fi-style card.
 */
export function FiSection({
  title,
  description,
  action,
  children,
  className,
  contentClassName,
  headingId,
  surfaceVariant = "clinicLight",
}: FiSectionProps) {
  const surface = fiSurfaceVariantClassNames[surfaceVariant];
  const padWhenNeeded =
    !SURFACE_WITH_BUILTIN_PADDING.has(surfaceVariant) ? "p-4 sm:p-5" : undefined;
  const darkHeading = surfaceVariant === "darkGlass" || surfaceVariant === "auditDark";

  return (
    <section
      className={cn(surface, padWhenNeeded, className)}
      {...(headingId ? ({ "aria-labelledby": headingId } as const) : {})}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2
            id={headingId}
            className={
              darkHeading
                ? "text-sm font-semibold text-[#F8FAFC]"
                : "text-sm font-semibold text-slate-900"
            }
          >
            {title}
          </h2>
          {description ? (
            <p
              className={
                darkHeading ? "mt-0.5 text-xs text-[#94A3B8]" : "mt-0.5 text-xs text-slate-500"
              }
            >
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-3", contentClassName)}>{children}</div>
    </section>
  );
}
