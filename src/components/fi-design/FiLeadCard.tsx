import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type FiLeadCardProps = {
  name: string;
  stage?: string | null;
  href?: string;
  meta?: ReactNode;
  className?: string;
  dataResultKey?: string;
  onNavigate?: () => void;
};

export function FiLeadCard({ name, stage, href, meta, className, dataResultKey, onNavigate }: FiLeadCardProps) {
  const shell = cn(
    "group flex flex-col rounded-xl border border-slate-100 bg-white px-3 py-2.5 outline-none transition hover:border-sky-200/80 hover:bg-sky-50/50 focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
    className
  );

  const stageLine =
    stage != null && stage !== "" ? (
      <span className="text-xs text-slate-500 sm:text-sm">Stage · {stage}</span>
    ) : null;

  const main = (
    <div className="min-w-0 flex-1">
      <span className="font-medium text-slate-900">{name}</span>
      <div className="mt-0.5 flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
        {stageLine}
        {meta}
      </div>
    </div>
  );

  if (href?.trim()) {
    return (
      <Link data-result-key={dataResultKey} href={href} className={shell} onClick={onNavigate}>
        {main}
        <ArrowRight
          className="ml-auto mt-1 hidden h-4 w-4 shrink-0 text-sky-600 opacity-0 transition group-hover:opacity-100 sm:mt-0 sm:block"
          aria-hidden
        />
      </Link>
    );
  }

  return (
    <div className={cn(shell, "cursor-default hover:border-slate-100 hover:bg-white")}>
      {main}
      <ArrowRight className="ml-auto mt-1 hidden h-4 w-4 shrink-0 text-slate-300 sm:mt-0 sm:block" aria-hidden />
    </div>
  );
}
