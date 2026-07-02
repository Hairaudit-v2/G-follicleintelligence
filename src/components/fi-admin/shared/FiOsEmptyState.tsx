import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function FiOsEmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-4 py-12 text-center", className)}>
      {icon ? <div className="mx-auto mb-4 flex justify-center text-slate-500">{icon}</div> : null}
      <p className="text-base font-semibold text-slate-200">{title}</p>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? (
        <Link
          href={action.href}
          className="mt-5 inline-flex items-center justify-center rounded-xl border border-cyan-500/35 bg-cyan-500/10 px-5 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}