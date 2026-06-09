import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function DashboardEmptyState(props: {
  icon?: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  className?: string;
}) {
  const { icon, title, description, actionLabel, actionHref, className } = props;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] px-5 py-8 text-center backdrop-blur-sm sm:px-8 sm:py-10",
        className,
      )}
    >
      {icon ? (
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-400">
          {icon}
        </span>
      ) : null}
      <p className="text-sm font-semibold tracking-tight text-slate-100">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">{description}</p>
      <Link
        href={actionHref}
        className="mt-5 inline-flex items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-50 transition hover:border-cyan-400/50 hover:bg-cyan-500/18"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
