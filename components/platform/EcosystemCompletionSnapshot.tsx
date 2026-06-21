"use client";

import Link from "next/link";

import { GlassCard } from "@/components/marketing/FiMarketingPrimitives";
import { PlatformProgressAnimatedBar } from "@/components/platform/PlatformProgressPrimitives";
import { cn } from "@/lib/utils";
import {
  FI_ECOSYSTEM_COMPLETION_SUMMARY,
  FI_ECOSYSTEM_PLATFORM_COMPLETION,
  getPlatformProgressSnapshot,
  PLATFORM_PROGRESS_MODULES,
} from "@/lib/marketing/platformProgressPageContent";
import { ExternalLink } from "lucide-react";

type EcosystemCompletionSnapshotProps = {
  variant?: "marketing" | "admin";
  className?: string;
};

function CompletionCard({
  label,
  percent,
  detail,
  href,
  external,
  accent = "amber",
}: {
  label: string;
  percent: number;
  detail?: string;
  href?: string;
  external?: boolean;
  accent?: "amber" | "cyan" | "emerald" | "violet";
}) {
  const borderClass =
    accent === "cyan"
      ? "border-cyan-400/12"
      : accent === "emerald"
        ? "border-emerald-400/10"
        : accent === "violet"
          ? "border-violet-400/12"
          : "border-amber-400/12";

  const labelClass =
    accent === "cyan"
      ? "text-cyan-200/70"
      : accent === "emerald"
        ? "text-emerald-200/70"
        : accent === "violet"
          ? "text-violet-200/70"
          : "text-amber-200/70";

  const body = (
    <>
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", labelClass)}>{label}</p>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        ~{percent}
        <span className="text-xl text-muted-foreground">%</span>
      </p>
      <div className="mt-4">
        <PlatformProgressAnimatedBar percent={percent} status="Production" delay={0.04} />
      </div>
      {detail ? <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{detail}</p> : null}
    </>
  );

  if (href) {
    return (
      <GlassCard
        className={cn(
          borderClass,
          "!p-5 transition-[border-color,background-color] duration-200 hover:border-amber-400/25 sm:!p-6",
          external && "group"
        )}
      >
        <Link
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
        >
          {body}
          {external ? (
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-200/80 group-hover:text-cyan-100">
              View platform
              <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
            </span>
          ) : null}
        </Link>
      </GlassCard>
    );
  }

  return <GlassCard className={cn(borderClass, "!p-5 sm:!p-6")}>{body}</GlassCard>;
}

export function EcosystemCompletionSnapshot({ variant = "marketing", className }: EcosystemCompletionSnapshotProps) {
  const snapshot = getPlatformProgressSnapshot(PLATFORM_PROGRESS_MODULES);
  const { overallEcosystemPercent, fiOsCorePlatformPercent } = FI_ECOSYSTEM_COMPLETION_SUMMARY;

  if (variant === "admin") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-400/15 bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Overall FI ecosystem</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">~{overallEcosystemPercent}%</p>
          </div>
          <div className="rounded-xl border border-cyan-400/15 bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">FI OS core platform</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">~{fiOsCorePlatformPercent}%</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">FI OS modules</p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">{snapshot.activeModuleCount}</p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">Last updated</p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#F8FAFC]">{snapshot.lastUpdated}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FI_ECOSYSTEM_PLATFORM_COMPLETION.map((platform) => (
            <div
              key={platform.id}
              className="rounded-xl border border-white/[0.07] bg-[#0F1528]/70 px-3 py-3 sm:px-4"
            >
              <p className="text-sm font-semibold text-[#F8FAFC]">{platform.name}</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-cyan-300/90">~{platform.completionPercent}%</p>
              <div className="mt-2">
                <PlatformProgressAnimatedBar percent={platform.completionPercent} status="Production" delay={0} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2">
        <CompletionCard
          label="Overall FI ecosystem completion"
          percent={overallEcosystemPercent}
          detail="Weighted completion across FI OS, HairAudit, IIOHR, HLI, and connected ecosystem infrastructure."
          accent="amber"
        />
        <CompletionCard
          label="FI OS core platform"
          percent={fiOsCorePlatformPercent}
          detail="Twelve connected OS modules — clinical, surgical, business, and workforce infrastructure inside Follicle Intelligence."
          accent="cyan"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FI_ECOSYSTEM_PLATFORM_COMPLETION.map((platform) => (
          <CompletionCard
            key={platform.id}
            label={platform.name}
            percent={platform.completionPercent}
            detail={platform.description}
            href={platform.href}
            external={platform.external}
            accent="violet"
          />
        ))}
      </div>
    </div>
  );
}
