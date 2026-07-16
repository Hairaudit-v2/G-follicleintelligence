"use client";

import Link from "next/link";

import { GlassCard } from "@/components/marketing/FiMarketingPrimitives";
import { PlatformProgressStatusBadge } from "@/components/platform/PlatformProgressPrimitives";
import { cn } from "@/lib/utils";
import {
  FI_ECOSYSTEM_COMPLETION_SUMMARY,
  FI_ECOSYSTEM_PLATFORM_COMPLETION,
  getPlatformProgressSnapshot,
  PLATFORM_PROGRESS_MODULES,
  type PlatformProgressStatus,
} from "@/lib/marketing/platformProgressPageContent";
import { ExternalLink } from "lucide-react";

type EcosystemCompletionSnapshotProps = {
  variant?: "marketing" | "admin";
  className?: string;
};

function StatusCountCard({
  label,
  value,
  detail,
  accent = "amber",
}: {
  label: string;
  value: string | number;
  detail?: string;
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

  return (
    <GlassCard className={cn(borderClass, "!p-5 sm:!p-6")}>
      <p className={cn("text-[10px] font-semibold uppercase tracking-[0.22em]", labelClass)}>
        {label}
      </p>
      <p className="mt-3 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-4xl">
        {value}
      </p>
      {detail ? (
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{detail}</p>
      ) : null}
    </GlassCard>
  );
}

function SatelliteStatusCard({
  name,
  description,
  status,
  href,
  external,
}: {
  name: string;
  description: string;
  status: PlatformProgressStatus;
  href?: string;
  external?: boolean;
}) {
  const body = (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <p className="font-display text-lg font-semibold tracking-tight text-foreground">{name}</p>
        <PlatformProgressStatusBadge status={status} />
      </div>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {external && href ? (
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-200/80 group-hover:text-cyan-100">
          View platform
          <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
        </span>
      ) : null}
    </>
  );

  if (href) {
    return (
      <GlassCard className="group border-violet-400/12 !p-5 transition-[border-color] duration-200 hover:border-amber-400/25 sm:!p-6">
        <Link
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/40"
        >
          {body}
        </Link>
      </GlassCard>
    );
  }

  return <GlassCard className="border-violet-400/12 !p-5 sm:!p-6">{body}</GlassCard>;
}

export function EcosystemCompletionSnapshot({
  variant = "marketing",
  className,
}: EcosystemCompletionSnapshotProps) {
  const snapshot = getPlatformProgressSnapshot(PLATFORM_PROGRESS_MODULES);
  const { overallEcosystemPercent, fiOsCorePlatformPercent, retiredFromPublicUi } =
    FI_ECOSYSTEM_COMPLETION_SUMMARY;
  const counts = snapshot.statusCounts;

  if (variant === "admin") {
    return (
      <div className={cn("space-y-4", className)}>
        <p className="text-[0.65rem] leading-relaxed text-[#94A3B8]">
          Historical completion estimates retired from public UI on {retiredFromPublicUi}. Prefer
          status counts below for operator communication.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-amber-400/15 bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
              Historical overall (internal)
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">
              ~{overallEcosystemPercent}%
            </p>
          </div>
          <div className="rounded-xl border border-cyan-400/15 bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
              Historical FI OS core (internal)
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">
              ~{fiOsCorePlatformPercent}%
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
              FI OS modules
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold tabular-nums text-[#F8FAFC]">
              {snapshot.activeModuleCount}
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-[#141C33]/60 px-4 py-3">
            <p className="text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-[#94A3B8]">
              Last updated
            </p>
            <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-[#F8FAFC]">
              {snapshot.lastUpdated}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              "Deployed",
              "Operational Pilot",
              "Advanced Build",
              "In Development",
              "Research and Future Development",
            ] as const
          ).map((status) => (
            <div
              key={status}
              className="rounded-xl border border-white/[0.07] bg-[#0F1528]/70 px-3 py-3 sm:px-4"
            >
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">
                {status}
              </p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-cyan-300/90">
                {counts[status]}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCountCard
          label="Systems tracked"
          value={snapshot.activeModuleCount}
          detail="Connected modules in the public progress registry."
          accent="amber"
        />
        <StatusCountCard
          label="Deployed"
          value={counts.Deployed}
          detail="Available for routine operational use within approved scope."
          accent="emerald"
        />
        <StatusCountCard
          label="Operational pilot"
          value={counts["Operational Pilot"]}
          detail="Live in controlled clinical or operational use."
          accent="cyan"
        />
        <StatusCountCard
          label="Advanced build"
          value={counts["Advanced Build"]}
          detail="Core workflows exist; integration and readiness continue."
          accent="violet"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {FI_ECOSYSTEM_PLATFORM_COMPLETION.map((platform) => (
          <SatelliteStatusCard
            key={platform.id}
            name={platform.name}
            description={platform.description}
            status={platform.status ?? "Advanced Build"}
            href={platform.href}
            external={platform.external}
          />
        ))}
      </div>
    </div>
  );
}
