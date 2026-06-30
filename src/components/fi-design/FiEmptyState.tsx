import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type FiEmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
};

export function FiEmptyState({ title, description, action, className }: FiEmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-white/[0.08] bg-white/[0.03] px-4 py-8 text-center sm:px-6",
        className
      )}
    >
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
