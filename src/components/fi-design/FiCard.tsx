import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FiCardProps = {
  children: ReactNode;
  className?: string;
  /** Adds hover / focus affordances for clickable shells (parent should still be Link or button). */
  interactive?: boolean;
};

/**
 * Base surface card — white panel, slate border, Clinic OS rhythm.
 */
export function FiCard({ children, className, interactive }: FiCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5",
        interactive && "transition hover:border-sky-200/80 hover:shadow-md",
        className
      )}
    >
      {children}
    </div>
  );
}
