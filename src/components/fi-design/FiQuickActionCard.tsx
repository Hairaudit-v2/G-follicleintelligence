import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

import { fiSurfaceVariantClassNames, type FiSurfaceVariant } from "./fiDesignTokens";

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
  /** Outer surface for the interactive card; default matches historical white tile. */
  surfaceVariant?: FiSurfaceVariant;
};

const SURFACE_WITH_BUILTIN_PADDING = new Set<FiSurfaceVariant>(["clinicLight", "auditDark"]);

function isDarkSurface(surfaceVariant: FiSurfaceVariant): boolean {
  return surfaceVariant === "darkGlass" || surfaceVariant === "auditDark";
}

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
  openRowClass,
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
  openRowClass: string;
}) {
  return (
    <>
      <div className="flex items-start gap-2">
        {icon ? <span className={cn("mt-0.5 shrink-0", iconClass)}>{icon}</span> : null}
        <span className={cn("min-w-0 flex-1 text-base font-semibold", titleClass)}>{title}</span>
      </div>
      <span className={cn("mt-2 flex-1 text-sm leading-relaxed", descClass)}>{description}</span>
      {badge ? (
        <span className="mt-3 inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {badge}
        </span>
      ) : null}
      {disabledReason ? (
        <span className="mt-3 text-[11px] font-medium leading-snug text-slate-500">{disabledReason}</span>
      ) : null}
      {showComingSoon ? (
        <span className="mt-3 inline-flex w-fit rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Coming soon
        </span>
      ) : null}
      {isLink && showOpenAffordance ? (
        <span className={cn("mt-4 inline-flex items-center gap-1 text-sm font-semibold", openRowClass)}>
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
  surfaceVariant = "darkGlass",
}: FiQuickActionCardProps) {
  const isLink = Boolean(href?.trim()) && !disabled;
  const showComingSoon = !isLink && !disabledReason && !badge;
  const openRow = showOpenAffordance !== false;
  const dark = isDarkSurface(surfaceVariant);
  const surface = fiSurfaceVariantClassNames[surfaceVariant];
  const padWhenNeeded =
    !SURFACE_WITH_BUILTIN_PADDING.has(surfaceVariant) ? "p-4 sm:p-5" : undefined;

  const linkSurfaceHover =
    surfaceVariant === "clinicLight"
      ? "hover:border-sky-200/80 hover:bg-sky-50/40"
      : surfaceVariant === "crmLight"
        ? "hover:border-sky-200/80 hover:bg-sky-50/40"
        : surfaceVariant === "darkGlass"
          ? "hover:border-white/[0.12] hover:bg-[#141C33]/90"
          : surfaceVariant === "auditDark"
            ? "hover:border-emerald-500/30 hover:bg-slate-900/80"
            : surfaceVariant === "plain"
              ? "hover:border-slate-300 hover:bg-slate-50/80"
              : undefined;

  const linkTitleClass = dark ? "text-[#F8FAFC]" : "text-slate-900";
  const linkDescClass = dark ? "text-[#94A3B8]" : "text-slate-600";
  const linkIconClass = dark ? "text-[#22C1FF]" : "text-sky-600";
  const linkOpenRowClass = dark ? "text-sky-300" : "text-sky-700";

  if (isLink) {
    return (
      <Link
        href={href!}
        className={cn(
          "flex flex-col text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35",
          "min-h-[200px] sm:min-h-[220px]",
          surface,
          padWhenNeeded,
          linkSurfaceHover,
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
          titleClass={linkTitleClass}
          descClass={linkDescClass}
          iconClass={linkIconClass}
          showOpenAffordance={openRow}
          isLink
          openAffordanceLabel={openAffordanceLabel}
          openRowClass={linkOpenRowClass}
        />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/35 sm:p-5",
        "min-h-[200px] cursor-not-allowed border-dashed border-white/[0.08] bg-white/[0.02] text-slate-400 shadow-none sm:min-h-[220px]",
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
        titleClass="text-slate-200"
        descClass="text-slate-400"
        iconClass="text-slate-500"
        showOpenAffordance={false}
        isLink={false}
        openAffordanceLabel={openAffordanceLabel}
        openRowClass="text-sky-700"
      />
    </div>
  );
}
