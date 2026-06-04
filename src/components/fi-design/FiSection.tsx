import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FiSectionProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  /** Sets `id` on the section heading for `aria-labelledby`. */
  headingId?: string;
};

/**
 * Titled block with optional trailing action — wraps content in a Fi-style card.
 */
export function FiSection({ title, description, action, children, className, contentClassName, headingId }: FiSectionProps) {
  return (
    <section
      className={cn("rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5", className)}
      {...(headingId ? ({ "aria-labelledby": headingId } as const) : {})}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold text-slate-900">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn("mt-3", contentClassName)}>{children}</div>
    </section>
  );
}
