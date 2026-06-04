import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

export type FiQuickActionCardProps = {
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
  disabledReason?: string;
  icon?: ReactNode;
  badge?: string;
  className?: string;
  /** When false, linked cards omit the trailing “Open →” row (e.g. compact sidebar). Default true for links. */
  showOpenAffordance?: boolean;
  /** Label before the arrow on linked cards (default “Open”). */
  openAffordanceLabel?: string;
};

const shell =
  "flex flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 sm:p-5";

function CardBody({
  title,
  description,
  icon,
  badge,
  disabledReason,
  showComingSoon,
  titleClass,
  descClass,
  iconClass,
  showOpenAffordance,
  isLink,
  openAffordanceLabel,
}: {
  title: string;
  description: string;
  icon?: ReactNode;
  badge?: string;
  disabledReason?: string;
  showComingSoon: boolean;
  titleClass: string;
  descClass: string;
  iconClass: string;
  showOpenAffordance: boolean;
  isLink: boolean;
  openAffordanceLabel: string;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        {icon ? <span className={cn("mt-0.5 shrink-0", iconClass)}>{icon}</span> : null}
        <span className={cn("min-w-0 flex-1 text-base font-semibold", titleClass)}>{title}</span>
      </div>
      <span className={cn("mt-2 flex-1 text-sm leading-relaxed", descClass)}>{description}</span>
      {badge ? (
        <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          {badge}
        </span>
      ) : null}
      {disabledReason ? (
        <span className="mt-3 text-[11px] font-medium leading-snug text-slate-500">{disabledReason}</span>
      ) : null}
      {showComingSoon ? (
        <span className="mt-3 inline-flex w-fit rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Coming soon
        </span>
      ) : null}
      {isLink && showOpenAffordance ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-700">
          {openAffordanceLabel}{" "}
          <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </span>
      ) : null}
    </>
  );
}

/**
 * Compact CTA tile — Link when `href` is set and not disabled; otherwise a static panel.
 */
export function FiQuickActionCard({
  title,
  description,
  href,
  disabled = false,
  disabledReason,
  icon,
  badge,
  className,
  showOpenAffordance,
  openAffordanceLabel = "Open",
}: FiQuickActionCardProps) {
  const isLink = Boolean(href?.trim()) && !disabled;
  const showComingSoon = !isLink && !disabledReason && !badge;
  const openRow = showOpenAffordance !== false;

  if (isLink) {
    return (
      <Link
        href={href!}
        className={cn(
          shell,
          "min-h-[200px] border-slate-200 bg-white shadow-sm hover:border-sky-200/80 hover:bg-sky-50/40 sm:min-h-[220px]",
          className
        )}
      >
        <CardBody
          title={title}
          description={description}
          icon={icon}
          badge={badge}
          disabledReason={disabledReason}
          showComingSoon={showComingSoon}
          titleClass="text-slate-900"
          descClass="text-slate-600"
          iconClass="text-sky-600"
          showOpenAffordance={openRow}
          isLink
          openAffordanceLabel={openAffordanceLabel}
        />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        shell,
        "min-h-[200px] cursor-not-allowed border-dashed border-slate-200 bg-slate-50/80 text-slate-500 shadow-none sm:min-h-[220px]",
        className
      )}
      aria-disabled="true"
      title={disabledReason ?? (showComingSoon ? "Coming soon" : undefined)}
    >
      <CardBody
        title={title}
        description={description}
        icon={icon}
        badge={badge}
        disabledReason={disabledReason}
        showComingSoon={showComingSoon}
        titleClass="text-slate-800"
        descClass="text-slate-600"
        iconClass="text-slate-400"
        showOpenAffordance={false}
        isLink={false}
        openAffordanceLabel={openAffordanceLabel}
      />
    </div>
  );
}
