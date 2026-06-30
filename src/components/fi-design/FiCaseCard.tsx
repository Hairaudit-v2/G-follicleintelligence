import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { FiStatusBadge } from "./FiStatusBadge";

export type FiCaseCardProps = {
  title: string;
  patientName?: string | null;
  status?: string | null;
  href?: string;
  meta?: ReactNode;
  className?: string;
  dataResultKey?: string;
  onNavigate?: () => void;
};

export function FiCaseCard({
  title,
  patientName,
  status,
  href,
  meta,
  className,
  dataResultKey,
  onNavigate,
}: FiCaseCardProps) {
  const shell = cn(
    "group flex flex-col gap-1 rounded-xl border border-white/[0.06] bg-[#0F1629]/80 backdrop-blur-md px-3 py-2.5 outline-none transition hover:border-cyan-400/30 hover:bg-cyan-500/10 focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
    className
  );

  const main = (
    <div className="min-w-0 flex-1">
      <p className="font-mono text-xs font-medium text-slate-300">{title}</p>
      {patientName ? (
        <p className="text-sm text-slate-400">
          Patient <span className="font-medium text-slate-200">{patientName}</span>
        </p>
      ) : null}
      {meta}
    </div>
  );

  const tail = (
    <>
      {status ? (
        <FiStatusBadge tone="neutral" className="w-fit shrink-0">
          {status}
        </FiStatusBadge>
      ) : null}
      <ArrowRight
        className="ml-auto hidden h-4 w-4 shrink-0 text-cyan-300 opacity-0 transition group-hover:opacity-100 sm:block"
        aria-hidden
      />
    </>
  );

  if (href?.trim()) {
    return (
      <Link data-result-key={dataResultKey} href={href} className={shell} onClick={onNavigate}>
        {main}
        {tail}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        shell,
        "cursor-default hover:border-white/[0.06] hover:bg-[#0F1629]/80 backdrop-blur-md"
      )}
    >
      {main}
      {tail}
    </div>
  );
}
