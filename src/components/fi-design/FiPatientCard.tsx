import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { FiStatusBadge } from "./FiStatusBadge";

export type FiPatientCardProps = {
  name: string;
  phone?: string | null;
  email?: string | null;
  href?: string;
  meta?: ReactNode;
  status?: string;
  className?: string;
  dataResultKey?: string;
  onNavigate?: () => void;
};

export function FiPatientCard({
  name,
  phone,
  email,
  href,
  meta,
  status,
  className,
  dataResultKey,
  onNavigate,
}: FiPatientCardProps) {
  const shell = cn(
    "group flex flex-col rounded-xl border border-slate-100 bg-white px-3 py-2.5 outline-none transition hover:border-sky-200/80 hover:bg-sky-50/50 focus-visible:ring-2 focus-visible:ring-sky-400/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
    className
  );

  const main = (
    <div className="min-w-0 flex-1">
      <span className="font-medium text-slate-900">{name}</span>
      <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 sm:text-sm">
        {phone ? <span>{phone}</span> : null}
        {email ? <span>{email}</span> : null}
        {!phone && !email ? <span className="text-slate-400">No phone or email on file</span> : null}
        {meta}
      </span>
    </div>
  );

  const tail = (
    <>
      {status ? (
        <FiStatusBadge tone="neutral" className="mt-2 w-fit shrink-0 sm:mt-0">
          {status}
        </FiStatusBadge>
      ) : null}
      <ArrowRight
        className="ml-auto mt-2 hidden h-4 w-4 shrink-0 text-sky-600 opacity-0 transition group-hover:opacity-100 sm:mt-0 sm:block"
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
    <div className={cn(shell, "cursor-default hover:border-slate-100 hover:bg-white")}>
      {main}
      {tail}
    </div>
  );
}
